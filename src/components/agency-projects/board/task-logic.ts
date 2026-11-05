/**
 * Lógica pura do quadro de tarefas e do modal da tarefa (nada de React aqui): soltar cartão em coluna, rascunho e validação
 * dos campos, etiquetas, responsáveis, anexos, comentários e a leitura da atividade. O que já existe em `project-ui.ts`
 * (filtros, ordenação, agrupamento, prazo) não se repete: o quadro importa de lá.
 */
import {
  AGENCY_PROJECT_LIMITS,
  TASK_ATTACHMENT_MIME_TYPES,
  TASK_ATTACHMENT_TYPES_HINT,
  type Task,
  type TaskComment,
  type TaskEvent,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
} from "@/shared/services/agency-projects";

import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, describeTaskEvent, formatDate } from "../project-ui";

// ---------------------------------------------------------------------------
// Arrastar e soltar
// ---------------------------------------------------------------------------

/** Id de cada coluna como alvo de soltar (o do cartão é o próprio id da tarefa, que é um uuid: não colide). */
export const COLUMN_ID_PREFIX = "column:";

export const columnDropId = (status: TaskStatus): string => `${COLUMN_ID_PREFIX}${status}`;

/** Status de um alvo de soltar; `null` quando não é uma coluna (soltou fora do quadro ou sobre outro cartão). */
export function statusFromDropId(id: unknown): TaskStatus | null {
  if (typeof id !== "string" || !id.startsWith(COLUMN_ID_PREFIX)) return null;
  const status = id.slice(COLUMN_ID_PREFIX.length) as TaskStatus;
  return status in TASK_STATUS_LABEL ? status : null;
}

/** O que soltar `activeId` sobre `overId` significa: a tarefa e o status novo, ou `null` quando nada muda. */
export function resolveDrop(tasks: readonly Task[], activeId: unknown, overId: unknown): { task: Task; status: TaskStatus } | null {
  const status = statusFromDropId(overId);
  if (!status) return null;
  const task = tasks.find((t) => t.id === activeId);
  if (!task || task.status === status) return null;
  return { task, status };
}

export interface ColumnBox {
  id: string;
  left: number;
  top: number;
  width: number;
}

/**
 * Coluna vizinha para o teclado: a de centro mais próximo de `centerX` é a atual e a seguinte (`1`) ou anterior (`-1`)
 * é o destino. `null` nas pontas (a seta não faz nada ali).
 */
export function neighborColumn(boxes: readonly ColumnBox[], centerX: number, direction: 1 | -1): ColumnBox | null {
  if (boxes.length === 0) return null;
  const sorted = [...boxes].sort((a, b) => a.left - b.left);
  const center = (box: ColumnBox) => box.left + box.width / 2;
  let current = 0;
  sorted.forEach((box, index) => {
    if (Math.abs(center(box) - centerX) < Math.abs(center(sorted[current]) - centerX)) current = index;
  });
  return sorted[current + direction] ?? null;
}

// ---------------------------------------------------------------------------
// Rascunho e validação
// ---------------------------------------------------------------------------

export interface TaskDraft {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** `YYYY-MM-DD` ou vazio (sem prazo). */
  due_date: string;
  tags: string[];
  assignee_ids: number[];
  primary_assignee_id: number | null;
}

export function emptyDraft(status: TaskStatus = "aberto"): TaskDraft {
  return { title: "", description: "", status, priority: "normal", due_date: "", tags: [], assignee_ids: [], primary_assignee_id: null };
}

export function draftFromTask(task: Pick<Task, "title" | "description" | "status" | "priority" | "due_date" | "tags" | "assignees">): TaskDraft {
  const primary = task.assignees.find((a) => a.is_primary) ?? task.assignees[0];
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    due_date: task.due_date ?? "",
    tags: task.tags,
    assignee_ids: task.assignees.map((a) => a.user_id),
    primary_assignee_id: primary?.user_id ?? null,
  };
}

export function validateTaskTitle(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Informe o título da tarefa";
  if (text.length > AGENCY_PROJECT_LIMITS.taskTitle) return `O título passa de ${AGENCY_PROJECT_LIMITS.taskTitle} caracteres`;
  return null;
}

/** Data de prazo plausível: `YYYY-MM-DD` real, entre 2000 e 2100 (o campo de data dispara `change` a cada dígito do ano). */
export function isPlausibleDueDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateDueDate(value: string): string | null {
  return !value || isPlausibleDueDate(value) ? null : "Informe um prazo válido";
}

export function validateTaskDescription(raw: string): string | null {
  return raw.length > AGENCY_PROJECT_LIMITS.taskDescription ? `A descrição passa de ${AGENCY_PROJECT_LIMITS.taskDescription} caracteres` : null;
}

/** Corpo do `POST` de criação: texto aparado, vazio vira `null`, primário sempre entre os responsáveis. */
export function draftToInput(draft: TaskDraft, extra: Pick<TaskInput, "parent_task_id"> = {}): TaskInput {
  const assignees = normalizeAssignees(draft.assignee_ids, draft.primary_assignee_id);
  return {
    title: draft.title.trim(),
    description: draft.description.trim() === "" ? null : draft.description.trim(),
    status: draft.status,
    priority: draft.priority,
    due_date: draft.due_date || null,
    tags: draft.tags,
    assignee_ids: assignees.ids,
    primary_assignee_id: assignees.primary,
    ...extra,
  };
}

/** Compara o rascunho com o ponto de partida (o que decide se fechar pede confirmação). */
export function isDraftDirty(draft: TaskDraft, base: TaskDraft): boolean {
  return (
    draft.title !== base.title ||
    draft.description !== base.description ||
    draft.status !== base.status ||
    draft.priority !== base.priority ||
    draft.due_date !== base.due_date ||
    draft.tags.join("\u0000") !== base.tags.join("\u0000") ||
    draft.assignee_ids.join(",") !== base.assignee_ids.join(",") ||
    draft.primary_assignee_id !== base.primary_assignee_id
  );
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------

/** Aparada, sem `#` na frente e com espaços repetidos reduzidos a um. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").replace(/\s+/g, " ").trim();
}

/** Acrescenta uma etiqueta respeitando os limites do contrato (10 por tarefa, 30 caracteres, sem repetir). */
export function addTag(tags: readonly string[], raw: string): { tags: string[]; error?: string } {
  const tag = normalizeTag(raw);
  if (!tag) return { tags: [...tags] };
  if (tag.length > AGENCY_PROJECT_LIMITS.taskTag) return { tags: [...tags], error: `A etiqueta passa de ${AGENCY_PROJECT_LIMITS.taskTag} caracteres` };
  if (tags.some((t) => t.toLocaleLowerCase("pt-BR") === tag.toLocaleLowerCase("pt-BR"))) return { tags: [...tags], error: "Essa etiqueta já está na tarefa" };
  if (tags.length >= AGENCY_PROJECT_LIMITS.taskTags) return { tags: [...tags], error: `Cada tarefa aceita até ${AGENCY_PROJECT_LIMITS.taskTags} etiquetas` };
  return { tags: [...tags, tag] };
}

export function removeTag(tags: readonly string[], tag: string): string[] {
  return tags.filter((t) => t !== tag);
}

// ---------------------------------------------------------------------------
// Responsáveis (vários, um principal)
// ---------------------------------------------------------------------------

export interface AssigneeValue {
  ids: number[];
  primary: number | null;
}

/** Sem repetidos, e o principal tem de estar entre os responsáveis (senão vira o primeiro; sem ninguém, `null`). */
export function normalizeAssignees(ids: readonly number[], primary: number | null): AssigneeValue {
  const unique = [...new Set(ids)];
  return { ids: unique, primary: primary !== null && unique.includes(primary) ? primary : (unique[0] ?? null) };
}

/** Cabe mais um responsável? A API aceita até `AGENCY_PROJECT_LIMITS.taskAssignees` por tarefa (400 acima disso). */
export const canAddAssignee = (value: AssigneeValue): boolean => value.ids.length < AGENCY_PROJECT_LIMITS.taskAssignees;

export function toggleAssignee(value: AssigneeValue, userId: number): AssigneeValue {
  if (!value.ids.includes(userId) && !canAddAssignee(value)) return value;
  const ids = value.ids.includes(userId) ? value.ids.filter((id) => id !== userId) : [...value.ids, userId];
  return normalizeAssignees(ids, value.primary);
}

export function setPrimaryAssignee(value: AssigneeValue, userId: number): AssigneeValue {
  if (!value.ids.includes(userId) && !canAddAssignee(value)) return value;
  return normalizeAssignees(value.ids.includes(userId) ? value.ids : [...value.ids, userId], userId);
}

// ---------------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------------

/**
 * Erro de um arquivo antes de enviar (quantidade, tamanho e tipo do contrato), ou `null` se pode ir. O tipo só é conferido
 * quando o arquivo traz um (`File.type`): a API recusa o que não está na lista (400) e o que passa de 25 MB (413).
 */
export function validateAttachment(file: Pick<File, "size" | "name"> & { type?: string }, currentCount: number): string | null {
  if (currentCount >= AGENCY_PROJECT_LIMITS.taskAttachments) return `Cada tarefa aceita até ${AGENCY_PROJECT_LIMITS.taskAttachments} anexos`;
  if (file.size <= 0) return `“${file.name}” está vazio`;
  if (file.size > AGENCY_PROJECT_LIMITS.attachmentBytes) return `“${file.name}” passa de ${Math.round(AGENCY_PROJECT_LIMITS.attachmentBytes / 1024 / 1024)} MB`;
  if (file.type !== undefined && !TASK_ATTACHMENT_MIME_TYPES.includes(file.type.toLowerCase())) {
    return `“${file.name}” não é de um tipo aceito (${TASK_ATTACHMENT_TYPES_HINT})`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Comentários e atividade
// ---------------------------------------------------------------------------

/** Mais antigos primeiro (a conversa lê de cima para baixo e o campo de novo comentário fica no fim). */
export function sortComments(comments: readonly TaskComment[]): TaskComment[] {
  return [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Apaga o comentário o autor (que ainda tem edição no projeto: a API pede `campaigns_write` ou `campaigns_delete` na rota e
 * recusa com 403 `COMMENT_NOT_YOURS` quem não é o autor nem tem `campaigns_delete`) ou quem tem `campaigns_delete`.
 */
export function canRemoveComment(
  comment: Pick<TaskComment, "author">,
  me: number | null | undefined,
  can: { canWrite: boolean; canDelete: boolean },
): boolean {
  return can.canDelete || (can.canWrite && me != null && comment.author.user_id === me);
}

export function validateComment(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Escreva o comentário";
  if (text.length > AGENCY_PROJECT_LIMITS.comment) return `O comentário passa de ${AGENCY_PROJECT_LIMITS.comment} caracteres`;
  return null;
}

/** Mais recentes primeiro. */
export function sortEvents(events: readonly TaskEvent[]): TaskEvent[] {
  return [...events].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

const text = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

/**
 * Complemento do evento ("de Aberto para Em andamento"). O contrato não fixa o `data` de cada tipo, então só se lê o que
 * é texto reconhecível (`from`/`to`, ou `status`/`priority`/`due_date`); qualquer outro formato fica sem complemento.
 */
export function describeEventDetail(event: Pick<TaskEvent, "type" | "data">): string | null {
  const data = event.data ?? {};
  const label = (value: string): string => {
    if (event.type === "status") return TASK_STATUS_LABEL[value as TaskStatus] ?? value;
    if (event.type === "priority") return TASK_PRIORITY_LABEL[value as TaskPriority] ?? value;
    if (event.type === "due_date") return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : value;
    return value;
  };
  if (!["status", "priority", "due_date"].includes(event.type)) return null;
  const from = text(data.from);
  const to = text(data.to) ?? text(data[event.type]);
  if (from && to) return `de ${label(from)} para ${label(to)}`;
  if (to) return `para ${label(to)}`;
  if (event.type === "due_date" && "to" in data && data.to === null) return "prazo removido";
  return null;
}

/** "Ana Souza alterou o prazo (de 10/11/2026 para 12/11/2026)". */
export function describeEvent(event: Pick<TaskEvent, "type" | "data" | "actor">): { actor: string; action: string; detail: string | null } {
  return { actor: event.actor?.name ?? "Alguém", action: describeTaskEvent(event), detail: describeEventDetail(event) };
}

// ---------------------------------------------------------------------------
// Preferências do quadro
// ---------------------------------------------------------------------------

export const showSubtasksStorageKey = (projectId: string): string => `agency-projects:show-subtasks:${projectId}`;

/** "Exibir subtarefas no board" guardado por projeto; sem storage ou valor estranho: desligado. */
export function readShowSubtasks(projectId: string): boolean {
  try {
    return window.localStorage.getItem(showSubtasksStorageKey(projectId)) === "1";
  } catch {
    return false;
  }
}

export function writeShowSubtasks(projectId: string, value: boolean): void {
  try {
    if (value) window.localStorage.setItem(showSubtasksStorageKey(projectId), "1");
    else window.localStorage.removeItem(showSubtasksStorageKey(projectId));
  } catch {
    // Sem storage: a preferência vale só até recarregar.
  }
}

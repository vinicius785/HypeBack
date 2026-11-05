/**
 * Lógica pura do quadro de tarefas: rótulos e tons, atividade, prazo (abertas, atrasadas, período), busca, filtros,
 * ordenação (com a preferência por projeto no `localStorage`) e agrupamento por coluna. Comportamento de referência:
 * `TaskBoard` da Plataforma VNH. O servidor já calcula o que é regra de negócio; aqui só se formata e se organiza.
 */
import type { Task, TaskEvent, TaskPriority, TaskStatus } from "@/shared/services/agency-projects";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/shared/services/agency-projects";

import { daysBetween, formatDayMonth, normalizeText, todayInSaoPaulo, type ResponsibleOption, type Tone } from "./project-base";

// ---------------------------------------------------------------------------
// Rótulos e tons
// ---------------------------------------------------------------------------

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  em_aprovacao: "Em aprovação",
  em_ajustes: "Em ajustes",
  aprovado: "Aprovado",
  bloqueada: "Bloqueada",
  concluido: "Concluído",
  arquivado: "Arquivado",
};

export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  aberto: "neutral",
  em_andamento: "info",
  em_aprovacao: "warn",
  em_ajustes: "warn",
  aprovado: "ok",
  bloqueada: "bad",
  concluido: "dark",
  arquivado: "muted",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgente: "Urgente",
  alta: "Alta",
  normal: "Normal",
  baixa: "Baixa",
};

export const TASK_PRIORITY_TONE: Record<TaskPriority, Tone> = {
  urgente: "bad",
  alta: "warn",
  normal: "neutral",
  baixa: "muted",
};

/** Rótulo da atividade da tarefa por tipo de evento (o `data` de cada evento não tem formato fixo no contrato). */
export const TASK_EVENT_LABEL: Record<string, string> = {
  created: "criou a tarefa",
  status: "mudou o status",
  assignees: "alterou os responsáveis",
  due_date: "alterou o prazo",
  priority: "alterou a prioridade",
  completed: "concluiu a tarefa",
  reopened: "reabriu a tarefa",
  comment: "comentou",
  attachment: "anexou um arquivo",
};

export function describeTaskEvent(event: Pick<TaskEvent, "type">): string {
  return TASK_EVENT_LABEL[event.type] ?? "atualizou a tarefa";
}

// ---------------------------------------------------------------------------
// Tarefas: abertas/fechadas, prazo, filtros, ordenação, agrupamento por coluna
// ---------------------------------------------------------------------------

/** Abertas: tudo menos `concluido` e `arquivado` (o servidor usa a mesma regra para atrasadas e progresso). */
export const OPEN_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  "aberto",
  "em_andamento",
  "em_aprovacao",
  "em_ajustes",
  "aprovado",
  "bloqueada",
]);

export function isTaskOpen(status: TaskStatus): boolean {
  return OPEN_TASK_STATUSES.has(status);
}

/** Atrasada = aberta com prazo anterior a hoje (sem corte de horário). */
export function isTaskOverdue(task: Pick<Task, "status" | "due_date">, today: string = todayInSaoPaulo()): boolean {
  return !!task.due_date && task.due_date < today && isTaskOpen(task.status);
}

export interface TaskDue {
  /** "Hoje", "Amanhã", "Atrasada · 3d" ou "05/11". Vazio sem prazo. */
  text: string;
  /** Vermelho no cartão: atrasada. */
  overdue: boolean;
}

export function taskDueLabel(task: Pick<Task, "status" | "due_date">, today: string = todayInSaoPaulo()): TaskDue {
  if (!task.due_date) return { text: "", overdue: false };
  if (isTaskOverdue(task, today)) return { text: `Atrasada · ${daysBetween(task.due_date, today)}d`, overdue: true };
  const diff = daysBetween(today, task.due_date);
  if (isTaskOpen(task.status) && diff === 0) return { text: "Hoje", overdue: false };
  if (isTaskOpen(task.status) && diff === 1) return { text: "Amanhã", overdue: false };
  return { text: formatDayMonth(task.due_date), overdue: false };
}

/** Responsável principal da tarefa (o marcado; sem marca, o primeiro). */
export function primaryAssignee(task: Pick<Task, "assignees">): Task["assignees"][number] | null {
  return task.assignees.find((a) => a.is_primary) ?? task.assignees[0] ?? null;
}

/** "2/3" das subtarefas (`null` sem subtarefas). */
export function subtaskProgress(task: Pick<Task, "counts">): string | null {
  return task.counts.subtasks > 0 ? `${task.counts.subtasks_done}/${task.counts.subtasks}` : null;
}

export type TaskDeadlinePeriod = "atrasada" | "hoje" | "semana" | "sem_prazo";

export const TASK_PERIOD_LABEL: Record<TaskDeadlinePeriod, string> = {
  atrasada: "Atrasadas",
  hoje: "Vencem hoje",
  semana: "Esta semana",
  sem_prazo: "Sem prazo",
};

export const TASK_PERIOD_OPTIONS: readonly TaskDeadlinePeriod[] = ["atrasada", "hoje", "semana", "sem_prazo"];

/** Dias à frente que o filtro "Esta semana" cobre (de amanhã até daqui a 7 dias, como na Plataforma VNH). */
export const WEEK_WINDOW_DAYS = 7;

/**
 * Período de prazo. Fora "sem prazo", só tarefas abertas entram: `atrasada` (prazo anterior a hoje), `hoje`, e
 * `semana` (de amanhã a 7 dias: hoje já tem o seu filtro).
 */
export function matchesTaskPeriod(task: Pick<Task, "status" | "due_date">, period: TaskDeadlinePeriod, today: string = todayInSaoPaulo()): boolean {
  if (period === "sem_prazo") return !task.due_date;
  if (!task.due_date || !isTaskOpen(task.status)) return false;
  const diff = daysBetween(today, task.due_date);
  if (period === "atrasada") return diff < 0;
  if (period === "hoje") return diff === 0;
  return diff >= 1 && diff <= WEEK_WINDOW_DAYS;
}

export interface TaskFilters {
  /** `user_id` (texto) de quem é responsável (principal ou não). */
  assignees: string[];
  tags: string[];
  priorities: TaskPriority[];
  periods: TaskDeadlinePeriod[];
}

export const DEFAULT_TASK_FILTERS: TaskFilters = { assignees: [], tags: [], priorities: [], periods: [] };

export function countActiveTaskFilters(f: TaskFilters): number {
  return f.assignees.length + f.tags.length + f.priorities.length + f.periods.length;
}

/**
 * Busca (título, descrição, etiquetas e responsáveis) e filtros combináveis: dentro de uma categoria vale "ou"
 * (qualquer etiqueta marcada inclui a tarefa); entre categorias vale "e".
 */
export function filterTasks(tasks: readonly Task[], query: string, f: TaskFilters, today: string = todayInSaoPaulo()): Task[] {
  const needle = normalizeText(query);
  return tasks.filter((t) => {
    if (needle) {
      const haystack = [t.title, t.description ?? "", ...t.tags, ...t.assignees.map((a) => a.name)].map(normalizeText);
      if (!haystack.some((h) => h.includes(needle))) return false;
    }
    if (f.assignees.length > 0 && !t.assignees.some((a) => f.assignees.includes(String(a.user_id)))) return false;
    if (f.tags.length > 0 && !t.tags.some((tag) => f.tags.includes(tag))) return false;
    if (f.priorities.length > 0 && !f.priorities.includes(t.priority)) return false;
    if (f.periods.length > 0 && !f.periods.some((p) => matchesTaskPeriod(t, p, today))) return false;
    return true;
  });
}

/** Opções do filtro "Responsável" do quadro: quem é responsável de alguma tarefa, por nome. */
export function deriveTaskAssignees(tasks: readonly Task[]): ResponsibleOption[] {
  const byId = new Map<string, ResponsibleOption>();
  for (const task of tasks) {
    for (const a of task.assignees) {
      const id = String(a.user_id);
      if (!byId.has(id)) byId.set(id, { id, name: a.name, avatar: a.avatar });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Opções do filtro "Etiqueta": todas as que aparecem nas tarefas, em ordem alfabética. */
export function deriveTaskTags(tasks: readonly Task[]): string[] {
  return [...new Set(tasks.flatMap((t) => t.tags))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export type TaskSortKey =
  | "none"
  | "dueDate_asc"
  | "dueDate_desc"
  | "priority_desc"
  | "priority_asc"
  | "createdAt_desc"
  | "createdAt_asc"
  | "title_asc"
  | "title_desc";

export const TASK_SORT_GROUPS: readonly { id: "dueDate" | "priority" | "createdAt" | "title"; label: string; options: readonly { key: TaskSortKey; label: string }[] }[] = [
  {
    id: "dueDate",
    label: "Prazo",
    options: [
      { key: "dueDate_asc", label: "Prazo: mais próximo" },
      { key: "dueDate_desc", label: "Prazo: mais distante" },
    ],
  },
  {
    id: "priority",
    label: "Prioridade",
    options: [
      { key: "priority_desc", label: "Prioridade: maior primeiro" },
      { key: "priority_asc", label: "Prioridade: menor primeiro" },
    ],
  },
  {
    id: "createdAt",
    label: "Criação",
    options: [
      { key: "createdAt_desc", label: "Mais recentes" },
      { key: "createdAt_asc", label: "Mais antigas" },
    ],
  },
  {
    id: "title",
    label: "Nome",
    options: [
      { key: "title_asc", label: "Nome: A–Z" },
      { key: "title_desc", label: "Nome: Z–A" },
    ],
  },
];

const TASK_SORT_KEYS: readonly TaskSortKey[] = ["none", ...TASK_SORT_GROUPS.flatMap((g) => g.options.map((o) => o.key))];

export const TASK_SORT_LABEL: Record<TaskSortKey, string> = {
  none: "Sem ordenação",
  ...Object.fromEntries(TASK_SORT_GROUPS.flatMap((g) => g.options.map((o) => [o.key, o.label]))),
} as Record<TaskSortKey, string>;

/** Categoria do critério (para não escolher o mesmo critério como principal e desempate). */
export function taskSortCategory(key: TaskSortKey): "dueDate" | "priority" | "createdAt" | "title" | null {
  return key === "none" ? null : key.split("_")[0] as "dueDate" | "priority" | "createdAt" | "title";
}

function compareTasks(a: Task, b: Task, key: TaskSortKey): number {
  switch (key) {
    case "priority_desc":
      return TASK_PRIORITIES.indexOf(a.priority) - TASK_PRIORITIES.indexOf(b.priority);
    case "priority_asc":
      return TASK_PRIORITIES.indexOf(b.priority) - TASK_PRIORITIES.indexOf(a.priority);
    case "dueDate_asc":
    case "dueDate_desc": {
      // Sem prazo fica sempre por último, qualquer que seja a direção.
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return key === "dueDate_asc" ? a.due_date.localeCompare(b.due_date) : b.due_date.localeCompare(a.due_date);
    }
    case "createdAt_desc":
      return b.created_at.localeCompare(a.created_at);
    case "createdAt_asc":
      return a.created_at.localeCompare(b.created_at);
    case "title_asc":
      return a.title.localeCompare(b.title, "pt-BR");
    case "title_desc":
      return b.title.localeCompare(a.title, "pt-BR");
    default:
      return 0;
  }
}

/** Critério principal com o secundário só como desempate. `none` mantém a ordem recebida (a do servidor). */
export function sortTasks(tasks: readonly Task[], primary: TaskSortKey, secondary: TaskSortKey = "none"): Task[] {
  if (primary === "none") return [...tasks];
  return [...tasks].sort((a, b) => compareTasks(a, b, primary) || compareTasks(a, b, secondary));
}

/**
 * Cartões de cada coluna do quadro (uma por status, na ordem de `TASK_STATUSES`). Por padrão só tarefas de 1º nível;
 * com `includeSubtasks` ("exibir subtarefas no board") as subtarefas entram na coluna do próprio status.
 */
export function groupTasksByStatus(
  tasks: readonly Task[],
  options: { includeSubtasks?: boolean; /** Coluna Concluído: as concluídas mais recentes primeiro (como na Plataforma VNH), em vez da ordem recebida. */ recentDoneFirst?: boolean } = {},
): Record<TaskStatus, Task[]> {
  const columns = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as Task[]])) as Record<TaskStatus, Task[]>;
  for (const task of tasks) {
    if (task.parent_task_id && !options.includeSubtasks) continue;
    columns[task.status].push(task);
  }
  if (options.recentDoneFirst) {
    // Concluído só cresce: com o limite por coluna, o que importa no dia a dia são as últimas entregas.
    const doneAt = (t: Task) => t.completed_at ?? t.updated_at;
    columns.concluido.sort((a, b) => doneAt(b).localeCompare(doneAt(a)));
  }
  return columns;
}

/** Máximo de cartões por coluna antes do "Ver mais". */
export const KANBAN_COLUMN_LIMIT = 4;

/** Vista de uma coluna: recolhida mostra até `limit`; expandida mostra tudo. Nada se perde (`visible + hiddenCount = total`). */
export function columnView<T>(items: readonly T[], expanded: boolean, limit: number = KANBAN_COLUMN_LIMIT) {
  const visible = expanded ? [...items] : items.slice(0, limit);
  return { visible, hiddenCount: items.length - visible.length, canCollapse: expanded && items.length > limit };
}

/** Chave do `localStorage` da ordenação do quadro de um projeto (a preferência é por projeto). */
export function taskSortStorageKey(projectId: string): string {
  return `agency-projects:task-sort:${projectId}`;
}

export interface StoredTaskSort {
  primary: TaskSortKey;
  secondary: TaskSortKey;
}

/** Lê a ordenação guardada; storage indisponível ou valor inválido volta ao padrão (`none`). */
export function readStoredTaskSort(projectId: string): StoredTaskSort {
  try {
    const raw = window.localStorage.getItem(taskSortStorageKey(projectId));
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredTaskSort>) : null;
    const primary = TASK_SORT_KEYS.includes(parsed?.primary as TaskSortKey) ? (parsed?.primary as TaskSortKey) : "none";
    const secondary = TASK_SORT_KEYS.includes(parsed?.secondary as TaskSortKey) ? (parsed?.secondary as TaskSortKey) : "none";
    return { primary, secondary: primary === "none" || taskSortCategory(secondary) === taskSortCategory(primary) ? "none" : secondary };
  } catch {
    return { primary: "none", secondary: "none" };
  }
}

export function writeStoredTaskSort(projectId: string, sort: StoredTaskSort): void {
  try {
    window.localStorage.setItem(taskSortStorageKey(projectId), JSON.stringify(sort));
  } catch {
    // Sem storage (navegação privada, cota): a ordenação vale só até recarregar.
  }
}

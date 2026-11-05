/**
 * Projetos de agência (`/backoffice/agency/projects…`, header `Workspace-Id`). Contrato: `docs/agency-projects-spec.md`.
 * Só existe em workspace de agência (a API responde 403 `AGENCY_ONLY` nos demais). Ids públicos são uuid, campos snake_case.
 * Tolerância a API antiga: rota que não existe responde 404 sem código de domínio; aqui isso vira
 * `AgencyProjectsUnavailableError` (as telas mostram "Projetos ainda não está disponível", sem erro genérico).
 */
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/http-client";
import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import { buildApiError } from "@/lib/workspace-state/api-error";

// ---------------------------------------------------------------------------
// Tipos do contrato
// ---------------------------------------------------------------------------

export type ProjectStatus = "ativo" | "pausado" | "concluido" | "arquivado";
export type ProjectHealth = "saudavel" | "atencao" | "em_risco";

export interface ProjectPerson {
  user_id: number;
  name: string;
  avatar: string | null;
}

export interface ProjectStats {
  /** Tarefas de 1º nível, sem arquivadas (as subtarefas não entram em nenhuma contagem do projeto). */
  tasks_total: number;
  tasks_done: number;
  tasks_open: number;
  tasks_overdue: number;
  tasks_blocked: number;
  /** 0..1 (concluídas / tarefas de 1º nível, sem arquivadas). */
  progress: number;
  /** `YYYY-MM-DD`: maior prazo entre as tarefas abertas de 1º nível. */
  deadline: string | null;
  /** `YYYY-MM-DD`: menor prazo entre as tarefas abertas de 1º nível (subtarefas não entram em nenhuma contagem do projeto). */
  next_due: string | null;
  last_activity_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  stats: ProjectStats;
  /** Calculada no servidor, só com o projeto ativo (`null` nos demais). */
  health: ProjectHealth | null;
  responsible: ProjectPerson | null;
  participants: ProjectPerson[];
}

export type TaskStatus =
  | "aberto"
  | "em_andamento"
  | "em_aprovacao"
  | "em_ajustes"
  | "aprovado"
  | "bloqueada"
  | "concluido"
  | "arquivado";
export type TaskPriority = "urgente" | "alta" | "normal" | "baixa";

export interface TaskAssignee extends ProjectPerson {
  is_primary: boolean;
}

export interface Task {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** `YYYY-MM-DD`. */
  due_date: string | null;
  tags: string[];
  completed_at: string | null;
  assignees: TaskAssignee[];
  counts: { subtasks: number; subtasks_done: number; comments: number; attachments: number };
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  author: ProjectPerson;
  body: string;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  url: string;
  name: string;
  mime_type: string;
  size: number;
  uploaded_by: number;
  created_at: string;
}

export interface TaskEvent {
  id: string;
  actor: { user_id: number; name: string } | null;
  /** `created|status|assignees|due_date|priority|completed|reopened|comment|attachment`. */
  type: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface TaskDetail extends Task {
  comments: TaskComment[];
  attachments: TaskAttachment[];
  events: TaskEvent[];
  subtasks: Task[];
}

export type ProjectDocumentCategory = "briefing" | "planejamento" | "apresentacao" | "relatorio" | "contrato" | "referencia" | "outro";

export interface ProjectDocument {
  id: string;
  name: string;
  url: string;
  category: ProjectDocumentCategory;
  pinned: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

export interface ProjectInput {
  name: string;
  description?: string | null;
  cover_url?: string | null;
}

/** Edição parcial; `status` só entra na edição. */
export interface ProjectUpdateInput {
  name?: string;
  description?: string | null;
  cover_url?: string | null;
  status?: ProjectStatus;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** `YYYY-MM-DD` ou `null` para limpar. */
  due_date?: string | null;
  tags?: string[];
  /** Ids de usuários membros do workspace (400 `ASSIGNEE_NOT_MEMBER` se algum não for). */
  assignee_ids?: number[];
  primary_assignee_id?: number | null;
  /** Cria subtarefa (um nível só: 400 `SUBTASK_DEPTH` se o pai já for subtarefa). */
  parent_task_id?: string | null;
}

export type TaskUpdateInput = Partial<TaskInput>;

export interface ProjectDocumentInput {
  name: string;
  url: string;
  category?: ProjectDocumentCategory;
}

export type ProjectDocumentUpdateInput = Partial<ProjectDocumentInput> & { pinned?: boolean };

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const PROJECT_STATUSES: readonly ProjectStatus[] = ["ativo", "pausado", "concluido", "arquivado"];

/** Uma coluna do Kanban por status, nesta ordem. */
export const TASK_STATUSES: readonly TaskStatus[] = [
  "aberto",
  "em_andamento",
  "em_aprovacao",
  "em_ajustes",
  "aprovado",
  "bloqueada",
  "concluido",
  "arquivado",
];

/** Da mais para a menos urgente (a ordem de `sortTasks` por prioridade). */
export const TASK_PRIORITIES: readonly TaskPriority[] = ["urgente", "alta", "normal", "baixa"];

export const PROJECT_DOCUMENT_CATEGORIES: readonly ProjectDocumentCategory[] = [
  "briefing",
  "planejamento",
  "apresentacao",
  "relatorio",
  "contrato",
  "referencia",
  "outro",
];

/** Limites do contrato (os mesmos validados no servidor). */
export const AGENCY_PROJECT_LIMITS = {
  projectName: 120,
  projectDescription: 2000,
  taskTitle: 200,
  taskDescription: 5000,
  taskTags: 10,
  taskTag: 30,
  /** Responsáveis por tarefa. */
  taskAssignees: 20,
  comment: 2000,
  documentName: 120,
  documentUrl: 2000,
  /** Anexos por tarefa. */
  taskAttachments: 10,
  /** Tamanho de cada anexo (o mesmo do chat da equipe e das campanhas). */
  attachmentBytes: 25 * 1024 * 1024,
  coverBytes: 5 * 1024 * 1024,
} as const;

/**
 * Tipos de anexo que a API aceita (os mesmos do chat da equipe e das campanhas; ela confere o tipo declarado e a assinatura
 * do arquivo): imagens JPEG, PNG, GIF, WebP, HEIC e HEIF, vídeos MP4, MOV e AVI, PDF e documentos Word.
 */
export const TASK_ATTACHMENT_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** Valor do `accept` do seletor de anexos. */
export const TASK_ATTACHMENT_ACCEPT = TASK_ATTACHMENT_MIME_TYPES.join(",");

export const TASK_ATTACHMENT_TYPES_HINT = "JPEG, PNG, GIF, WebP, HEIC, MP4, MOV, AVI, PDF, DOC ou DOCX";

/** Capa: tipos aceitos no envio e tamanho máximo depois do redimensionamento no navegador. */
export const PROJECT_COVER_ACCEPT = "image/jpeg,image/png,image/webp";

/** Códigos de erro que a API devolve (campo `error` da resposta) com o texto para a pessoa. */
export const AGENCY_PROJECT_ERROR_MESSAGES: Record<string, string> = {
  AGENCY_ONLY: "Projetos existem só em workspaces de agência.",
  PROJECT_NOT_FOUND: "Esse projeto não existe mais ou não pertence a este workspace.",
  TASK_NOT_FOUND: "Essa tarefa não existe mais.",
  DOCUMENT_NOT_FOUND: "Esse documento não existe mais.",
  COMMENT_NOT_FOUND: "Esse comentário não existe mais.",
  ATTACHMENT_NOT_FOUND: "Esse anexo não existe mais.",
  ASSIGNEE_NOT_MEMBER: "Só membros ativos do workspace podem ser responsáveis.",
  PRIMARY_NOT_ASSIGNEE: "O responsável principal precisa estar entre os responsáveis da tarefa.",
  SUBTASK_DEPTH: "Uma subtarefa não pode ter subtarefas.",
  ATTACHMENT_LIMIT: `Cada tarefa aceita até ${AGENCY_PROJECT_LIMITS.taskAttachments} anexos.`,
  TASK_LIMIT: "Este projeto já tem o máximo de tarefas.",
  COMMENT_LIMIT: "Esta tarefa já tem o máximo de comentários.",
  DOCUMENT_LIMIT: "Este projeto já tem o máximo de arquivos e links.",
  COMMENT_NOT_YOURS: "Você só pode excluir os seus próprios comentários.",
  INVALID_COVER_URL: "Não foi possível usar essa capa. Envie a imagem de novo.",
};

/** Texto para o envio que passou do limite de tamanho (a API responde 413 `File too large`, em inglês). */
const FILE_TOO_LARGE_MESSAGE = "O arquivo passa do tamanho máximo.";

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

/** A API ainda não tem as rotas de Projetos (versão antiga): a tela mostra "ainda não está disponível". */
export class AgencyProjectsUnavailableError extends Error {
  status = 404;
  constructor() {
    super("Projetos ainda não está disponível nesta versão da API");
    this.name = "AgencyProjectsUnavailableError";
  }
}

export function isAgencyProjectsUnavailable(error: unknown): error is AgencyProjectsUnavailableError {
  return error instanceof AgencyProjectsUnavailableError;
}

/** Códigos de 404 que são "o registro não existe" (diferentes de "a rota não existe"). */
const NOT_FOUND_CODES = new Set(["PROJECT_NOT_FOUND", "TASK_NOT_FOUND", "DOCUMENT_NOT_FOUND", "COMMENT_NOT_FOUND", "ATTACHMENT_NOT_FOUND"]);

/**
 * Rota que o servidor não tem (API antiga): o Nest responde 404 com `Cannot GET /caminho` e SEM código (o filtro de
 * exceções da API só repassa os códigos da lista pública). 404 sem corpo também conta. Um 404 com outro texto é de
 * registro, mesmo que o código não tenha chegado (API que ainda não repassa os códigos de Projetos).
 */
function isMissingRoute(error: unknown): boolean {
  const e = error as { status?: number; code?: string; message?: string } | null;
  if (e?.status !== 404 || (e.code && e.code !== "Not Found")) return false;
  return !e.message || e.message === "Not Found" || /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /.test(e.message) || /^Request failed: /.test(e.message);
}

/** 404 que vem de recurso inexistente (ou de outro workspace), e não de rota ausente. */
export function isAgencyProjectNotFound(error: unknown): boolean {
  if (error instanceof AgencyProjectsUnavailableError) return false;
  const e = error as { status?: number; code?: string } | null;
  if (e?.status !== 404) return false;
  if (e.code) return NOT_FOUND_CODES.has(e.code);
  return !isMissingRoute(error);
}

/** Mensagem para a pessoa: o código da API vira texto claro; o resto cai na mensagem do servidor. */
export function agencyProjectErrorMessage(error: unknown, fallback: string): string {
  const e = error as { code?: string; error?: string; status?: number; message?: string; data?: { error?: string } } | null;
  const code = e?.code ?? e?.error ?? e?.data?.error;
  if (code && AGENCY_PROJECT_ERROR_MESSAGES[code]) return AGENCY_PROJECT_ERROR_MESSAGES[code];
  if (e?.status === 413) return FILE_TOO_LARGE_MESSAGE;
  return e?.message || fallback;
}

/** Converte "rota inexistente" em `AgencyProjectsUnavailableError`; o resto passa intacto. */
async function guard<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (isMissingRoute(error)) throw new AgencyProjectsUnavailableError();
    throw error;
  }
}

/**
 * DELETE que pode responder 200 sem corpo: o `apiDelete` tenta ler JSON e um corpo vazio vira `SyntaxError`
 * (só acontece depois de uma resposta de sucesso; erro HTTP já vem tratado), então aqui isso conta como feito.
 */
async function deleteVoid(path: string): Promise<void> {
  try {
    await guard(apiDelete<unknown>(path));
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
}

/** Envio multipart (o `http-client` só fala JSON). Devolve o `data` da resposta. */
async function upload<T>(path: string, file: File, fallback: string): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const workspaceId = getWorkspaceId();
  const response = await fetch(getApiUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken() ?? ""}`,
      ...(workspaceId ? { "Workspace-Id": workspaceId } : {}),
    },
    body: form,
  });
  const body = (await response.json().catch(() => null)) as { data?: T } | null;
  if (!response.ok) throw buildApiError(response.status, body, fallback);
  if (!body || body.data === undefined) throw new Error(fallback);
  return body.data;
}

// ---------------------------------------------------------------------------
// Projetos
// ---------------------------------------------------------------------------

const BASE = "/agency/projects";
const enc = encodeURIComponent;

/** Todos os projetos do workspace (até 500, sem paginação: busca, filtros e ordenação são do cliente). */
export function listAgencyProjects(): Promise<Project[]> {
  return guard(apiGet<Project[]>(BASE));
}

export function getAgencyProject(projectId: string): Promise<Project> {
  return guard(apiGet<Project>(`${BASE}/${enc(projectId)}`));
}

export function createAgencyProject(input: ProjectInput): Promise<Project> {
  return guard(apiPost<Project>(BASE, input));
}

export function updateAgencyProject(projectId: string, input: ProjectUpdateInput): Promise<Project> {
  return guard(apiPatch<Project>(`${BASE}/${enc(projectId)}`, input));
}

/** Copia nome (+ " (cópia)"), descrição e capa; não copia tarefas nem documentos. */
export function duplicateAgencyProject(projectId: string): Promise<Project> {
  return guard(apiPost<Project>(`${BASE}/${enc(projectId)}/duplicate`));
}

/** Apaga o projeto em cascata (tarefas, comentários, anexos e documentos). */
export function deleteAgencyProject(projectId: string): Promise<void> {
  return deleteVoid(`${BASE}/${enc(projectId)}`);
}

/** Envia a capa (imagem até 5 MB; o front já redimensiona para no máx. 1600x900 JPEG). Devolve a URL para `cover_url`. */
export function uploadAgencyProjectCover(file: File): Promise<{ url: string }> {
  return guard(upload<{ url: string }>(`${BASE}/cover`, file, "Não foi possível enviar a capa."));
}

// ---------------------------------------------------------------------------
// Tarefas (1º nível e subtarefas numa lista plana, com `parent_task_id`)
// ---------------------------------------------------------------------------

export function listProjectTasks(projectId: string): Promise<Task[]> {
  return guard(apiGet<Task[]>(`${BASE}/${enc(projectId)}/tasks`));
}

/** Tarefa com comentários, anexos, atividade e subtarefas. */
export function getProjectTask(projectId: string, taskId: string): Promise<TaskDetail> {
  return guard(apiGet<TaskDetail>(`${BASE}/${enc(projectId)}/tasks/${enc(taskId)}`));
}

export function createProjectTask(projectId: string, input: TaskInput): Promise<Task> {
  return guard(apiPost<Task>(`${BASE}/${enc(projectId)}/tasks`, input));
}

export function updateProjectTask(projectId: string, taskId: string, input: TaskUpdateInput): Promise<Task> {
  return guard(apiPatch<Task>(`${BASE}/${enc(projectId)}/tasks/${enc(taskId)}`, input));
}

export function deleteProjectTask(projectId: string, taskId: string): Promise<void> {
  return deleteVoid(`${BASE}/${enc(projectId)}/tasks/${enc(taskId)}`);
}

export function createTaskComment(projectId: string, taskId: string, body: string): Promise<TaskComment> {
  return guard(apiPost<TaskComment>(`${BASE}/${enc(projectId)}/tasks/${enc(taskId)}/comments`, { body }));
}

/** Quem apaga: o autor do comentário ou quem tem `campaigns_delete`. */
export function deleteTaskComment(projectId: string, taskId: string, commentId: string): Promise<void> {
  return deleteVoid(`${BASE}/${enc(projectId)}/tasks/${enc(taskId)}/comments/${enc(commentId)}`);
}

/** Anexo da tarefa (mesmos limites de tipo e tamanho do chat da equipe; até 10 por tarefa). */
export function uploadTaskAttachment(projectId: string, taskId: string, file: File): Promise<TaskAttachment> {
  return guard(
    upload<TaskAttachment>(`${BASE}/${enc(projectId)}/tasks/${enc(taskId)}/attachments`, file, "Não foi possível enviar o anexo."),
  );
}

export function deleteTaskAttachment(projectId: string, taskId: string, attachmentId: string): Promise<void> {
  return deleteVoid(`${BASE}/${enc(projectId)}/tasks/${enc(taskId)}/attachments/${enc(attachmentId)}`);
}

// ---------------------------------------------------------------------------
// Documentos (arquivos e links)
// ---------------------------------------------------------------------------

/** Fixados primeiro (a API já ordena). */
export function listProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  return guard(apiGet<ProjectDocument[]>(`${BASE}/${enc(projectId)}/documents`));
}

export function createProjectDocument(projectId: string, input: ProjectDocumentInput): Promise<ProjectDocument> {
  return guard(apiPost<ProjectDocument>(`${BASE}/${enc(projectId)}/documents`, input));
}

export function updateProjectDocument(
  projectId: string,
  documentId: string,
  input: ProjectDocumentUpdateInput,
): Promise<ProjectDocument> {
  return guard(apiPatch<ProjectDocument>(`${BASE}/${enc(projectId)}/documents/${enc(documentId)}`, input));
}

export function deleteProjectDocument(projectId: string, documentId: string): Promise<void> {
  return deleteVoid(`${BASE}/${enc(projectId)}/documents/${enc(documentId)}`);
}

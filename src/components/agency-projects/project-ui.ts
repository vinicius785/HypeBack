/**
 * Lógica pura de apresentação da LISTA e do CABEÇALHO de Projetos da agência: rótulos e tons, textos dos cartões, busca,
 * filtros, ordenação, agrupamento, indicadores e filtros na URL. Um lugar só para tudo isso: nada é recalculado em componente.
 *
 * O servidor já calcula o que é regra de negócio (progresso, saúde, atrasadas, prazo final, responsáveis: ver o contrato);
 * aqui só se formata e se organiza o que ele devolveu. Comportamento de referência: Plataforma VNH (`projeto-ui.ts`).
 *
 * O que é do quadro de tarefas mora em `task-ui.ts`, o que é de arquivos e links em `document-ui.ts` e o que é comum
 * (tom do selo, texto sem acento, datas de São Paulo) em `project-base.ts`; tudo é reexportado daqui, então as telas e os
 * testes importam de um lugar só.
 */
import type { Project, ProjectHealth, ProjectPerson, ProjectStats, ProjectStatus, Task } from "@/shared/services/agency-projects";
import { PROJECT_STATUSES, TASK_PRIORITIES } from "@/shared/services/agency-projects";

import { formatDayMonth, normalizeText, type ResponsibleOption, type Tone } from "./project-base";
import { isTaskOpen } from "./task-ui";

export * from "./project-base";
export * from "./task-ui";
export * from "./document-ui";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
  arquivado: "Arquivado",
};

export const PROJECT_STATUS_TONE: Record<ProjectStatus, Tone> = {
  ativo: "ok",
  pausado: "neutral",
  concluido: "muted",
  arquivado: "muted",
};

export const PROJECT_HEALTH_LABEL: Record<ProjectHealth, string> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  em_risco: "Em risco",
};

export const PROJECT_HEALTH_TONE: Record<ProjectHealth, Tone> = {
  saudavel: "ok",
  atencao: "warn",
  em_risco: "bad",
};

// ---------------------------------------------------------------------------
// Textos do cartão e do cabeçalho
// ---------------------------------------------------------------------------

/** Iniciais para a capa sem imagem (até duas letras do nome). */
export function projectInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** "Entrega 05/11" (prazo final do projeto) ou "Sem entrega definida". */
export function deliveryLabel(stats: Pick<ProjectStats, "deadline">): string {
  return stats.deadline ? `Entrega ${formatDayMonth(stats.deadline)}` : "Sem entrega definida";
}

export interface TaskSummary {
  /** "3 de 8 concluídas" ou "Nenhuma tarefa cadastrada". */
  progress: string;
  /** "2 atrasadas" / "1 atrasada" (`null` sem atrasadas). Vai em destaque depois de " · ". */
  overdue: string | null;
}

export function taskSummary(stats: Pick<ProjectStats, "tasks_total" | "tasks_done" | "tasks_overdue">): TaskSummary {
  const overdue =
    stats.tasks_overdue > 0 ? `${stats.tasks_overdue} ${stats.tasks_overdue === 1 ? "atrasada" : "atrasadas"}` : null;
  return {
    progress: stats.tasks_total === 0 ? "Nenhuma tarefa cadastrada" : `${stats.tasks_done} de ${stats.tasks_total} concluídas`,
    overdue,
  };
}

/** Texto único do resumo ("3 de 8 concluídas · 2 atrasadas"), para `title` e leitor de tela. */
export function taskSummaryText(stats: Pick<ProjectStats, "tasks_total" | "tasks_done" | "tasks_overdue">): string {
  const { progress, overdue } = taskSummary(stats);
  return overdue ? `${progress} · ${overdue}` : progress;
}

/** Progresso em % inteiro (0 a 100); `null` quando o projeto não tem tarefas (a barra fica vazia e o texto diz "Sem tarefas"). */
export function progressPercent(stats: Pick<ProjectStats, "tasks_total" | "progress">): number | null {
  if (stats.tasks_total === 0) return null;
  return Math.max(0, Math.min(100, Math.round(stats.progress * 100)));
}

export interface PendingSummary {
  /** "2 tarefas atrasadas" ou "Nenhuma pendência crítica". */
  value: string;
  /** "1 bloqueada" quando há (complemento do indicador). */
  complement: string | null;
  /** Há atrasada: o indicador fica em tom de alerta. */
  alert: boolean;
}

/** Indicador "Pendências" do detalhe: prioriza exceções reais, nunca mostra "0". */
export function pendingSummary(stats: Pick<ProjectStats, "tasks_overdue" | "tasks_blocked">): PendingSummary {
  const o = stats.tasks_overdue;
  return {
    value: o > 0 ? `${o} ${o === 1 ? "tarefa atrasada" : "tarefas atrasadas"}` : "Nenhuma pendência crítica",
    complement: stats.tasks_blocked > 0 ? `${stats.tasks_blocked} ${stats.tasks_blocked === 1 ? "bloqueada" : "bloqueadas"}` : null,
    alert: o > 0,
  };
}

/** Tarefa da "Próxima entrega" do detalhe: a primeira tarefa aberta com o prazo `nextDue` (a lista já vem do cache do Kanban). */
export function nextDeliveryTask(tasks: readonly Task[] | undefined, nextDue: string | null): Task | null {
  if (!tasks || !nextDue) return null;
  const candidates = tasks.filter((t) => isTaskOpen(t.status) && t.due_date === nextDue);
  if (candidates.length === 0) return null;
  // Entre as do mesmo dia: a de 1º nível e a mais urgente primeiro.
  return [...candidates].sort(
    (a, b) =>
      Number(!!a.parent_task_id) - Number(!!b.parent_task_id) ||
      TASK_PRIORITIES.indexOf(a.priority) - TASK_PRIORITIES.indexOf(b.priority) ||
      a.title.localeCompare(b.title, "pt-BR"),
  )[0];
}

/** "Ana Souza" · "+2" no cartão: o responsável e quantos participantes vêm depois dele. */
export function responsibleLine(project: Pick<Project, "responsible" | "participants">): { name: string; extra: number; extraNames: string } | null {
  if (!project.responsible) return null;
  return {
    name: project.responsible.name,
    extra: project.participants.length,
    extraNames: project.participants.map((p) => p.name).join(", "),
  };
}

// ---------------------------------------------------------------------------
// Busca, filtros e ordenação da lista de projetos
// ---------------------------------------------------------------------------

export type ProjectStatusFilter = "all" | ProjectStatus;
export type ProjectHealthFilter = "all" | ProjectHealth;
export type ProjectSort = "updated" | "created" | "name" | "overdue" | "progress_desc" | "progress_asc";

export interface ProjectFilters {
  status: ProjectStatusFilter;
  health: ProjectHealthFilter;
  /** `user_id` do responsável (como texto, para a URL) ou `all`. */
  responsible: string;
  sort: ProjectSort;
}

export const DEFAULT_PROJECT_FILTERS: ProjectFilters = { status: "all", health: "all", responsible: "all", sort: "updated" };

export const PROJECT_STATUS_FILTER_LABEL: Record<ProjectStatusFilter, string> = {
  all: "Todos",
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
  arquivado: "Arquivado",
};

export const PROJECT_HEALTH_FILTER_LABEL: Record<ProjectHealthFilter, string> = {
  all: "Todas",
  saudavel: "Saudável",
  atencao: "Atenção",
  em_risco: "Em risco",
};

export const PROJECT_SORT_LABEL: Record<ProjectSort, string> = {
  updated: "Atualizados recentemente",
  created: "Criados recentemente",
  name: "Nome (A–Z)",
  overdue: "Mais tarefas atrasadas",
  progress_desc: "Maior progresso",
  progress_asc: "Menor progresso",
};

export const PROJECT_STATUS_FILTER_OPTIONS: readonly ProjectStatusFilter[] = ["all", ...PROJECT_STATUSES];
export const PROJECT_HEALTH_FILTER_OPTIONS: readonly ProjectHealthFilter[] = ["all", "saudavel", "atencao", "em_risco"];
export const PROJECT_SORT_OPTIONS = (Object.keys(PROJECT_SORT_LABEL) as ProjectSort[]).map((k) => [k, PROJECT_SORT_LABEL[k]] as const);

/** Quantos filtros (fora a ordenação) estão fora do padrão: o número do selo do botão "Filtros". */
export function countActiveProjectFilters(f: ProjectFilters): number {
  return (f.status !== "all" ? 1 : 0) + (f.health !== "all" ? 1 : 0) + (f.responsible !== "all" ? 1 : 0);
}

export function hasProjectCriteria(query: string, f: ProjectFilters): boolean {
  return query.trim().length > 0 || countActiveProjectFilters(f) > 0;
}

/** Limpa os filtros e mantém a ordenação escolhida. */
export function clearProjectFilters(f: ProjectFilters): ProjectFilters {
  return { ...DEFAULT_PROJECT_FILTERS, sort: f.sort };
}

const involvedPeople = (p: Project): ProjectPerson[] => (p.responsible ? [p.responsible, ...p.participants] : [...p.participants]);

/** Nome, descrição e responsáveis (principal e participantes). */
export function matchesProjectSearch(p: Project, query: string): boolean {
  const needle = normalizeText(query);
  if (!needle) return true;
  if (normalizeText(p.name).includes(needle)) return true;
  if (normalizeText(p.description ?? "").includes(needle)) return true;
  return involvedPeople(p).some((person) => normalizeText(person.name).includes(needle));
}

export function filterProjects(projects: readonly Project[], query: string, f: ProjectFilters): Project[] {
  return projects.filter((p) => {
    if (!matchesProjectSearch(p, query)) return false;
    if (f.status !== "all" && p.status !== f.status) return false;
    if (f.health !== "all" && p.health !== f.health) return false;
    if (f.responsible !== "all" && !involvedPeople(p).some((person) => String(person.user_id) === f.responsible)) return false;
    return true;
  });
}

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, "pt-BR");

export function sortProjects(projects: readonly Project[], sort: ProjectSort): Project[] {
  const out = [...projects];
  const progress = (p: Project, empty: number) => (p.stats.tasks_total === 0 ? empty : p.stats.progress);
  switch (sort) {
    case "name":
      return out.sort(byName);
    case "created":
      return out.sort((a, b) => b.created_at.localeCompare(a.created_at) || byName(a, b));
    case "overdue":
      return out.sort((a, b) => b.stats.tasks_overdue - a.stats.tasks_overdue || byName(a, b));
    case "progress_desc":
      // Sem tarefas não tem progresso: vai para o fim nas duas direções.
      return out.sort((a, b) => progress(b, -1) - progress(a, -1) || byName(a, b));
    case "progress_asc":
      return out.sort((a, b) => progress(a, 2) - progress(b, 2) || byName(a, b));
    default:
      return out.sort((a, b) => b.stats.last_activity_at.localeCompare(a.stats.last_activity_at) || byName(a, b));
  }
}

/** Projeto encerrado: concluído ou arquivado. */
export function isClosedProject(status: ProjectStatus): boolean {
  return status === "concluido" || status === "arquivado";
}

/**
 * Separa o que a grade principal mostra do que fica em "Ver projetos encerrados (N)". Com um status escolhido no
 * filtro, tudo aparece junto na grade principal (o filtro já diz o que se quer ver); sem ele, concluídos e
 * arquivados saem da principal. Os dois grupos já saem ordenados.
 */
export function groupProjects(projects: readonly Project[], f: ProjectFilters): { main: Project[]; closed: Project[] } {
  if (f.status !== "all") return { main: sortProjects(projects, f.sort), closed: [] };
  return {
    main: sortProjects(
      projects.filter((p) => !isClosedProject(p.status)),
      f.sort,
    ),
    closed: sortProjects(projects.filter((p) => isClosedProject(p.status)), f.sort),
  };
}

export interface ProjectKpis {
  /** Projetos com status ativo. */
  active: number;
  /** Projetos com saúde "em risco" (só os ativos têm saúde). */
  atRisk: number;
  /** Soma das tarefas atrasadas de todos os projetos (como na Plataforma VNH). */
  overdueTasks: number;
}

export function projectKpis(projects: readonly Project[]): ProjectKpis {
  return {
    active: projects.filter((p) => p.status === "ativo").length,
    atRisk: projects.filter((p) => p.health === "em_risco").length,
    overdueTasks: projects.reduce((sum, p) => sum + p.stats.tasks_overdue, 0),
  };
}

/** Lista do filtro "Responsável": quem aparece como responsável principal ou participante em algum projeto, por nome. */
export function deriveResponsibles(projects: readonly Project[]): ResponsibleOption[] {
  const byId = new Map<string, ResponsibleOption>();
  for (const project of projects) {
    for (const person of involvedPeople(project)) {
      const id = String(person.user_id);
      if (!byId.has(id)) byId.set(id, { id, name: person.name, avatar: person.avatar });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Quais ações de status o menu do cartão oferece. */
export function statusMenuActions(status: ProjectStatus): { canPause: boolean; canReactivate: boolean; canArchive: boolean } {
  return { canPause: status === "ativo", canReactivate: status !== "ativo", canArchive: status !== "arquivado" };
}

// ---------------------------------------------------------------------------
// Filtros e ordenação na URL (`/projects?status=ativo&health=em_risco&owner=7&sort=name`)
// ---------------------------------------------------------------------------

export interface ProjectsSearch {
  status?: ProjectStatus;
  health?: ProjectHealth;
  owner?: string;
  sort?: ProjectSort;
}

const isOneOf = <T extends string>(value: unknown, options: readonly T[]): value is T =>
  typeof value === "string" && (options as readonly string[]).includes(value);

/** Valida os parâmetros da URL: valor desconhecido some (volta ao padrão), nunca quebra a página. */
export function parseProjectsSearch(raw: Record<string, unknown>): ProjectsSearch {
  const owner = typeof raw.owner === "number" ? String(raw.owner) : raw.owner;
  return {
    status: isOneOf(raw.status, PROJECT_STATUSES) ? raw.status : undefined,
    health: isOneOf(raw.health, ["saudavel", "atencao", "em_risco"] as const) ? raw.health : undefined,
    owner: typeof owner === "string" && /^\d+$/.test(owner) ? owner : undefined,
    sort: isOneOf(raw.sort, Object.keys(PROJECT_SORT_LABEL) as ProjectSort[]) && raw.sort !== DEFAULT_PROJECT_FILTERS.sort ? raw.sort : undefined,
  };
}

export function searchToProjectFilters(search: ProjectsSearch): ProjectFilters {
  return {
    status: search.status ?? DEFAULT_PROJECT_FILTERS.status,
    health: search.health ?? DEFAULT_PROJECT_FILTERS.health,
    responsible: search.owner ?? DEFAULT_PROJECT_FILTERS.responsible,
    sort: search.sort ?? DEFAULT_PROJECT_FILTERS.sort,
  };
}

/** Só o que difere do padrão entra na URL (padrão = URL limpa). */
export function projectFiltersToSearch(f: ProjectFilters): ProjectsSearch {
  return {
    status: f.status === "all" ? undefined : f.status,
    health: f.health === "all" ? undefined : f.health,
    owner: f.responsible === "all" ? undefined : f.responsible,
    sort: f.sort === DEFAULT_PROJECT_FILTERS.sort ? undefined : f.sort,
  };
}

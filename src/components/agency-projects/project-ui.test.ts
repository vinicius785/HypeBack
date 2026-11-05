import { afterEach, describe, expect, it } from "vitest";

import type { Project, ProjectDocument, ProjectStats, Task } from "@/shared/services/agency-projects";

import {
  DEFAULT_PROJECT_FILTERS,
  DEFAULT_TASK_FILTERS,
  DOCUMENT_SOURCE_ICON,
  DOCUMENT_SOURCE_LABEL,
  addDaysIso,
  clearProjectFilters,
  columnView,
  countActiveProjectFilters,
  dayInSaoPaulo,
  daysBetween,
  deliveryLabel,
  deriveResponsibles,
  deriveTaskAssignees,
  deriveTaskTags,
  detectDocumentSource,
  filterDocuments,
  filterProjects,
  filterTasks,
  formatDate,
  formatDateTime,
  formatDayMonth,
  groupDocumentsByCategory,
  groupProjects,
  groupTasksByStatus,
  hasProjectCriteria,
  isClosedProject,
  isTaskOverdue,
  matchesProjectSearch,
  matchesTaskPeriod,
  nextDeliveryTask,
  normalizeDocumentUrl,
  safeHttpUrl,
  parseProjectsSearch,
  pendingSummary,
  progressPercent,
  projectFiltersToSearch,
  projectInitials,
  projectKpis,
  readStoredTaskSort,
  responsibleLine,
  searchToProjectFilters,
  sortProjects,
  sortTasks,
  statusMenuActions,
  subtaskProgress,
  taskDueLabel,
  taskSortCategory,
  taskSummary,
  taskSummaryText,
  timeAgo,
  todayInSaoPaulo,
  updatedLabel,
  writeStoredTaskSort,
} from "./project-ui";

const person = (id: number, name: string) => ({ user_id: id, name, avatar: null });

const project = (id: string, over: Omit<Partial<Project>, "stats"> & { stats?: Partial<ProjectStats> } = {}): Project => {
  const { stats, ...rest } = over;
  return {
    id,
    name: `Projeto ${id}`,
    description: null,
    cover_url: null,
    status: "ativo",
    created_at: "2026-11-01T12:00:00Z",
    updated_at: "2026-11-01T12:00:00Z",
    stats: {
      tasks_total: 4,
      tasks_done: 1,
      tasks_open: 3,
      tasks_overdue: 0,
      tasks_blocked: 0,
      progress: 0.25,
      deadline: null,
      next_due: null,
      last_activity_at: "2026-11-01T12:00:00Z",
      ...stats,
    },
    health: "saudavel",
    responsible: null,
    participants: [],
    ...rest,
  };
};

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  project_id: "p1",
  parent_task_id: null,
  title: `Tarefa ${id}`,
  description: null,
  status: "aberto",
  priority: "normal",
  due_date: null,
  tags: [],
  completed_at: null,
  assignees: [],
  counts: { subtasks: 0, subtasks_done: 0, comments: 0, attachments: 0 },
  created_at: "2026-11-01T12:00:00Z",
  updated_at: "2026-11-01T12:00:00Z",
  ...over,
});

const doc = (id: string, over: Partial<ProjectDocument> = {}): ProjectDocument => ({
  id,
  name: `Doc ${id}`,
  url: `https://exemplo.com/${id}`,
  category: "outro",
  pinned: false,
  created_at: "2026-11-01T12:00:00Z",
  ...over,
});

const ids = (list: { id: string }[]) => list.map((i) => i.id);

describe("datas em São Paulo", () => {
  it("hoje é o dia de São Paulo, não o de UTC (02h UTC ainda é o dia anterior)", () => {
    expect(todayInSaoPaulo(new Date("2026-11-05T02:30:00Z"))).toBe("2026-11-04");
    expect(todayInSaoPaulo(new Date("2026-11-05T12:00:00Z"))).toBe("2026-11-05");
    expect(dayInSaoPaulo("2026-11-05T02:30:00Z")).toBe("2026-11-04");
    expect(dayInSaoPaulo("lixo")).toBeNull();
  });

  it("aritmética de dias de calendário", () => {
    expect(daysBetween("2026-11-05", "2026-11-08")).toBe(3);
    expect(daysBetween("2026-11-05", "2026-11-01")).toBe(-4);
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2);
    expect(addDaysIso("2026-11-28", 5)).toBe("2026-12-03");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("formatos dd/mm, dd/mm/aaaa e data com hora no fuso de São Paulo", () => {
    expect(formatDayMonth("2026-11-05")).toBe("05/11");
    expect(formatDate("2026-11-05")).toBe("05/11/2026");
    expect(formatDateTime("2026-11-05T17:30:00Z")).toBe("05/11/2026 14:30");
    expect(formatDateTime("2026-11-05T02:05:00Z")).toBe("04/11/2026 23:05");
    expect(formatDateTime("x")).toBe("");
  });

  it("há quanto tempo, por dias de calendário", () => {
    const now = new Date("2026-11-05T15:00:00Z");
    expect(timeAgo("2026-11-05T12:00:00Z", now)).toBe("hoje");
    // 01h UTC ainda é a noite do dia anterior em São Paulo.
    expect(timeAgo("2026-11-05T01:00:00Z", now)).toBe("há 1 dia");
    expect(timeAgo("2026-11-04T12:00:00Z", now)).toBe("há 1 dia");
    expect(timeAgo("2026-11-01T12:00:00Z", now)).toBe("há 4 dias");
    expect(timeAgo("2026-10-29T12:00:00Z", now)).toBe("há 1 semana");
    expect(timeAgo("2026-10-15T12:00:00Z", now)).toBe("há 3 semanas");
    expect(timeAgo("2026-08-05T12:00:00Z", now)).toBe("há 3 meses");
    expect(timeAgo("2024-11-05T12:00:00Z", now)).toBe("há 2 anos");
    expect(updatedLabel("2026-11-04T12:00:00Z", now)).toBe("Atualizado há 1 dia");
    expect(updatedLabel(undefined, now)).toBe("Sem atividade recente");
  });
});

describe("textos do cartão", () => {
  it("iniciais da capa", () => {
    expect(projectInitials("Campanha Verão")).toBe("CV");
    expect(projectInitials("  acme ")).toBe("A");
    expect(projectInitials("")).toBe("");
  });

  it("Entrega dd/mm ou Sem entrega definida", () => {
    expect(deliveryLabel({ deadline: "2026-12-03" })).toBe("Entrega 03/12");
    expect(deliveryLabel({ deadline: null })).toBe("Sem entrega definida");
  });

  it("X de Y concluídas · N atrasadas, ou Nenhuma tarefa cadastrada", () => {
    expect(taskSummary({ tasks_total: 8, tasks_done: 3, tasks_overdue: 2 })).toEqual({ progress: "3 de 8 concluídas", overdue: "2 atrasadas" });
    expect(taskSummary({ tasks_total: 8, tasks_done: 3, tasks_overdue: 1 }).overdue).toBe("1 atrasada");
    expect(taskSummary({ tasks_total: 8, tasks_done: 3, tasks_overdue: 0 }).overdue).toBeNull();
    expect(taskSummary({ tasks_total: 0, tasks_done: 0, tasks_overdue: 0 }).progress).toBe("Nenhuma tarefa cadastrada");
    expect(taskSummaryText({ tasks_total: 8, tasks_done: 3, tasks_overdue: 2 })).toBe("3 de 8 concluídas · 2 atrasadas");
  });

  it("progresso em % inteiro; sem tarefas não há progresso", () => {
    expect(progressPercent({ tasks_total: 3, progress: 1 / 3 })).toBe(33);
    expect(progressPercent({ tasks_total: 4, progress: 1 })).toBe(100);
    expect(progressPercent({ tasks_total: 0, progress: 0 })).toBeNull();
  });

  it("pendências nunca mostram zero", () => {
    expect(pendingSummary({ tasks_overdue: 0, tasks_blocked: 0 })).toEqual({ value: "Nenhuma pendência crítica", complement: null, alert: false });
    expect(pendingSummary({ tasks_overdue: 1, tasks_blocked: 0 }).value).toBe("1 tarefa atrasada");
    expect(pendingSummary({ tasks_overdue: 3, tasks_blocked: 2 })).toEqual({ value: "3 tarefas atrasadas", complement: "2 bloqueadas", alert: true });
  });

  it("próxima entrega: a tarefa aberta com o prazo mais próximo, 1º nível e mais urgente primeiro", () => {
    const tasks = [
      task("a", { due_date: "2026-11-10", priority: "baixa" }),
      task("b", { due_date: "2026-11-10", priority: "alta" }),
      task("c", { due_date: "2026-11-10", priority: "urgente", parent_task_id: "a" }),
      task("d", { due_date: "2026-11-10", status: "concluido" }),
    ];
    expect(nextDeliveryTask(tasks, "2026-11-10")?.id).toBe("b");
    expect(nextDeliveryTask(tasks, "2026-11-11")).toBeNull();
    expect(nextDeliveryTask(undefined, "2026-11-10")).toBeNull();
    expect(nextDeliveryTask(tasks, null)).toBeNull();
  });

  it("responsável e +N de participantes", () => {
    expect(responsibleLine(project("1"))).toBeNull();
    expect(responsibleLine(project("1", { responsible: person(1, "Ana"), participants: [person(2, "Bia"), person(3, "Caio")] }))).toEqual({
      name: "Ana",
      extra: 2,
      extraNames: "Bia, Caio",
    });
  });

  it("ações de status do menu", () => {
    expect(statusMenuActions("ativo")).toEqual({ canPause: true, canReactivate: false, canArchive: true });
    expect(statusMenuActions("pausado")).toEqual({ canPause: false, canReactivate: true, canArchive: true });
    expect(statusMenuActions("arquivado")).toEqual({ canPause: false, canReactivate: true, canArchive: false });
    expect(isClosedProject("concluido")).toBe(true);
    expect(isClosedProject("pausado")).toBe(false);
  });
});

describe("busca e filtros de projetos", () => {
  const list = [
    project("1", { name: "Lançamento Verão", description: "Coleção nova", responsible: person(7, "Ana Souza"), participants: [person(8, "Bruno")] }),
    project("2", { name: "Rebranding", status: "pausado", health: null, responsible: person(8, "Bruno") }),
    project("3", { name: "Black Friday", health: "em_risco", responsible: person(9, "Carla") }),
    project("4", { name: "Antigo", status: "arquivado", health: null }),
  ];

  it("busca por nome, descrição e responsável (principal ou participante), sem acento e sem caixa", () => {
    expect(ids(filterProjects(list, "lancamento", DEFAULT_PROJECT_FILTERS))).toEqual(["1"]);
    expect(ids(filterProjects(list, "COLEÇÃO", DEFAULT_PROJECT_FILTERS))).toEqual(["1"]);
    expect(ids(filterProjects(list, "carla", DEFAULT_PROJECT_FILTERS))).toEqual(["3"]);
    expect(ids(filterProjects(list, "bruno", DEFAULT_PROJECT_FILTERS))).toEqual(["1", "2"]);
    expect(matchesProjectSearch(list[0], "   ")).toBe(true);
  });

  it("filtros de status, saúde e responsável combinam", () => {
    expect(ids(filterProjects(list, "", { ...DEFAULT_PROJECT_FILTERS, status: "pausado" }))).toEqual(["2"]);
    expect(ids(filterProjects(list, "", { ...DEFAULT_PROJECT_FILTERS, health: "em_risco" }))).toEqual(["3"]);
    expect(ids(filterProjects(list, "", { ...DEFAULT_PROJECT_FILTERS, responsible: "8" }))).toEqual(["1", "2"]);
    expect(ids(filterProjects(list, "", { ...DEFAULT_PROJECT_FILTERS, responsible: "8", status: "ativo" }))).toEqual(["1"]);
    // Projeto sem saúde (não ativo) nunca casa com um filtro de saúde.
    expect(ids(filterProjects(list, "", { ...DEFAULT_PROJECT_FILTERS, health: "saudavel" }))).toEqual(["1"]);
  });

  it("contador de filtros não conta a ordenação e 'limpar' mantém a ordenação", () => {
    expect(countActiveProjectFilters(DEFAULT_PROJECT_FILTERS)).toBe(0);
    expect(countActiveProjectFilters({ status: "ativo", health: "atencao", responsible: "7", sort: "name" })).toBe(3);
    expect(countActiveProjectFilters({ ...DEFAULT_PROJECT_FILTERS, sort: "name" })).toBe(0);
    expect(clearProjectFilters({ status: "ativo", health: "atencao", responsible: "7", sort: "name" })).toEqual({ ...DEFAULT_PROJECT_FILTERS, sort: "name" });
    expect(hasProjectCriteria("", DEFAULT_PROJECT_FILTERS)).toBe(false);
    expect(hasProjectCriteria(" x ", DEFAULT_PROJECT_FILTERS)).toBe(true);
    expect(hasProjectCriteria("", { ...DEFAULT_PROJECT_FILTERS, health: "atencao" })).toBe(true);
  });

  it("responsáveis do filtro: principais e participantes, sem repetir, por nome", () => {
    expect(deriveResponsibles(list).map((r) => [r.id, r.name])).toEqual([
      ["7", "Ana Souza"],
      ["8", "Bruno"],
      ["9", "Carla"],
    ]);
    expect(deriveResponsibles([project("x")])).toEqual([]);
  });
});

describe("ordenação de projetos", () => {
  const list = [
    project("a", { name: "Beta", created_at: "2026-10-01T00:00:00Z", stats: { last_activity_at: "2026-11-03T00:00:00Z", tasks_overdue: 1, progress: 0.5 } }),
    project("b", { name: "Alfa", created_at: "2026-10-03T00:00:00Z", stats: { last_activity_at: "2026-11-04T00:00:00Z", tasks_overdue: 5, progress: 0.9 } }),
    project("c", { name: "Gama", created_at: "2026-10-02T00:00:00Z", stats: { last_activity_at: "2026-11-02T00:00:00Z", tasks_overdue: 0, progress: 0.1 } }),
    project("d", { name: "Delta", created_at: "2026-09-01T00:00:00Z", stats: { tasks_total: 0, tasks_done: 0, tasks_open: 0, last_activity_at: "2026-11-01T00:00:00Z", progress: 0 } }),
  ];

  it("atualizados (padrão), criados, nome, atrasadas", () => {
    expect(ids(sortProjects(list, "updated"))).toEqual(["b", "a", "c", "d"]);
    expect(ids(sortProjects(list, "created"))).toEqual(["b", "c", "a", "d"]);
    expect(ids(sortProjects(list, "name"))).toEqual(["b", "a", "d", "c"]);
    expect(ids(sortProjects(list, "overdue"))).toEqual(["b", "a", "d", "c"]);
  });

  it("progresso: sem tarefas vai para o fim nas duas direções", () => {
    expect(ids(sortProjects(list, "progress_desc"))).toEqual(["b", "a", "c", "d"]);
    expect(ids(sortProjects(list, "progress_asc"))).toEqual(["c", "a", "b", "d"]);
  });

  it("não altera a lista recebida", () => {
    const copy = ids(list);
    sortProjects(list, "name");
    expect(ids(list)).toEqual(copy);
  });
});

describe("agrupamento ativos x encerrados", () => {
  const list = [
    project("1", { name: "Ativo 1" }),
    project("2", { name: "Pausado", status: "pausado" }),
    project("3", { name: "Concluído", status: "concluido" }),
    project("4", { name: "Arquivado", status: "arquivado" }),
  ];

  it("sem filtro de status: concluídos e arquivados saem da grade principal", () => {
    const g = groupProjects(list, DEFAULT_PROJECT_FILTERS);
    expect(ids(g.main).sort()).toEqual(["1", "2"]);
    expect(ids(g.closed).sort()).toEqual(["3", "4"]);
  });

  it("com um status escolhido, tudo aparece junto e nada fica recolhido", () => {
    const g = groupProjects(list.filter((p) => p.status === "arquivado"), { ...DEFAULT_PROJECT_FILTERS, status: "arquivado" });
    expect(ids(g.main)).toEqual(["4"]);
    expect(g.closed).toEqual([]);
  });

  it("cada grupo sai na ordenação escolhida", () => {
    const g = groupProjects(list, { ...DEFAULT_PROJECT_FILTERS, sort: "name" });
    expect(g.main.map((p) => p.name)).toEqual(["Ativo 1", "Pausado"]);
    expect(g.closed.map((p) => p.name)).toEqual(["Arquivado", "Concluído"]);
  });
});

describe("indicadores", () => {
  it("projetos ativos, em risco e soma de tarefas atrasadas", () => {
    const list = [
      project("1", { stats: { tasks_overdue: 2 } }),
      project("2", { health: "em_risco", stats: { tasks_overdue: 3 } }),
      project("3", { status: "pausado", health: null, stats: { tasks_overdue: 1 } }),
    ];
    expect(projectKpis(list)).toEqual({ active: 2, atRisk: 1, overdueTasks: 6 });
    expect(projectKpis([])).toEqual({ active: 0, atRisk: 0, overdueTasks: 0 });
  });
});

describe("filtros e ordenação na URL", () => {
  it("valores inválidos somem e o padrão não entra na URL", () => {
    expect(parseProjectsSearch({ status: "ativo", health: "em_risco", owner: "7", sort: "name" })).toEqual({
      status: "ativo",
      health: "em_risco",
      owner: "7",
      sort: "name",
    });
    expect(parseProjectsSearch({ status: "xx", health: 3, owner: "abc", sort: "foo" })).toEqual({
      status: undefined,
      health: undefined,
      owner: undefined,
      sort: undefined,
    });
    expect(parseProjectsSearch({ owner: 7 }).owner).toBe("7");
    expect(parseProjectsSearch({ sort: "updated" }).sort).toBeUndefined();
  });

  it("ida e volta entre a URL e os filtros", () => {
    const filters = { status: "pausado", health: "atencao", responsible: "7", sort: "overdue" } as const;
    expect(searchToProjectFilters(projectFiltersToSearch(filters))).toEqual(filters);
    expect(projectFiltersToSearch(DEFAULT_PROJECT_FILTERS)).toEqual({ status: undefined, health: undefined, owner: undefined, sort: undefined });
    expect(searchToProjectFilters({})).toEqual(DEFAULT_PROJECT_FILTERS);
  });
});

describe("prazo das tarefas", () => {
  const today = "2026-11-05";

  it("atrasada: aberta com prazo anterior a hoje (concluída nunca)", () => {
    expect(isTaskOverdue({ status: "aberto", due_date: "2026-11-04" }, today)).toBe(true);
    expect(isTaskOverdue({ status: "bloqueada", due_date: "2026-11-04" }, today)).toBe(true);
    expect(isTaskOverdue({ status: "aberto", due_date: "2026-11-05" }, today)).toBe(false);
    expect(isTaskOverdue({ status: "concluido", due_date: "2026-11-01" }, today)).toBe(false);
    expect(isTaskOverdue({ status: "arquivado", due_date: "2026-11-01" }, today)).toBe(false);
    expect(isTaskOverdue({ status: "aberto", due_date: null }, today)).toBe(false);
  });

  it("rótulo do prazo no cartão", () => {
    expect(taskDueLabel({ status: "aberto", due_date: "2026-11-02" }, today)).toEqual({ text: "Atrasada · 3d", overdue: true });
    expect(taskDueLabel({ status: "aberto", due_date: "2026-11-05" }, today)).toEqual({ text: "Hoje", overdue: false });
    expect(taskDueLabel({ status: "em_andamento", due_date: "2026-11-06" }, today)).toEqual({ text: "Amanhã", overdue: false });
    expect(taskDueLabel({ status: "aberto", due_date: "2026-11-20" }, today)).toEqual({ text: "20/11", overdue: false });
    expect(taskDueLabel({ status: "concluido", due_date: "2026-11-01" }, today)).toEqual({ text: "01/11", overdue: false });
    expect(taskDueLabel({ status: "aberto", due_date: null }, today)).toEqual({ text: "", overdue: false });
  });

  it("filtro por período: atrasadas, hoje, semana (amanhã a 7 dias) e sem prazo", () => {
    const at = (due: string | null, status: Task["status"] = "aberto") => ({ status, due_date: due });
    expect(matchesTaskPeriod(at("2026-11-04"), "atrasada", today)).toBe(true);
    expect(matchesTaskPeriod(at("2026-11-05"), "atrasada", today)).toBe(false);
    expect(matchesTaskPeriod(at("2026-11-05"), "hoje", today)).toBe(true);
    expect(matchesTaskPeriod(at("2026-11-06"), "hoje", today)).toBe(false);
    expect(matchesTaskPeriod(at("2026-11-06"), "semana", today)).toBe(true);
    expect(matchesTaskPeriod(at("2026-11-12"), "semana", today)).toBe(true);
    expect(matchesTaskPeriod(at("2026-11-13"), "semana", today)).toBe(false);
    expect(matchesTaskPeriod(at("2026-11-05"), "semana", today)).toBe(false);
    expect(matchesTaskPeriod(at(null), "sem_prazo", today)).toBe(true);
    expect(matchesTaskPeriod(at("2026-11-05"), "sem_prazo", today)).toBe(false);
    // Fechadas só entram em "sem prazo".
    expect(matchesTaskPeriod(at("2026-11-01", "concluido"), "atrasada", today)).toBe(false);
    expect(matchesTaskPeriod(at(null, "concluido"), "sem_prazo", today)).toBe(true);
  });

  it("subtarefas concluídas / total", () => {
    expect(subtaskProgress(task("a", { counts: { subtasks: 3, subtasks_done: 1, comments: 0, attachments: 0 } }))).toBe("1/3");
    expect(subtaskProgress(task("a"))).toBeNull();
  });
});

describe("filtros de tarefas", () => {
  const today = "2026-11-05";
  const ana = { user_id: 7, name: "Ana", avatar: null, is_primary: true };
  const bia = { user_id: 8, name: "Bia", avatar: null, is_primary: false };
  const tasks = [
    task("1", { title: "Roteiro do vídeo", tags: ["video"], priority: "alta", assignees: [ana], due_date: "2026-11-01" }),
    task("2", { title: "Arte do post", tags: ["design", "post"], priority: "normal", assignees: [bia], due_date: "2026-11-05" }),
    task("3", { title: "Relatório", tags: ["video"], priority: "urgente", assignees: [ana, bia] }),
    task("4", { title: "Feito", status: "concluido", due_date: "2026-10-01", assignees: [ana] }),
  ];

  it("busca por título, etiqueta e responsável", () => {
    expect(ids(filterTasks(tasks, "roteiro", DEFAULT_TASK_FILTERS, today))).toEqual(["1"]);
    expect(ids(filterTasks(tasks, "DESIGN", DEFAULT_TASK_FILTERS, today))).toEqual(["2"]);
    expect(ids(filterTasks(tasks, "bia", DEFAULT_TASK_FILTERS, today))).toEqual(["2", "3"]);
  });

  it("dentro de uma categoria vale 'ou'; entre categorias vale 'e'", () => {
    expect(ids(filterTasks(tasks, "", { ...DEFAULT_TASK_FILTERS, tags: ["design", "video"] }, today))).toEqual(["1", "2", "3"]);
    expect(ids(filterTasks(tasks, "", { ...DEFAULT_TASK_FILTERS, tags: ["video"], priorities: ["urgente"] }, today))).toEqual(["3"]);
    expect(ids(filterTasks(tasks, "", { ...DEFAULT_TASK_FILTERS, assignees: ["8"] }, today))).toEqual(["2", "3"]);
    expect(ids(filterTasks(tasks, "", { ...DEFAULT_TASK_FILTERS, periods: ["atrasada", "hoje"] }, today))).toEqual(["1", "2"]);
    expect(ids(filterTasks(tasks, "", { ...DEFAULT_TASK_FILTERS, periods: ["sem_prazo"] }, today))).toEqual(["3"]);
  });

  it("opções de responsável e etiqueta derivadas das tarefas", () => {
    expect(deriveTaskAssignees(tasks).map((a) => a.name)).toEqual(["Ana", "Bia"]);
    expect(deriveTaskTags(tasks)).toEqual(["design", "post", "video"]);
  });
});

describe("ordenação de tarefas", () => {
  const tasks = [
    task("a", { title: "Beta", priority: "baixa", due_date: "2026-11-10", created_at: "2026-11-01T00:00:00Z" }),
    task("b", { title: "Alfa", priority: "urgente", due_date: null, created_at: "2026-11-03T00:00:00Z" }),
    task("c", { title: "Gama", priority: "alta", due_date: "2026-11-08", created_at: "2026-11-02T00:00:00Z" }),
    task("d", { title: "Delta", priority: "alta", due_date: "2026-11-08", created_at: "2026-11-04T00:00:00Z" }),
  ];

  it("sem critério mantém a ordem recebida", () => {
    expect(ids(sortTasks(tasks, "none"))).toEqual(["a", "b", "c", "d"]);
  });

  it("prazo: sem prazo sempre por último, nas duas direções", () => {
    expect(ids(sortTasks(tasks, "dueDate_asc"))).toEqual(["c", "d", "a", "b"]);
    expect(ids(sortTasks(tasks, "dueDate_desc"))).toEqual(["a", "c", "d", "b"]);
  });

  it("prioridade e o secundário só como desempate", () => {
    expect(ids(sortTasks(tasks, "priority_desc", "title_asc"))).toEqual(["b", "d", "c", "a"]);
    expect(ids(sortTasks(tasks, "priority_asc", "createdAt_desc"))).toEqual(["a", "d", "c", "b"]);
  });

  it("criação e nome", () => {
    expect(ids(sortTasks(tasks, "createdAt_desc"))).toEqual(["d", "b", "c", "a"]);
    expect(ids(sortTasks(tasks, "title_asc"))).toEqual(["b", "a", "d", "c"]);
    expect(ids(sortTasks(tasks, "title_desc"))).toEqual(["c", "d", "a", "b"]);
    expect(taskSortCategory("priority_desc")).toBe("priority");
    expect(taskSortCategory("none")).toBeNull();
  });
});

describe("quadro (colunas)", () => {
  const tasks = [
    task("1", { status: "aberto" }),
    task("2", { status: "aberto", parent_task_id: "1" }),
    task("3", { status: "concluido" }),
  ];

  it("uma coluna por status, só 1º nível por padrão", () => {
    const g = groupTasksByStatus(tasks);
    expect(Object.keys(g)).toEqual(["aberto", "em_andamento", "em_aprovacao", "em_ajustes", "aprovado", "bloqueada", "concluido", "arquivado"]);
    expect(ids(g.aberto)).toEqual(["1"]);
    expect(ids(g.concluido)).toEqual(["3"]);
    expect(g.bloqueada).toEqual([]);
  });

  it("com 'exibir subtarefas', a subtarefa entra na coluna do próprio status", () => {
    expect(ids(groupTasksByStatus(tasks, { includeSubtasks: true }).aberto)).toEqual(["1", "2"]);
  });

  it("Concluído: as mais recentes primeiro quando pedido (o limite de 4 não esconde as últimas)", () => {
    const done = [
      task("old", { status: "concluido", completed_at: "2026-10-01T10:00:00Z" }),
      task("new", { status: "concluido", completed_at: "2026-11-04T10:00:00Z" }),
      task("mid", { status: "concluido", completed_at: "2026-10-20T10:00:00Z" }),
    ];
    expect(ids(groupTasksByStatus(done).concluido)).toEqual(["old", "new", "mid"]);
    expect(ids(groupTasksByStatus(done, { recentDoneFirst: true }).concluido)).toEqual(["new", "mid", "old"]);
  });

  it("limite por coluna com Ver mais, sem perder nada", () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(columnView(items, false)).toEqual({ visible: [1, 2, 3, 4], hiddenCount: 2, canCollapse: false });
    expect(columnView(items, true)).toEqual({ visible: items, hiddenCount: 0, canCollapse: true });
    expect(columnView([1, 2], true).canCollapse).toBe(false);
  });
});

describe("preferência de ordenação por projeto", () => {
  afterEach(() => localStorage.clear());

  it("grava e lê por projeto; valor inválido volta ao padrão", () => {
    expect(readStoredTaskSort("p1")).toEqual({ primary: "none", secondary: "none" });
    writeStoredTaskSort("p1", { primary: "dueDate_asc", secondary: "priority_desc" });
    expect(readStoredTaskSort("p1")).toEqual({ primary: "dueDate_asc", secondary: "priority_desc" });
    expect(readStoredTaskSort("p2")).toEqual({ primary: "none", secondary: "none" });
    localStorage.setItem("agency-projects:task-sort:p3", JSON.stringify({ primary: "xx", secondary: "title_asc" }));
    expect(readStoredTaskSort("p3")).toEqual({ primary: "none", secondary: "none" });
    localStorage.setItem("agency-projects:task-sort:p4", "{quebrado");
    expect(readStoredTaskSort("p4")).toEqual({ primary: "none", secondary: "none" });
    // Desempate da mesma categoria do principal não vale.
    localStorage.setItem("agency-projects:task-sort:p5", JSON.stringify({ primary: "dueDate_asc", secondary: "dueDate_desc" }));
    expect(readStoredTaskSort("p5")).toEqual({ primary: "dueDate_asc", secondary: "none" });
  });
});

describe("documentos", () => {
  it("origem do link pelo domínio", () => {
    expect(detectDocumentSource("https://docs.google.com/document/d/1/edit")).toBe("google_docs");
    expect(detectDocumentSource("https://docs.google.com/spreadsheets/d/1/edit")).toBe("google_sheets");
    expect(detectDocumentSource("https://docs.google.com/presentation/d/1/edit")).toBe("google_slides");
    expect(detectDocumentSource("https://drive.google.com/file/d/1")).toBe("google_drive");
    expect(detectDocumentSource("https://www.figma.com/file/abc")).toBe("figma");
    expect(detectDocumentSource("https://miro.com/app/board/1")).toBe("miro");
    expect(detectDocumentSource("https://www.notion.so/pagina")).toBe("notion");
    expect(detectDocumentSource("https://time.notion.site/pagina")).toBe("notion");
    expect(detectDocumentSource("https://www.canva.com/design/1")).toBe("canva");
    expect(detectDocumentSource("https://exemplo.com")).toBe("link");
    // Domínio parecido não engana.
    expect(detectDocumentSource("https://figma.com.golpe.io/x")).toBe("link");
    expect(detectDocumentSource("https://meufigma.com/x")).toBe("link");
    expect(detectDocumentSource("não é url")).toBe("link");
  });

  it("todo tipo de origem tem rótulo e ícone", () => {
    for (const source of Object.keys(DOCUMENT_SOURCE_LABEL) as (keyof typeof DOCUMENT_SOURCE_LABEL)[]) {
      expect(DOCUMENT_SOURCE_LABEL[source]).toBeTruthy();
      expect(DOCUMENT_SOURCE_ICON[source]).toBeTruthy();
    }
    expect(DOCUMENT_SOURCE_LABEL.figma).toBe("Figma");
  });

  it("endereço normalizado: https por padrão, só http/https, sem espaço", () => {
    expect(normalizeDocumentUrl("  exemplo.com/briefing ")).toBe("https://exemplo.com/briefing");
    expect(normalizeDocumentUrl("http://exemplo.com")).toBe("http://exemplo.com");
    expect(normalizeDocumentUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("https://exemplo.com/a")).toBe("https://exemplo.com/a");
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("não é url")).toBeUndefined();
    expect(normalizeDocumentUrl("ftp://exemplo.com")).toBeNull();
    // O banco exige `http(s)://` e a API recusa usuário/senha no endereço.
    expect(normalizeDocumentUrl("https:exemplo.com")).toBeNull();
    expect(normalizeDocumentUrl("https://usuario:senha@exemplo.com/x")).toBeNull();
    expect(normalizeDocumentUrl("exemplo")).toBeNull();
    expect(normalizeDocumentUrl("exemplo .com")).toBeNull();
    expect(normalizeDocumentUrl("")).toBeNull();
    expect(normalizeDocumentUrl(`https://exemplo.com/${"a".repeat(2000)}`)).toBeNull();
  });

  it("busca e categoria; agrupamento na ordem do contrato com fixados primeiro", () => {
    const docs = [
      doc("1", { name: "Briefing geral", category: "briefing" }),
      doc("2", { name: "Contrato Acme", category: "contrato" }),
      doc("3", { name: "Briefing extra", category: "briefing", pinned: true }),
      doc("4", { name: "Moodboard", category: "referencia", url: "https://figma.com/moodboard" }),
    ];
    expect(ids(filterDocuments(docs, { query: "briefing", category: "all" }))).toEqual(["1", "3"]);
    expect(ids(filterDocuments(docs, { query: "figma", category: "all" }))).toEqual(["4"]);
    expect(ids(filterDocuments(docs, { query: "", category: "contrato" }))).toEqual(["2"]);
    const groups = groupDocumentsByCategory(docs);
    expect(groups.map((g) => [g.label, ids(g.items)])).toEqual([
      ["Briefing", ["3", "1"]],
      ["Contrato", ["2"]],
      ["Referência", ["4"]],
    ]);
  });
});

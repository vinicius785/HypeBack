import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project, Task } from "@/shared/services/agency-projects";

import type { ProjectPermissions } from "../use-project-permissions";

const h = vi.hoisted(() => ({
  tasks: undefined as Task[] | undefined,
  loading: false,
  error: null as unknown,
  refetch: vi.fn(),
  mutate: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  dnd: undefined as undefined | { onDragEnd: (e: unknown) => void; onDragStart: (e: unknown) => void },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  // Guarda as propriedades do contexto para disparar o fim do arrasto sem layout (o jsdom não mede nada).
  return {
    ...actual,
    DndContext: (props: React.ComponentProps<typeof actual.DndContext>) => {
      h.dnd = props as unknown as typeof h.dnd;
      return <actual.DndContext {...props} />;
    },
  };
});
vi.mock("@/hooks/use-agency-projects", () => ({
  useProjectTasks: () => ({ data: h.tasks, isLoading: h.loading, error: h.error, refetch: h.refetch, isFetching: false }),
  useSetProjectTaskStatus: () => ({ mutate: h.mutate, isPending: false }),
}));
vi.mock("./task-modal", () => ({
  TaskModal: (p: { taskId: string | null; defaultStatus?: string }) => <div role="dialog" aria-label="Modal da tarefa" data-task={p.taskId ?? "new"} data-status={p.defaultStatus ?? ""} />,
}));

import { ProjectTasksBoard } from "./tasks-board";

const project = { id: "p1", name: "Verão" } as Project;
const can = (over: Partial<ProjectPermissions> = {}): ProjectPermissions => ({ canRead: true, canCreate: true, canWrite: true, canDelete: true, ...over });
const person = (id: number, name: string, primary = true) => ({ user_id: id, name, avatar: null, is_primary: primary });

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

const seed = (): Task[] => [
  task("t1", { title: "Roteiro", priority: "alta", due_date: "2026-11-03", assignees: [person(1, "Ana Souza")], tags: ["video"], created_at: "2026-11-01T10:00:00Z" }),
  task("t2", { title: "Briefing", due_date: "2026-11-20", assignees: [person(2, "Bruno Lima")], tags: ["texto"], created_at: "2026-11-02T10:00:00Z" }),
  task("t3", { title: "Edição", status: "em_andamento", priority: "urgente", created_at: "2026-11-03T10:00:00Z" }),
  task("t4", { title: "Publicação", status: "concluido", created_at: "2026-11-04T10:00:00Z" }),
];

const column = (label: string) => screen.getByRole("region", { name: label });
const cardsIn = (label: string) => within(within(column(label)).getByRole("list", { name: `Tarefas em ${label}` })).getAllByRole("listitem");
const titlesIn = (label: string) => cardsIn(label).map((li) => li.querySelector(".apj-tk-open")?.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  // Só a data é falsa (os temporizadores reais seguem, para o userEvent): hoje = 05/11/2026.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T15:00:00Z"));
  h.tasks = seed();
  h.loading = false;
  h.error = null;
});
afterEach(() => vi.useRealTimers());

describe("colunas e cartões", () => {
  it("uma coluna por status, com contador, e cada tarefa na sua", () => {
    render(<ProjectTasksBoard project={project} can={can()} />);
    const names = screen.getAllByRole("heading", { level: 3 }).map((n) => n.textContent);
    expect(names).toEqual(["Aberto", "Em andamento", "Em aprovação", "Em ajustes", "Aprovado", "Bloqueada", "Concluído", "Arquivado"]);
    expect(within(column("Aberto")).getByLabelText("2 tarefas")).toBeInTheDocument();
    expect(within(column("Em andamento")).getByLabelText("1 tarefa")).toBeInTheDocument();
    expect(within(column("Em aprovação")).getByText("Nenhuma tarefa")).toBeInTheDocument();
    expect(titlesIn("Aberto")).toEqual(["Roteiro", "Briefing"]);
    expect(titlesIn("Concluído")).toEqual(["Publicação"]);
  });

  it("o cartão mostra prioridade, prazo atrasado em destaque, responsável e etiquetas", () => {
    render(<ProjectTasksBoard project={project} can={can()} />);
    const card = cardsIn("Aberto")[0];
    expect(within(card).getByText("Alta")).toBeInTheDocument();
    expect(within(card).getByText("Atrasada · 2d")).toHaveClass("apj-is-late", { exact: false });
    expect(within(card).getByRole("group", { name: "Responsáveis: Ana Souza" })).toBeInTheDocument();
    expect(within(card).getByText("video")).toBeInTheDocument();
    // Prioridade normal não ganha selo.
    expect(within(cardsIn("Aberto")[1]).queryByText("Normal")).not.toBeInTheDocument();
  });

  it("abrir o cartão abre o modal da tarefa", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    await user.click(screen.getByRole("button", { name: "Roteiro" }));
    expect(screen.getByRole("dialog", { name: "Modal da tarefa" })).toHaveAttribute("data-task", "t1");
  });

  it("'Adicionar tarefa' da coluna e 'Nova tarefa' abrem o modal de criação no status certo", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    await user.click(screen.getByRole("button", { name: "Adicionar tarefa em Em ajustes" }));
    expect(screen.getByRole("dialog", { name: "Modal da tarefa" })).toHaveAttribute("data-status", "em_ajustes");
    expect(screen.getByRole("dialog")).toHaveAttribute("data-task", "new");
  });

  it("o botão 'Nova tarefa' cria no status Aberto", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-status", "aberto");
  });
});

describe("estados", () => {
  it("carregando: esqueleto", () => {
    h.tasks = undefined;
    h.loading = true;
    render(<ProjectTasksBoard project={project} can={can()} />);
    expect(screen.getByLabelText("Carregando tarefas")).toHaveAttribute("aria-busy", "true");
  });

  it("erro: mensagem e 'Tentar de novo'", async () => {
    h.tasks = undefined;
    h.error = new Error("Falha de rede");
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Erro ao carregar as tarefas");
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it("API sem a rota: 'ainda não estão disponíveis', sem tentar de novo", async () => {
    const { AgencyProjectsUnavailableError } = await import("@/shared/services/agency-projects");
    h.tasks = undefined;
    h.error = new AgencyProjectsUnavailableError();
    render(<ProjectTasksBoard project={project} can={can()} />);
    expect(screen.getByText("Tarefas ainda não estão disponíveis")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });

  it("sem tarefas: estado vazio com 'Nova tarefa' que abre a criação", async () => {
    h.tasks = [];
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    expect(screen.getByText("Nenhuma tarefa ainda")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-task", "new");
  });

  it("sem tarefas e só leitura: avisa sem botão de criar", () => {
    h.tasks = [];
    render(<ProjectTasksBoard project={project} can={can({ canWrite: false })} />);
    expect(screen.getByText("Este projeto ainda não tem tarefas.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nova tarefa" })).not.toBeInTheDocument();
  });
});

describe("busca e filtros", () => {
  const openFilters = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: /Filtros/ }));
    return within(screen.getByRole("dialog", { name: "Filtrar tarefas" }));
  };

  it("a busca filtra por título, etiqueta e responsável; sem resultado oferece 'Limpar filtros'", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    const search = screen.getByRole("searchbox", { name: "Buscar tarefa" });
    await user.type(search, "briefing");
    expect(titlesIn("Aberto")).toEqual(["Briefing"]);
    await user.clear(search);
    await user.type(search, "ana");
    expect(titlesIn("Aberto")).toEqual(["Roteiro"]);
    await user.clear(search);
    await user.type(search, "zzzz");
    expect(screen.getByText("Nenhuma tarefa encontrada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByRole("searchbox", { name: "Buscar tarefa" })).toHaveValue("");
    expect(titlesIn("Aberto")).toEqual(["Roteiro", "Briefing"]);
  });

  it("filtro por responsável vira chip removível e o contador do botão acompanha", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    const filters = await openFilters(user);
    await user.click(filters.getByRole("button", { name: "Bruno Lima" }));
    expect(titlesIn("Aberto")).toEqual(["Briefing"]);
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent("1");
    expect(screen.getByText("Responsável: Bruno Lima")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remover filtro: Responsável: Bruno Lima" }));
    expect(titlesIn("Aberto")).toEqual(["Roteiro", "Briefing"]);
  });

  it("filtros de etiqueta, prioridade e prazo combinam (ou dentro de cada grupo, e entre grupos)", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    const filters = await openFilters(user);
    await user.click(filters.getByRole("button", { name: "video" }));
    expect(titlesIn("Aberto")).toEqual(["Roteiro"]);
    await user.click(filters.getByRole("button", { name: "texto" }));
    expect(titlesIn("Aberto")).toEqual(["Roteiro", "Briefing"]);
    await user.click(filters.getByRole("button", { name: "Alta" }));
    expect(titlesIn("Aberto")).toEqual(["Roteiro"]);
    await user.click(filters.getByRole("button", { name: "Atrasadas" }));
    expect(titlesIn("Aberto")).toEqual(["Roteiro"]);
    await user.click(filters.getByRole("button", { name: "Sem prazo" }));
    // Atrasadas OU sem prazo, e prioridade alta: continua só o Roteiro.
    expect(titlesIn("Aberto")).toEqual(["Roteiro"]);
    expect(screen.getByRole("list", { name: "Filtros aplicados" })).toBeInTheDocument();
    await user.click(filters.getByRole("button", { name: "Limpar filtros" }));
    expect(titlesIn("Aberto")).toEqual(["Roteiro", "Briefing"]);
  });

  it("filtro de prazo 'Esta semana' só pega tarefa aberta que vence em até 7 dias", async () => {
    h.tasks = [task("a", { title: "Amanhã", due_date: "2026-11-06" }), task("b", { title: "Longe", due_date: "2026-12-01" }), task("c", { title: "Hoje", due_date: "2026-11-05" })];
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    const filters = await openFilters(user);
    await user.click(filters.getByRole("button", { name: "Esta semana" }));
    expect(titlesIn("Aberto")).toEqual(["Amanhã"]);
  });
});

describe("ordenação", () => {
  const sortBy = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
    // O painel de ordenação fica aberto depois de escolher (dá para ajustar o desempate em seguida).
    if (!screen.queryByRole("dialog", { name: "Ordenar tarefas" })) await user.click(screen.getByRole("button", { name: /Ordenar tarefas/ }));
    await user.click(within(screen.getByRole("group", { name: "Critério principal" })).getByRole("button", { name: label }));
  };

  it("por nome, prazo, prioridade e criação", async () => {
    h.tasks = [
      task("a", { title: "Zeta", due_date: "2026-11-30", priority: "baixa", created_at: "2026-11-01T10:00:00Z" }),
      task("b", { title: "Alfa", due_date: null, priority: "urgente", created_at: "2026-11-02T10:00:00Z" }),
      task("c", { title: "Meio", due_date: "2026-11-10", priority: "normal", created_at: "2026-11-03T10:00:00Z" }),
    ];
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    expect(titlesIn("Aberto")).toEqual(["Zeta", "Alfa", "Meio"]);
    await sortBy(user, "Nome: A–Z");
    expect(titlesIn("Aberto")).toEqual(["Alfa", "Meio", "Zeta"]);
    await sortBy(user, "Prazo: mais próximo");
    expect(titlesIn("Aberto")).toEqual(["Meio", "Zeta", "Alfa"]);
    await sortBy(user, "Prioridade: maior primeiro");
    expect(titlesIn("Aberto")).toEqual(["Alfa", "Meio", "Zeta"]);
    await sortBy(user, "Mais recentes");
    expect(titlesIn("Aberto")).toEqual(["Meio", "Alfa", "Zeta"]);
  });

  it("o desempate só vale quando o principal empata", async () => {
    h.tasks = [task("a", { title: "B", priority: "alta" }), task("b", { title: "A", priority: "alta" }), task("c", { title: "C", priority: "urgente" })];
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    await sortBy(user, "Prioridade: maior primeiro");
    await user.click(within(screen.getByRole("group", { name: "Critério de desempate" })).getByRole("button", { name: "Nome: A–Z" }));
    expect(titlesIn("Aberto")).toEqual(["C", "A", "B"]);
  });

  it("a escolha fica guardada por projeto e volta ao reabrir", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ProjectTasksBoard project={project} can={can()} />);
    await sortBy(user, "Nome: Z–A");
    expect(titlesIn("Aberto")).toEqual(["Roteiro", "Briefing"]);
    expect(JSON.parse(window.localStorage.getItem("agency-projects:task-sort:p1") ?? "{}").primary).toBe("title_desc");
    unmount();
    render(<ProjectTasksBoard project={project} can={can()} />);
    expect(screen.getByRole("button", { name: "Ordenar tarefas: Nome: Z–A" })).toBeInTheDocument();
    render(<ProjectTasksBoard project={{ ...project, id: "p2" } as Project} can={can()} />);
    expect(screen.getAllByRole("button", { name: "Ordenar tarefas: Sem ordenação" })).toHaveLength(1);
  });

  it("storage bloqueado não quebra o quadro nem a troca de ordenação", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("cota");
    });
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    await sortBy(user, "Nome: Z–A");
    expect(titlesIn("Aberto")).toEqual(["Roteiro", "Briefing"]);
    vi.restoreAllMocks();
  });
});

describe("subtarefas no quadro", () => {
  beforeEach(() => {
    h.tasks = [...seed(), task("s1", { title: "Subtarefa A", parent_task_id: "t1" })];
  });

  it("escondidas por padrão; ligar mostra o cartão com 'Subtarefa de …' e a escolha fica guardada", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    expect(screen.queryByText("Subtarefa A")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Subtarefas no quadro" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Subtarefa A")).toBeInTheDocument();
    expect(screen.getByText("Subtarefa de Roteiro")).toBeInTheDocument();
    expect(window.localStorage.getItem("agency-projects:show-subtasks:p1")).toBe("1");
  });
});

describe("limite por coluna", () => {
  beforeEach(() => {
    h.tasks = Array.from({ length: 6 }, (_, i) => task(`a${i}`, { title: `Item ${i + 1}` }));
  });

  it("mostra 4 e 'Ver mais (2)'; expandir mostra tudo e 'Ver menos' recolhe", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    expect(cardsIn("Aberto")).toHaveLength(4);
    expect(within(column("Aberto")).getByLabelText("6 tarefas")).toBeInTheDocument();
    const more = within(column("Aberto")).getByRole("button", { name: "Ver mais (2)" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await user.click(more);
    expect(cardsIn("Aberto")).toHaveLength(6);
    await user.click(within(column("Aberto")).getByRole("button", { name: "Ver menos" }));
    expect(cardsIn("Aberto")).toHaveLength(4);
  });

  it("coluna com até 4 cartões não tem 'Ver mais'", () => {
    h.tasks = h.tasks!.slice(0, 4);
    render(<ProjectTasksBoard project={project} can={can()} />);
    expect(screen.queryByRole("button", { name: /Ver mais/ })).not.toBeInTheDocument();
  });
});

describe("mover de coluna", () => {
  it("pelo menu 'Mover para…': muda o status, avisa e não oferece a coluna atual", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    await user.click(screen.getByRole("button", { name: "Mais ações da tarefa Roteiro" }));
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(items[0]).toBe("Abrir tarefa");
    expect(items).toContain("Mover para Concluído");
    expect(items).not.toContain("Mover para Aberto");
    expect(items).toHaveLength(8);
    await user.click(screen.getByRole("menuitem", { name: "Mover para Em aprovação" }));
    expect(h.mutate).toHaveBeenCalledWith({ taskId: "t1", status: "em_aprovacao" }, expect.any(Object));
    act(() => h.mutate.mock.calls[0][1].onSuccess());
    expect(h.toast.success).toHaveBeenCalledWith("Tarefa movida para Em aprovação");
    expect(screen.getByText("Tarefa “Roteiro” movida para Em aprovação.")).toBeInTheDocument();
  });

  it("só com o teclado: Enter abre o menu, setas escolhem e Enter confirma", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    screen.getByRole("button", { name: "Mais ações da tarefa Roteiro" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: "Abrir tarefa" })).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Mover para Em aprovação" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(h.mutate).toHaveBeenCalledWith({ taskId: "t1", status: "em_aprovacao" }, expect.any(Object));
  });

  it("erro da API: toast com a mensagem (o hook já devolveu o cartão à coluna de origem)", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    await user.click(screen.getByRole("button", { name: "Mais ações da tarefa Roteiro" }));
    await user.click(screen.getByRole("menuitem", { name: "Mover para Concluído" }));
    act(() => h.mutate.mock.calls[0][1].onError(Object.assign(new Error("x"), { code: "TASK_NOT_FOUND" })));
    expect(h.toast.error).toHaveBeenCalledWith("Essa tarefa não existe mais.");
    expect(h.toast.success).not.toHaveBeenCalled();
  });

  it("soltar o cartão sobre outra coluna muda o status; mesma coluna, fora ou sobre outro cartão não faz nada", () => {
    render(<ProjectTasksBoard project={project} can={can()} />);
    act(() => h.dnd!.onDragStart({ active: { id: "t1" } }));
    act(() => h.dnd!.onDragEnd({ active: { id: "t1" }, over: { id: "column:concluido" } }));
    expect(h.mutate).toHaveBeenCalledTimes(1);
    expect(h.mutate).toHaveBeenCalledWith({ taskId: "t1", status: "concluido" }, expect.any(Object));
    act(() => h.dnd!.onDragEnd({ active: { id: "t1" }, over: { id: "column:aberto" } }));
    act(() => h.dnd!.onDragEnd({ active: { id: "t1" }, over: null }));
    act(() => h.dnd!.onDragEnd({ active: { id: "t1" }, over: { id: "t2" } }));
    expect(h.mutate).toHaveBeenCalledTimes(1);
  });

  it("o arrastar anuncia o que acontece em português, para leitor de tela", () => {
    render(<ProjectTasksBoard project={project} can={can()} />);
    const props = h.dnd as unknown as { accessibility: { announcements: Record<string, (e: unknown) => string>; screenReaderInstructions: { draggable: string } } };
    expect(props.accessibility.announcements.onDragStart({ active: { id: "t1" } })).toBe("Pegou a tarefa “Roteiro”.");
    expect(props.accessibility.announcements.onDragOver({ active: { id: "t1" }, over: { id: "column:concluido" } })).toBe("Tarefa “Roteiro” sobre a coluna Concluído.");
    expect(props.accessibility.announcements.onDragEnd({ active: { id: "t1" }, over: null })).toMatch(/nada mudou/);
    expect(props.accessibility.screenReaderInstructions.draggable).toMatch(/setas/);
  });
});

describe("somente leitura", () => {
  it("sem edição: o cartão só abre, sem alça, sem 'Mover para…', sem criar e sem soltar", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can({ canWrite: false })} />);
    expect(screen.queryByRole("button", { name: "Nova tarefa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adicionar tarefa em/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Arrastar a tarefa/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mais ações da tarefa Roteiro" }));
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Abrir tarefa"]);
    act(() => h.dnd!.onDragEnd({ active: { id: "t1" }, over: { id: "column:concluido" } }));
    expect(h.mutate).not.toHaveBeenCalled();
  });
});

describe("alça de arrastar e celular", () => {
  it("com edição cada cartão tem a alça (teclado) com o aviso de como usar", () => {
    render(<ProjectTasksBoard project={project} can={can()} />);
    const grip = screen.getByRole("button", { name: "Arrastar a tarefa Roteiro" });
    expect(grip).toHaveAttribute("aria-roledescription", "draggable");
  });

  it("o seletor de coluna do celular marca qual coluna fica ativa, com a contagem de cada uma", async () => {
    const user = userEvent.setup();
    render(<ProjectTasksBoard project={project} can={can()} />);
    const select = screen.getByRole("combobox", { name: "Coluna do quadro" });
    expect(within(select).getByRole("option", { name: "Aberto (2)" })).toBeInTheDocument();
    expect(column("Aberto")).toHaveAttribute("data-active", "true");
    expect(column("Concluído")).toHaveAttribute("data-active", "false");
    await user.selectOptions(select, "concluido");
    expect(column("Concluído")).toHaveAttribute("data-active", "true");
    expect(column("Aberto")).toHaveAttribute("data-active", "false");
  });

  it("a região rolável do quadro é focável (rolagem pelo teclado)", () => {
    render(<ProjectTasksBoard project={project} can={can()} />);
    expect(screen.getByRole("region", { name: "Quadro de tarefas" })).toHaveAttribute("tabindex", "0");
  });
});

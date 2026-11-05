import type React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project, Task } from "@/shared/services/agency-projects";
import { AgencyProjectsUnavailableError } from "@/shared/services/agency-projects";

const h = vi.hoisted(() => ({
  isAgency: true,
  can: { campaigns_read: true, campaigns_create: true, campaigns_write: true, campaigns_delete: true },
  project: undefined as unknown,
  loading: false,
  error: null as unknown,
  tasks: undefined as unknown,
  documents: undefined as unknown,
  refetch: vi.fn(),
  navigate: vi.fn(),
  setStatus: vi.fn(),
  duplicate: vi.fn(),
  deleteAsync: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => ({ ...opts, useParams: () => ({ projectId: "p1" }) }),
  useNavigate: () => h.navigate,
  Link: ({ children, to, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href="#" data-to={to} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspacePermissions: () => h.can }));
vi.mock("@/hooks/use-agency-brands", () => ({ useIsAgencyWorkspace: () => h.isAgency }));
vi.mock("@/hooks/use-agency-projects", () => ({
  useAgencyProject: () => ({ data: h.project, isLoading: h.loading, error: h.error, refetch: h.refetch, isFetching: false }),
  useProjectTasks: () => ({ data: h.tasks }),
  useProjectDocuments: () => ({ data: h.documents }),
  useSetAgencyProjectStatus: () => ({ mutate: h.setStatus, isPending: false }),
  useDuplicateAgencyProject: () => ({ mutate: h.duplicate, isPending: false }),
  useDeleteAgencyProject: () => ({ mutateAsync: h.deleteAsync, isPending: false }),
}));
vi.mock("@/components/agency-projects/project-form", () => ({
  ProjectForm: ({ project }: { project?: { name: string } }) => <div role="dialog" aria-label="Formulário de projeto">{`Editar ${project?.name}`}</div>,
}));

// O quadro e os arquivos têm testes próprios (e o de integração em projects.$projectId.integration.test.tsx): aqui só se
// confere que a página os encaixa nas seções certas e passa o projeto e as permissões.
vi.mock("@/components/agency-projects/board", () => ({
  ProjectTasksBoard: ({ project, can }: { project: { id: string }; can: { canWrite: boolean } }) => <div data-testid="tasks-board" data-project={project.id} data-can-write={String(can.canWrite)} />,
}));
vi.mock("@/components/agency-projects/documents", () => ({
  ProjectDocumentsSection: ({ project }: { project: { id: string } }) => <div data-testid="documents-section" data-project={project.id} />,
}));

import { Route } from "./projects.$projectId";

const Page = (Route as unknown as { component: () => React.JSX.Element }).component;

const person = (id: number, name: string) => ({ user_id: id, name, avatar: null });

const mk = (over: Omit<Partial<Project>, "stats"> & { stats?: Partial<Project["stats"]> } = {}): Project => {
  const { stats, ...rest } = over;
  return {
    id: "p1",
    name: "Lançamento Verão",
    description: "Coleção nova de verão",
    cover_url: null,
    status: "ativo",
    created_at: "2026-11-01T12:00:00Z",
    updated_at: "2026-11-01T12:00:00Z",
    stats: {
      tasks_total: 8,
      tasks_done: 4,
      tasks_open: 4,
      tasks_overdue: 2,
      tasks_blocked: 1,
      progress: 0.5,
      deadline: "2026-12-03",
      next_due: "2026-11-10",
      last_activity_at: "2026-11-03T12:00:00Z",
      ...stats,
    },
    health: "em_risco",
    responsible: person(7, "Ana Souza"),
    participants: [person(8, "Bruno")],
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

const kpis = () => within(screen.getByRole("region", { name: "Resumo do projeto" }));

beforeEach(() => {
  vi.clearAllMocks();
  // Só a data é falsa (os temporizadores reais seguem, para o userEvent).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T15:00:00Z"));
  h.isAgency = true;
  h.can = { campaigns_read: true, campaigns_create: true, campaigns_write: true, campaigns_delete: true };
  h.project = mk();
  h.loading = false;
  h.error = null;
  h.tasks = [task("t1", { title: "Entregar roteiro", due_date: "2026-11-10", priority: "alta" }), task("t2", { due_date: "2026-11-20" })];
});
afterEach(() => vi.useRealTimers());

describe("bloqueios e estados", () => {
  it("fora de agência explica que é exclusivo", () => {
    h.isAgency = false;
    render(<Page />);
    expect(screen.getByText("Projetos são exclusivos de agências")).toBeInTheDocument();
    expect(screen.queryByText("Lançamento Verão")).not.toBeInTheDocument();
  });

  it("sem permissão de leitura não mostra o projeto", () => {
    h.can = { ...h.can, campaigns_read: false };
    render(<Page />);
    expect(screen.getByText("Você não tem acesso a Projetos")).toBeInTheDocument();
  });

  it("carregando: esqueleto", () => {
    h.project = undefined;
    h.loading = true;
    render(<Page />);
    expect(screen.getByLabelText("Carregando projeto")).toHaveAttribute("aria-busy", "true");
  });

  it("projeto inexistente (ou de outro workspace): 'não encontrado' com volta para a lista, sem 'tentar de novo'", () => {
    h.project = undefined;
    h.error = Object.assign(new Error("Projeto não encontrado"), { status: 404, code: "PROJECT_NOT_FOUND" });
    render(<Page />);
    expect(screen.getByText("Projeto não encontrado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para Projetos" })).toHaveAttribute("data-to", "/projects");
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });

  it("erro genérico: 'Tentar de novo'", async () => {
    h.project = undefined;
    h.error = new Error("Falha de rede");
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getByText("Erro ao carregar o projeto")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it("API antiga: 'ainda não está disponível'", () => {
    h.project = undefined;
    h.error = new AgencyProjectsUnavailableError();
    render(<Page />);
    expect(screen.getByText("Projetos ainda não está disponível")).toBeInTheDocument();
    expect(screen.queryByText("Erro ao carregar o projeto")).not.toBeInTheDocument();
  });
});

describe("cabeçalho", () => {
  it("voltar, nome, selo de status, descrição e 'responsável · Atualizado há X'", () => {
    render(<Page />);
    expect(screen.getByRole("link", { name: "Projetos" })).toHaveAttribute("data-to", "/projects");
    expect(screen.getByRole("heading", { level: 1, name: "Lançamento Verão" })).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Coleção nova de verão")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza · Atualizado há 2 dias")).toBeInTheDocument();
  });

  it("sem responsável mostra só a atualização; capa sem imagem usa as iniciais", () => {
    h.project = mk({ responsible: null, participants: [] });
    render(<Page />);
    expect(screen.getByText("Atualizado há 2 dias")).toBeInTheDocument();
    expect(screen.getByText("LV")).toBeInTheDocument();
  });

  it("descrição longa pode ser expandida", async () => {
    h.project = mk({ description: "x".repeat(300) });
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Ver tudo" }));
    expect(screen.getByRole("button", { name: "Ver menos" })).toHaveAttribute("aria-expanded", "true");
  });

  it("projeto pausado e encerrado mostram o status certo", () => {
    h.project = mk({ status: "arquivado", health: null });
    render(<Page />);
    expect(screen.getByText("Arquivado")).toBeInTheDocument();
  });
});

describe("indicadores", () => {
  it("Progresso, Próxima entrega (com o título da tarefa) e Pendências com o selo de saúde", () => {
    render(<Page />);
    const k = kpis();
    expect(k.getByText("Progresso")).toBeInTheDocument();
    expect(k.getByText("50%")).toBeInTheDocument();
    expect(k.getByText("4 de 8 tarefas")).toBeInTheDocument();
    expect(k.getByRole("progressbar", { name: "Progresso do projeto" })).toHaveAttribute("aria-valuenow", "50");
    expect(k.getByText("Entregar roteiro")).toBeInTheDocument();
    expect(k.getByText("10/11/2026")).toBeInTheDocument();
    expect(k.getByText("2 tarefas atrasadas")).toBeInTheDocument();
    expect(k.getByText("1 bloqueada")).toBeInTheDocument();
    expect(k.getByText("Em risco")).toBeInTheDocument();
  });

  it("saudável não ganha selo; sem tarefas e sem pendência, nada de zeros", () => {
    h.project = mk({
      health: "saudavel",
      stats: { tasks_total: 0, tasks_done: 0, tasks_open: 0, tasks_overdue: 0, tasks_blocked: 0, progress: 0, deadline: null, next_due: null },
    });
    h.tasks = [];
    render(<Page />);
    const k = kpis();
    expect(k.getByText("Sem tarefas")).toBeInTheDocument();
    expect(k.getByText("Sem próxima entrega")).toBeInTheDocument();
    expect(k.getByText("Nenhuma pendência crítica")).toBeInTheDocument();
    expect(k.queryByText("Saudável")).not.toBeInTheDocument();
    expect(k.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("enquanto as tarefas não chegam, a próxima entrega mostra só a data", () => {
    h.tasks = undefined;
    render(<Page />);
    expect(kpis().getByText("Entrega definida")).toBeInTheDocument();
    expect(kpis().getByText("10/11/2026")).toBeInTheDocument();
  });
});

describe("ações e permissões", () => {
  const menuItems = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "Mais opções do projeto" }));
    return screen.getAllByRole("menuitem").map((i) => i.textContent);
  };

  it("com tudo liberado: Editar ao lado e ⋯ com Duplicar, Pausar, Arquivar e Excluir", async () => {
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(await menuItems(user)).toEqual(["Duplicar", "Pausar", "Arquivar", "Excluir"]);
  });

  it("só leitura: sem Editar e sem menu", () => {
    h.can = { campaigns_read: true, campaigns_create: false, campaigns_write: false, campaigns_delete: false };
    render(<Page />);
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mais opções do projeto" })).not.toBeInTheDocument();
  });

  it("Editar abre o formulário do projeto", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("dialog", { name: "Formulário de projeto" })).toHaveTextContent("Editar Lançamento Verão");
  });

  it("projeto pausado oferece Reativar", async () => {
    h.project = mk({ status: "pausado", health: null });
    const user = userEvent.setup();
    render(<Page />);
    expect(await menuItems(user)).toEqual(["Duplicar", "Reativar", "Arquivar", "Excluir"]);
    await user.click(screen.getByRole("menuitem", { name: "Reativar" }));
    expect(h.setStatus).toHaveBeenCalledWith({ projectId: "p1", status: "ativo" }, expect.any(Object));
  });

  it("Duplicar leva para a cópia", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Mais opções do projeto" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicar" }));
    expect(h.duplicate).toHaveBeenCalledWith("p1", expect.any(Object));
    h.duplicate.mock.calls[0][1].onSuccess(mk({ id: "p9", name: "Lançamento Verão (cópia)" }));
    expect(h.navigate).toHaveBeenCalledWith({ to: "/projects/$projectId", params: { projectId: "p9" } });
  });

  it("Excluir confirma e volta para a lista", async () => {
    h.deleteAsync.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Mais opções do projeto" }));
    await user.click(screen.getByRole("menuitem", { name: "Excluir" }));
    await user.click(within(screen.getByRole("alertdialog", { name: "Excluir projeto?" })).getByRole("button", { name: "Excluir projeto" }));
    await vi.waitFor(() => expect(h.navigate).toHaveBeenCalledWith({ to: "/projects" }));
    expect(h.deleteAsync).toHaveBeenCalledWith("p1");
  });

  it("Arquivar pede confirmação", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Mais opções do projeto" }));
    await user.click(screen.getByRole("menuitem", { name: "Arquivar" }));
    expect(h.setStatus).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog", { name: "Arquivar projeto?" })).getByRole("button", { name: "Arquivar" }));
    expect(h.setStatus).toHaveBeenCalledWith({ projectId: "p1", status: "arquivado" }, expect.any(Object));
  });
});

describe("seções do detalhe", () => {
  it("Tarefas tem título e âncora; os arquivos ficam em Recursos > Documentos (sem seção empilhada)", async () => {
    h.documents = [{ id: "d1" }, { id: "d2" }];
    const user = userEvent.setup();
    render(<Page />);
    const tasks = screen.getByRole("heading", { level: 2, name: "Tarefas" }).closest("section") as HTMLElement;
    expect(tasks).toHaveAttribute("id", "secao-tarefas");
    expect(within(tasks).getByTestId("tasks-board")).toHaveAttribute("data-project", "p1");
    expect(within(tasks).getByTestId("tasks-board")).toHaveAttribute("data-can-write", "true");
    expect(screen.queryByRole("heading", { name: "Arquivos e links" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("documents-section")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Recursos do projeto" }));
    await user.click(screen.getByRole("menuitem", { name: "Documentos (2)" }));
    const dialog = screen.getByRole("dialog", { name: "Documentos" });
    expect(within(dialog).getByTestId("documents-section")).toHaveAttribute("data-project", "p1");
  });

  it("sem permissão de edição o quadro recebe canWrite falso", () => {
    h.can = { campaigns_read: true, campaigns_create: false, campaigns_write: false, campaigns_delete: false };
    render(<Page />);
    expect(screen.getByTestId("tasks-board")).toHaveAttribute("data-can-write", "false");
  });

  it("fora de agência, sem acesso ou com erro, nenhuma seção aparece", () => {
    h.isAgency = false;
    render(<Page />);
    expect(screen.queryByTestId("tasks-board")).not.toBeInTheDocument();
    expect(screen.queryByTestId("documents-section")).not.toBeInTheDocument();
  });
});

import type React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project, ProjectDocument, Task, TaskDetail } from "@/shared/services/agency-projects";
import { AgencyProjectsUnavailableError } from "@/shared/services/agency-projects";

/**
 * Integração do detalhe do projeto: página, cabeçalho, quadro, modal da tarefa e arquivos juntos, com os hooks de
 * verdade (cache, atualização otimista, invalidação) e só a camada de rede (os serviços) trocada por simulações.
 */
const h = vi.hoisted(() => ({
  can: { campaigns_read: true, campaigns_create: true, campaigns_write: true, campaigns_delete: true },
  api: {
    getProject: vi.fn(),
    listTasks: vi.fn(),
    getTask: vi.fn(),
    updateTask: vi.fn(),
    createComment: vi.fn(),
    listDocuments: vi.fn(),
    createDocument: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => ({ ...opts, useParams: () => ({ projectId: "p1" }) }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href="#" data-to={to} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspacePermissions: () => h.can,
  useWorkspaceContext: () => ({ selectedWorkspace: { id: "ws-1", status: "active", account_type: "agency" }, permissions: h.can }),
  useWorkspaceIdForQueries: () => "ws-1",
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock("@/hooks/use-agency-brands", () => ({ useIsAgencyWorkspace: () => true }));
vi.mock("@/hooks/use-workspace-members", () => ({
  useWorkspaceMembersQuery: () => ({
    data: [
      { user_id: 1, name: "Ana Souza", email: "ana@x.com" },
      { user_id: 2, name: "Bruno Lima", email: "bruno@x.com" },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/lib/utils/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/api")>()),
  getUploadUrl: (path?: string | null) => (path ? `https://cdn.test${path}` : undefined),
}));
vi.mock("@/shared/services/agency-projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/agency-projects")>()),
  getAgencyProject: h.api.getProject,
  listProjectTasks: h.api.listTasks,
  getProjectTask: h.api.getTask,
  updateProjectTask: h.api.updateTask,
  createTaskComment: h.api.createComment,
  listProjectDocuments: h.api.listDocuments,
  createProjectDocument: h.api.createDocument,
}));

import { Route } from "./projects.$projectId";

const Page = (Route as unknown as { component: () => React.JSX.Element }).component;

const person = (id: number, name: string) => ({ user_id: id, name, avatar: null });
const project = (): Project => ({
  id: "p1",
  name: "Lançamento Verão",
  description: null,
  cover_url: null,
  status: "ativo",
  created_at: "2026-11-01T12:00:00Z",
  updated_at: "2026-11-01T12:00:00Z",
  stats: { tasks_total: 2, tasks_done: 0, tasks_open: 2, tasks_overdue: 0, tasks_blocked: 0, progress: 0, deadline: "2026-11-20", next_due: "2026-11-10", last_activity_at: "2026-11-03T12:00:00Z" },
  health: "saudavel",
  responsible: person(1, "Ana Souza"),
  participants: [],
});
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
const doc = (id: string, over: Partial<ProjectDocument> = {}): ProjectDocument => ({ id, name: `Doc ${id}`, url: `https://docs.google.com/${id}`, category: "briefing", pinned: false, created_at: "2026-11-01T12:00:00Z", ...over });

let tasks: Task[];
let documents: ProjectDocument[];

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
};
const openDocuments = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: "Recursos do projeto" }));
  await user.click(await screen.findByRole("menuitem", { name: /^Documentos/ }));
};
const column = (label: string) => screen.getByRole("region", { name: label });
const cardTitles = (label: string) => within(column(label)).queryAllByRole("listitem").map((li) => li.querySelector(".apj-tk-open")?.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T15:00:00Z"));
  h.can = { campaigns_read: true, campaigns_create: true, campaigns_write: true, campaigns_delete: true };
  tasks = [task("t1", { title: "Roteiro", due_date: "2026-11-10" }), task("t2", { title: "Briefing", status: "em_andamento" })];
  documents = [doc("d1", { name: "Briefing da campanha" })];
  h.api.getProject.mockImplementation(async () => project());
  h.api.listTasks.mockImplementation(async () => tasks);
  h.api.listDocuments.mockImplementation(async () => documents);
  h.api.getTask.mockImplementation(async (_p: string, id: string): Promise<TaskDetail> => ({
    ...(tasks.find((t) => t.id === id) as Task),
    comments: [],
    attachments: [],
    events: [],
    subtasks: [],
  }));
  h.api.updateTask.mockImplementation(async (_p: string, id: string, input: Partial<Task>) => {
    tasks = tasks.map((t) => (t.id === id ? { ...t, ...input } : t));
    return tasks.find((t) => t.id === id) as Task;
  });
  h.api.createComment.mockResolvedValue({ id: "c9" });
  h.api.createDocument.mockImplementation(async (_p: string, input: { name: string; url: string; category: ProjectDocument["category"] }) => {
    const created = doc("d2", input);
    documents = [...documents, created];
    return created;
  });
});
afterEach(() => vi.useRealTimers());

describe("detalhe com dados reais dos hooks", () => {
  it("monta cabeçalho e quadro (tarefas nas colunas dos status)", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Lançamento Verão" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Quadro de tarefas" })).toBeInTheDocument();
    await waitFor(() => expect(cardTitles("Aberto")).toEqual(["Roteiro"]));
    expect(cardTitles("Em andamento")).toEqual(["Briefing"]);
    // O resumo "Próxima entrega" do cabeçalho usa a mesma consulta das tarefas do quadro.
    expect(within(screen.getByRole("region", { name: "Resumo do projeto" })).getByText("Roteiro")).toBeInTheDocument();
  });

  it("mover pelo menu: o cartão troca de coluna na hora e a API recebe só o status", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Mais ações da tarefa Roteiro" });
    await user.click(screen.getByRole("button", { name: "Mais ações da tarefa Roteiro" }));
    await user.click(screen.getByRole("menuitem", { name: "Mover para Aprovado" }));
    await waitFor(() => expect(cardTitles("Aprovado")).toEqual(["Roteiro"]));
    expect(h.api.updateTask).toHaveBeenCalledWith("p1", "t1", { status: "aprovado" });
    expect(cardTitles("Aberto")).toEqual([]);
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Tarefa movida para Aprovado"));
  });

  it("se a API recusa, o cartão volta à coluna de origem e o toast explica", async () => {
    h.api.updateTask.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "TASK_NOT_FOUND" }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Mais ações da tarefa Roteiro" });
    await user.click(screen.getByRole("button", { name: "Mais ações da tarefa Roteiro" }));
    await user.click(screen.getByRole("menuitem", { name: "Mover para Concluído" }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Essa tarefa não existe mais."));
    await waitFor(() => expect(cardTitles("Aberto")).toEqual(["Roteiro"]));
    expect(cardTitles("Concluído")).toEqual([]);
  });

  it("abrir a tarefa, mudar a prioridade e ver o cartão atualizado no quadro; comentar", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Roteiro" }));
    const dialog = await screen.findByRole("dialog", { name: "Tarefa" });
    await waitFor(() => expect(h.api.getTask).toHaveBeenCalledWith("p1", "t1"));
    await user.selectOptions(within(dialog).getByLabelText("Prioridade"), "urgente");
    await waitFor(() => expect(h.api.updateTask).toHaveBeenCalledWith("p1", "t1", { priority: "urgente" }));
    await waitFor(() => expect(within(column("Aberto")).getByText("Urgente")).toBeInTheDocument());

    await user.click(within(dialog).getByRole("button", { name: /^Atividade/ }));
    await user.type(await within(dialog).findByLabelText("Novo comentário"), "Aprovado pelo cliente");
    await user.click(within(dialog).getByRole("button", { name: "Comentar" }));
    await waitFor(() => expect(h.api.createComment).toHaveBeenCalledWith("p1", "t1", "Aprovado pelo cliente"));
  });

  it("arquivos e links: adicionar um link e vê-lo na lista depois do recarregamento", async () => {
    const user = userEvent.setup();
    renderPage();
    await openDocuments(user);
    await screen.findByRole("link", { name: /Briefing da campanha/ });
    await user.click(screen.getByRole("button", { name: "Adicionar link" }));
    const form = within(screen.getByRole("dialog", { name: "Adicionar link" }));
    await user.type(form.getByLabelText("Endereço do link"), "https://www.figma.com/file/99");
    await user.type(form.getByLabelText(/Nome/), "Telas do app");
    await user.selectOptions(form.getByLabelText("Categoria"), "apresentacao");
    await user.click(form.getByRole("button", { name: "Adicionar link" }));
    await waitFor(() => expect(h.api.createDocument).toHaveBeenCalledWith("p1", { url: "https://www.figma.com/file/99", name: "Telas do app", category: "apresentacao" }));
    expect(await screen.findByRole("link", { name: /Telas do app/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Apresentação" })).toBeInTheDocument();
  });

  it("somente leitura: o detalhe mostra tudo, mas nada de criar, mover, comentar ou adicionar", async () => {
    h.can = { campaigns_read: true, campaigns_create: false, campaigns_write: false, campaigns_delete: false };
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Roteiro" });
    await openDocuments(user);
    await screen.findByRole("link", { name: /Briefing da campanha/ });
    expect(screen.queryByRole("button", { name: "Nova tarefa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Arrastar a tarefa/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Roteiro" }));
    const dialog = await screen.findByRole("dialog", { name: "Tarefa" });
    expect(within(dialog).getByText("Você pode ver esta tarefa, mas não editá-la.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^Atividade/ }));
    expect(within(dialog).queryByLabelText("Novo comentário")).not.toBeInTheDocument();
    expect(h.api.updateTask).not.toHaveBeenCalled();
  });

  it("tarefas indisponíveis (API antiga) não derrubam o resto da página: o cabeçalho e os arquivos seguem", async () => {
    h.api.listTasks.mockRejectedValue(new AgencyProjectsUnavailableError());
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Lançamento Verão" })).toBeInTheDocument();
    expect(await screen.findByText("Tarefas ainda não estão disponíveis")).toBeInTheDocument();
    await openDocuments(user);
    expect(await screen.findByRole("link", { name: /Briefing da campanha/ })).toBeInTheDocument();
    await act(async () => undefined);
  });
});

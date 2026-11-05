import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project, Task } from "@/shared/services/agency-projects";
import { AgencyProjectsUnavailableError } from "@/shared/services/agency-projects";

const h = vi.hoisted(() => ({
  accountType: "agency" as string,
  api: {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    tasks: vi.fn(),
    task: vi.fn(),
    updateTask: vi.fn(),
    createTask: vi.fn(),
    deleteTask: vi.fn(),
    comment: vi.fn(),
    documents: vi.fn(),
    createDocument: vi.fn(),
  },
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({ selectedWorkspace: { id: "ws-1", status: "active", account_type: h.accountType } }),
  useWorkspaceIdForQueries: () => "ws-1",
}));
vi.mock("@/shared/services/agency-projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/agency-projects")>()),
  listAgencyProjects: h.api.list,
  getAgencyProject: h.api.get,
  updateAgencyProject: h.api.update,
  deleteAgencyProject: h.api.remove,
  listProjectTasks: h.api.tasks,
  getProjectTask: h.api.task,
  updateProjectTask: h.api.updateTask,
  createProjectTask: h.api.createTask,
  deleteProjectTask: h.api.deleteTask,
  createTaskComment: h.api.comment,
  listProjectDocuments: h.api.documents,
  createProjectDocument: h.api.createDocument,
}));

import {
  agencyProjectKeys,
  useAddTaskComment,
  useAgencyProject,
  useAgencyProjects,
  useCreateProjectDocument,
  useCreateProjectTask,
  useDeleteAgencyProject,
  useProjectTask,
  useProjectTasks,
  useSetAgencyProjectStatus,
  useSetProjectTaskStatus,
  useUpdateProjectTask,
} from "./use-agency-projects";

const project = (id: string, over: Partial<Project> = {}): Project => ({
  id,
  name: `Projeto ${id}`,
  description: null,
  cover_url: null,
  status: "ativo",
  created_at: "2026-11-01T12:00:00Z",
  updated_at: "2026-11-01T12:00:00Z",
  stats: { tasks_total: 0, tasks_done: 0, tasks_open: 0, tasks_overdue: 0, tasks_blocked: 0, progress: 0, deadline: null, next_due: null, last_activity_at: "2026-11-01T12:00:00Z" },
  health: "saudavel",
  responsible: null,
  participants: [],
  ...over,
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

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);

beforeEach(() => {
  Object.values(h.api).forEach((fn) => fn.mockReset());
  h.accountType = "agency";
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
});

describe("leitura", () => {
  it("só busca em workspace de agência", async () => {
    h.accountType = "brand";
    h.api.list.mockResolvedValue([]);
    const { result } = renderHook(() => useAgencyProjects(), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(h.api.list).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("lista, tarefas e documentos têm chave por workspace", async () => {
    h.api.list.mockResolvedValue([project("p1")]);
    h.api.tasks.mockResolvedValue([task("t1")]);
    h.api.documents.mockResolvedValue([]);
    h.api.get.mockResolvedValue(project("p1"));
    const list = renderHook(() => useAgencyProjects(), { wrapper });
    const tasks = renderHook(() => useProjectTasks("p1"), { wrapper });
    const docs = renderHook(() => ({ d: useAgencyProject("p1"), x: useProjectTask("p1", null) }), { wrapper });
    await waitFor(() => expect(list.result.current.data).toHaveLength(1));
    await waitFor(() => expect(tasks.result.current.data).toHaveLength(1));
    expect(queryClient.getQueryData(agencyProjectKeys.list("ws-1"))).toHaveLength(1);
    expect(queryClient.getQueryData(agencyProjectKeys.tasks("p1", "ws-1"))).toHaveLength(1);
    // Detalhe do projeto busca; detalhe da tarefa fica desligado sem `taskId`.
    await waitFor(() => expect(h.api.get).toHaveBeenCalledWith("p1"));
    expect(h.api.task).not.toHaveBeenCalled();
    expect(docs.result.current.x.fetchStatus).toBe("idle");
  });

  it("API antiga: o erro de 'indisponível' chega à tela e não repete a chamada", async () => {
    h.api.list.mockRejectedValue(new AgencyProjectsUnavailableError());
    const { result } = renderHook(() => useAgencyProjects(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(AgencyProjectsUnavailableError);
    await new Promise((r) => setTimeout(r, 30));
    expect(h.api.list).toHaveBeenCalledTimes(1);
  });

  it("o detalhe usa o item da lista como placeholder enquanto busca", async () => {
    queryClient.setQueryData(agencyProjectKeys.list("ws-1"), [project("p1", { name: "Da lista" })]);
    h.api.get.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAgencyProject("p1"), { wrapper });
    expect(result.current.data?.name).toBe("Da lista");
    expect(result.current.isPlaceholderData).toBe(true);
  });

  it("detalhe da tarefa busca quando há taskId", async () => {
    h.api.task.mockResolvedValue({ ...task("t1"), comments: [], attachments: [], events: [], subtasks: [] });
    const { result } = renderHook(() => useProjectTask("p1", "t1"), { wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe("t1"));
    expect(h.api.task).toHaveBeenCalledWith("p1", "t1");
  });
});

describe("projetos (mutations)", () => {
  it("mudar o status troca o projeto na lista e no detalhe com a resposta da API", async () => {
    queryClient.setQueryData(agencyProjectKeys.list("ws-1"), [project("p1"), project("p2")]);
    queryClient.setQueryData(agencyProjectKeys.detail("p1", "ws-1"), project("p1"));
    h.api.update.mockResolvedValue(project("p1", { status: "pausado", health: null }));
    h.api.list.mockResolvedValue([project("p1", { status: "pausado", health: null }), project("p2")]);
    const { result } = renderHook(() => useSetAgencyProjectStatus(), { wrapper });
    await act(() => result.current.mutateAsync({ projectId: "p1", status: "pausado" }));
    expect(h.api.update).toHaveBeenCalledWith("p1", { status: "pausado" });
    expect(queryClient.getQueryData<Project>(agencyProjectKeys.detail("p1", "ws-1"))?.status).toBe("pausado");
    expect(queryClient.getQueryData<Project[]>(agencyProjectKeys.list("ws-1"))?.map((p) => p.status)).toEqual(["pausado", "ativo"]);
  });

  it("excluir tira da lista e apaga do cache tarefas, documentos e detalhe do projeto", async () => {
    queryClient.setQueryData(agencyProjectKeys.list("ws-1"), [project("p1"), project("p2")]);
    queryClient.setQueryData(agencyProjectKeys.detail("p1", "ws-1"), project("p1"));
    queryClient.setQueryData(agencyProjectKeys.tasks("p1", "ws-1"), [task("t1")]);
    queryClient.setQueryData(agencyProjectKeys.task("p1", "t1", "ws-1"), task("t1"));
    queryClient.setQueryData(agencyProjectKeys.documents("p1", "ws-1"), []);
    queryClient.setQueryData(agencyProjectKeys.tasks("p2", "ws-1"), [task("t9")]);
    h.api.remove.mockResolvedValue(undefined);
    h.api.list.mockResolvedValue([project("p2")]);
    const { result } = renderHook(() => useDeleteAgencyProject(), { wrapper });
    await act(() => result.current.mutateAsync("p1"));
    expect(queryClient.getQueryData<Project[]>(agencyProjectKeys.list("ws-1"))?.map((p) => p.id)).toEqual(["p2"]);
    expect(queryClient.getQueryData(agencyProjectKeys.detail("p1", "ws-1"))).toBeUndefined();
    expect(queryClient.getQueryData(agencyProjectKeys.tasks("p1", "ws-1"))).toBeUndefined();
    expect(queryClient.getQueryData(agencyProjectKeys.task("p1", "t1", "ws-1"))).toBeUndefined();
    expect(queryClient.getQueryData(agencyProjectKeys.documents("p1", "ws-1"))).toBeUndefined();
    // O outro projeto não é tocado.
    expect(queryClient.getQueryData(agencyProjectKeys.tasks("p2", "ws-1"))).toHaveLength(1);
  });
});

describe("tarefas (mutations)", () => {
  it("criar, editar e comentar invalidam tarefas, detalhe da tarefa e o resumo do projeto (cartão e cabeçalho)", async () => {
    queryClient.setQueryData(agencyProjectKeys.list("ws-1"), [project("p1")]);
    queryClient.setQueryData(agencyProjectKeys.detail("p1", "ws-1"), project("p1"));
    queryClient.setQueryData(agencyProjectKeys.tasks("p1", "ws-1"), [task("t1")]);
    queryClient.setQueryData(agencyProjectKeys.task("p1", "t1", "ws-1"), task("t1"));
    queryClient.setQueryData(agencyProjectKeys.documents("p1", "ws-1"), []);
    h.api.createTask.mockResolvedValue(task("t2"));
    h.api.updateTask.mockResolvedValue(task("t1"));
    h.api.comment.mockResolvedValue({});
    const stale = (key: unknown[]) => queryClient.getQueryState(key)?.isInvalidated;

    const create = renderHook(() => useCreateProjectTask("p1"), { wrapper });
    await act(() => create.result.current.mutateAsync({ title: "Nova" }));
    expect(stale(agencyProjectKeys.tasks("p1", "ws-1"))).toBe(true);
    expect(stale(agencyProjectKeys.list("ws-1"))).toBe(true);
    expect(stale(agencyProjectKeys.detail("p1", "ws-1"))).toBe(true);
    // Criação pode ser subtarefa: o detalhe da mãe também recarrega.
    expect(stale(agencyProjectKeys.task("p1", "t1", "ws-1"))).toBe(true);
    // Documentos não mudam com tarefa.
    expect(stale(agencyProjectKeys.documents("p1", "ws-1"))).toBe(false);

    queryClient.setQueryData(agencyProjectKeys.task("p1", "t1", "ws-1"), task("t1"));
    const update = renderHook(() => useUpdateProjectTask("p1"), { wrapper });
    await act(() => update.result.current.mutateAsync({ taskId: "t1", input: { title: "Outro" } }));
    expect(h.api.updateTask).toHaveBeenCalledWith("p1", "t1", { title: "Outro" });
    expect(stale(agencyProjectKeys.task("p1", "t1", "ws-1"))).toBe(true);

    queryClient.setQueryData(agencyProjectKeys.task("p1", "t1", "ws-1"), task("t1"));
    const comment = renderHook(() => useAddTaskComment("p1"), { wrapper });
    await act(() => comment.result.current.mutateAsync({ taskId: "t1", body: "ok" }));
    expect(h.api.comment).toHaveBeenCalledWith("p1", "t1", "ok");
    expect(stale(agencyProjectKeys.task("p1", "t1", "ws-1"))).toBe(true);
  });

  it("editar um campo troca a tarefa no quadro e no detalhe com a resposta da API, sem perder comentários nem anexos", async () => {
    const detail = { ...task("t1"), comments: [{ id: "c1" }], attachments: [{ id: "a1" }], events: [], subtasks: [] };
    queryClient.setQueryData(agencyProjectKeys.tasks("p1", "ws-1"), [task("t1"), task("t2")]);
    queryClient.setQueryData(agencyProjectKeys.task("p1", "t1", "ws-1"), detail);
    h.api.updateTask.mockResolvedValue(task("t1", { title: "Título novo", priority: "urgente" }));

    const update = renderHook(() => useUpdateProjectTask("p1"), { wrapper });
    await act(() => update.result.current.mutateAsync({ taskId: "t1", input: { title: "Título novo", priority: "urgente" } }));

    const board = queryClient.getQueryData<Task[]>(agencyProjectKeys.tasks("p1", "ws-1"));
    expect(board?.map((t) => [t.id, t.title, t.priority])).toEqual([
      ["t1", "Título novo", "urgente"],
      ["t2", "Tarefa t2", "normal"],
    ]);
    const cached = queryClient.getQueryData<typeof detail>(agencyProjectKeys.task("p1", "t1", "ws-1"));
    expect(cached).toMatchObject({ title: "Título novo", priority: "urgente", comments: [{ id: "c1" }], attachments: [{ id: "a1" }] });
  });

  it("mudança de status: o quadro muda na hora e a API recebe só o status", async () => {
    queryClient.setQueryData(agencyProjectKeys.tasks("p1", "ws-1"), [task("t1"), task("t2")]);
    let finish!: (t: Task) => void;
    h.api.updateTask.mockReturnValue(new Promise<Task>((resolve) => (finish = resolve)));
    h.api.tasks.mockResolvedValue([task("t1", { status: "concluido" }), task("t2")]);
    const { result } = renderHook(() => useSetProjectTaskStatus("p1"), { wrapper });

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.mutateAsync({ taskId: "t1", status: "concluido" });
    });
    await waitFor(() => expect(queryClient.getQueryData<Task[]>(agencyProjectKeys.tasks("p1", "ws-1"))?.[0].status).toBe("concluido"));
    const optimistic = queryClient.getQueryData<Task[]>(agencyProjectKeys.tasks("p1", "ws-1"))?.[0];
    expect(optimistic?.completed_at).toBeTruthy();
    expect(queryClient.getQueryData<Task[]>(agencyProjectKeys.tasks("p1", "ws-1"))?.[1].status).toBe("aberto");
    expect(h.api.updateTask).toHaveBeenCalledWith("p1", "t1", { status: "concluido" });

    finish(task("t1", { status: "concluido" }));
    await act(() => pending);
  });

  it("se a API recusa, a tarefa volta para a coluna de origem (e as outras mudanças ficam)", async () => {
    queryClient.setQueryData(agencyProjectKeys.tasks("p1", "ws-1"), [task("t1", { status: "em_andamento" }), task("t2")]);
    let fail!: (e: Error) => void;
    h.api.updateTask.mockReturnValue(new Promise<Task>((_, reject) => (fail = reject)));
    const { result } = renderHook(() => useSetProjectTaskStatus("p1"), { wrapper });

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.mutateAsync({ taskId: "t1", status: "bloqueada" }).catch((e) => e);
    });
    await waitFor(() => expect(queryClient.getQueryData<Task[]>(agencyProjectKeys.tasks("p1", "ws-1"))?.[0].status).toBe("bloqueada"));
    // Outra tarefa muda no cache enquanto a chamada está no ar: a reversão não pode desfazer isso.
    queryClient.setQueryData<Task[]>(agencyProjectKeys.tasks("p1", "ws-1"), (old) => old?.map((t) => (t.id === "t2" ? { ...t, title: "Renomeada" } : t)));

    fail(new Error("Sem permissão"));
    const error = (await act(() => pending)) as Error;
    expect(error.message).toBe("Sem permissão");
    await waitFor(() => expect(result.current.isError).toBe(true));
    const list = queryClient.getQueryData<Task[]>(agencyProjectKeys.tasks("p1", "ws-1"));
    expect(list?.[0].status).toBe("em_andamento");
    expect(list?.[0].completed_at).toBeNull();
    expect(list?.[1].title).toBe("Renomeada");
  });

  it("sair de 'concluído' limpa completed_at no quadro", async () => {
    queryClient.setQueryData(agencyProjectKeys.tasks("p1", "ws-1"), [task("t1", { status: "concluido", completed_at: "2026-11-02T10:00:00Z" })]);
    h.api.updateTask.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSetProjectTaskStatus("p1"), { wrapper });
    act(() => {
      void result.current.mutateAsync({ taskId: "t1", status: "aberto" });
    });
    await waitFor(() => expect(queryClient.getQueryData<Task[]>(agencyProjectKeys.tasks("p1", "ws-1"))?.[0].status).toBe("aberto"));
    expect(queryClient.getQueryData<Task[]>(agencyProjectKeys.tasks("p1", "ws-1"))?.[0].completed_at).toBeNull();
  });
});

describe("documentos (mutations)", () => {
  it("criar invalida só os documentos do projeto", async () => {
    queryClient.setQueryData(agencyProjectKeys.documents("p1", "ws-1"), []);
    queryClient.setQueryData(agencyProjectKeys.tasks("p1", "ws-1"), []);
    h.api.createDocument.mockResolvedValue({});
    const { result } = renderHook(() => useCreateProjectDocument("p1"), { wrapper });
    await act(() => result.current.mutateAsync({ name: "Briefing", url: "https://x.com" }));
    expect(h.api.createDocument).toHaveBeenCalledWith("p1", { name: "Briefing", url: "https://x.com" });
    expect(queryClient.getQueryState(agencyProjectKeys.documents("p1", "ws-1"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(agencyProjectKeys.tasks("p1", "ws-1"))?.isInvalidated).toBe(false);
  });
});

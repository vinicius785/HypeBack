import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project, Task, TaskDetail } from "@/shared/services/agency-projects";

import type { ProjectPermissions } from "../use-project-permissions";

const h = vi.hoisted(() => ({
  detail: undefined as unknown,
  detailError: null as unknown,
  detailLoading: false,
  refetch: vi.fn(),
  pending: false,
  update: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  addComment: vi.fn(),
  removeComment: vi.fn(),
  upload: vi.fn(),
  removeAttachment: vi.fn(),
  people: [] as { id: number; name: string }[],
  peopleFailed: false,
  user: { id: 1 } as { id: number } | null,
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/lib/utils/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/api")>()),
  getUploadUrl: (path?: string | null) => (path ? `https://cdn.test${path}` : undefined),
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock("./use-workspace-people", () => ({
  useWorkspacePeople: () => ({ people: h.people, isLoading: false, failed: h.peopleFailed }),
  knownProjectPeople: () => [],
}));
vi.mock("@/hooks/use-agency-projects", () => ({
  useProjectTask: () => ({ data: h.detail, error: h.detailError, isLoading: h.detailLoading, isFetching: false, refetch: h.refetch }),
  useUpdateProjectTask: () => ({ mutateAsync: h.update, isPending: h.pending }),
  useCreateProjectTask: () => ({ mutateAsync: h.create, isPending: false }),
  useDeleteProjectTask: () => ({ mutateAsync: h.remove, isPending: false }),
  useAddTaskComment: () => ({ mutateAsync: h.addComment, isPending: false }),
  useDeleteTaskComment: () => ({ mutateAsync: h.removeComment, isPending: false }),
  useUploadTaskAttachment: () => ({ mutateAsync: h.upload, isPending: false }),
  useDeleteTaskAttachment: () => ({ mutateAsync: h.removeAttachment, isPending: false }),
}));

import { todayInSaoPaulo } from "../project-base";
import { TaskModal } from "./task-modal";

const project = { id: "p1", name: "Verão" } as Project;
const can = (over: Partial<ProjectPermissions> = {}): ProjectPermissions => ({ canRead: true, canCreate: true, canWrite: true, canDelete: false, ...over });
const person = (id: number, name: string, primary = true) => ({ user_id: id, name, avatar: null, is_primary: primary });
const onClose = vi.fn();
const onOpenTask = vi.fn();

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

const detailOf = (over: Partial<TaskDetail> = {}): TaskDetail => ({
  ...task("t1", { title: "Roteiro", description: "Texto base", priority: "alta", due_date: "2026-11-10", tags: ["video"], assignees: [person(1, "Ana Souza")] }),
  comments: [
    { id: "c1", author: { user_id: 1, name: "Ana Souza", avatar: null }, body: "Primeiro comentário", created_at: "2026-11-02T13:00:00Z" },
    { id: "c2", author: { user_id: 2, name: "Bruno Lima", avatar: null }, body: "Segundo comentário", created_at: "2026-11-03T13:00:00Z" },
  ],
  attachments: [{ id: "a1", url: "/uploads/briefing.pdf", name: "briefing.pdf", mime_type: "application/pdf", size: 2048, uploaded_by: 1, created_at: "2026-11-02T13:00:00Z" }],
  events: [
    { id: "e1", actor: { user_id: 1, name: "Ana Souza" }, type: "created", data: {}, created_at: "2026-11-01T12:00:00Z" },
    { id: "e2", actor: { user_id: 2, name: "Bruno Lima" }, type: "status", data: { from: "aberto", to: "em_andamento" }, created_at: "2026-11-02T12:00:00Z" },
  ],
  subtasks: [task("s1", { title: "Pesquisa", parent_task_id: "t1" }), task("s2", { title: "Rascunho", parent_task_id: "t1", status: "concluido" })],
  ...over,
});

function deferred<T = unknown>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const apiError = (code: string) => Object.assign(new Error("falhou"), { code });
const board = () => [task("t1", { title: "Roteiro", tags: ["video", "texto"] }), task("t2", { title: "Briefing", tags: ["legal"] })];

function renderEdit(props: Partial<React.ComponentProps<typeof TaskModal>> = {}, permissions = can()) {
  return render(<TaskModal project={project} can={permissions} taskId="t1" tasks={board()} onOpenTask={onOpenTask} onClose={onClose} {...props} />);
}
function renderCreate(props: Partial<React.ComponentProps<typeof TaskModal>> = {}, permissions = can()) {
  return render(<TaskModal project={project} can={permissions} taskId={null} tasks={board()} onOpenTask={onOpenTask} onClose={onClose} {...props} />);
}

type U = ReturnType<typeof userEvent.setup>;
const choose = async (user: U, trigger: RegExp, item: string | RegExp, role: "menuitemradio" | "menuitem" = "menuitemradio") => {
  await user.click(screen.getByRole("button", { name: trigger }));
  await user.click(screen.getByRole(role, { name: item }));
};
const openActivity = async () => undefined; // o painel de atividade já abre com a tarefa
const section = (name: string) => within(screen.getByRole("region", { name }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  h.detail = detailOf();
  h.detailError = null;
  h.detailLoading = false;
  h.pending = false;
  h.people = [
    { id: 1, name: "Ana Souza" },
    { id: 2, name: "Bruno Lima" },
    { id: 3, name: "Carla Dias" },
  ];
  h.peopleFailed = false;
  h.user = { id: 1 };
  h.update.mockImplementation(async () => task("t1"));
  h.create.mockImplementation(async () => task("novo"));
  h.remove.mockResolvedValue(undefined);
  h.addComment.mockResolvedValue({});
  h.removeComment.mockResolvedValue(undefined);
  h.upload.mockResolvedValue({});
  h.removeAttachment.mockResolvedValue(undefined);
});

describe("edição: campos", () => {
  it("abre com tudo preenchido e nomeado para leitor de tela", () => {
    renderEdit();
    const dialog = screen.getByRole("dialog", { name: "Tarefa" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByLabelText("Título")).toHaveValue("Roteiro");
    expect(within(dialog).getByRole("button", { name: "Status: Aberto" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Prioridade: Alta" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Prazo: 10/11/2026" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Descrição/)).toHaveValue("Texto base");
    expect(within(dialog).getByRole("group", { name: "Responsáveis" })).toHaveTextContent("Ana Souza");
    expect(within(dialog).getByRole("group", { name: "Etiquetas" })).toHaveTextContent("video");
  });

  it("status: grava na hora, mostra 'Salvando…' e depois 'Salvo'", async () => {
    const d = deferred<Task>();
    h.update.mockReturnValueOnce(d.promise);
    const user = userEvent.setup();
    renderEdit();
    await choose(user, /^Status/, "Em ajustes");
    expect(h.update).toHaveBeenCalledWith({ taskId: "t1", input: { status: "em_ajustes" } });
    expect(screen.getByRole("button", { name: "Status: Em ajustes" })).toBeInTheDocument();
    expect(screen.getByText("Salvando…")).toBeInTheDocument();
    await act(async () => d.resolve(task("t1")));
    expect(await screen.findByText("Salvo ✓")).toBeInTheDocument();
  });

  it("prioridade grava", async () => {
    const user = userEvent.setup();
    renderEdit();
    await choose(user, /^Prioridade/, "Urgente");
    expect(h.update).toHaveBeenCalledWith({ taskId: "t1", input: { priority: "urgente" } });
  });

  it("erro da API: o texto traduzido aparece no campo e o valor volta ao que estava", async () => {
    h.update.mockRejectedValueOnce(apiError("TASK_NOT_FOUND"));
    const user = userEvent.setup();
    renderEdit();
    await choose(user, /^Status/, "Concluído");
    expect(await screen.findByText("Essa tarefa não existe mais.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Status: Aberto" })).toBeInTheDocument());
  });

  it("prazo: escolhe um dia no calendário e remove com Limpar", async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.click(screen.getByRole("button", { name: /^Prazo/ }));
    await user.click(screen.getByRole("button", { name: "20 de novembro de 2026" }));
    expect(h.update).toHaveBeenCalledWith({ taskId: "t1", input: { due_date: "2026-11-20" } });
    await user.click(screen.getByRole("button", { name: /^Prazo/ }));
    await user.click(screen.getByRole("menuitem", { name: "Limpar" }));
    expect(h.update).toHaveBeenLastCalledWith({ taskId: "t1", input: { due_date: null } });
  });

  it("prazo vencido mostra o aviso em vermelho", () => {
    h.detail = detailOf({ due_date: "2026-01-02" });
    renderEdit();
    expect(screen.getByText(/^Atrasada · \d+d$/)).toBeInTheDocument();
  });

  it("título: grava ao sair do campo; vazio avisa e não grava", async () => {
    const user = userEvent.setup();
    renderEdit();
    const title = screen.getByLabelText("Título");
    await user.clear(title);
    await user.type(title, "  Roteiro final ");
    expect(h.update).not.toHaveBeenCalled();
    await user.tab();
    expect(h.update).toHaveBeenCalledWith({ taskId: "t1", input: { title: "Roteiro final" } });
    await user.clear(title);
    await user.tab();
    expect(screen.getByText("Informe o título da tarefa")).toBeInTheDocument();
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(h.update).toHaveBeenCalledTimes(1);
  });

  it("título sem mudança não chama a API", async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.click(screen.getByLabelText("Título"));
    await user.tab();
    expect(h.update).not.toHaveBeenCalled();
  });

  it("descrição: grava ao sair; esvaziar grava nulo", async () => {
    const user = userEvent.setup();
    renderEdit();
    const description = screen.getByLabelText(/Descrição/);
    await user.type(description, " e mais");
    await user.tab();
    expect(h.update).toHaveBeenCalledWith({ taskId: "t1", input: { description: "Texto base e mais" } });
    await user.clear(description);
    await user.tab();
    expect(h.update).toHaveBeenLastCalledWith({ taskId: "t1", input: { description: null } });
  });
});

describe("edição: responsáveis e etiquetas", () => {
  it("escolhe membros do workspace e define o principal", async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.click(screen.getByRole("button", { name: "Editar responsáveis" }));
    await user.click(screen.getByRole("checkbox", { name: /Carla Dias/ }));
    expect(h.update).toHaveBeenCalledWith({ taskId: "t1", input: { assignee_ids: [1, 3], primary_assignee_id: 1 } });
  });

  it("com mais de um responsável aparece a escolha do principal", async () => {
    h.detail = detailOf({ assignees: [person(1, "Ana Souza"), person(3, "Carla Dias", false)] });
    const user = userEvent.setup();
    renderEdit();
    await user.click(screen.getByRole("button", { name: "Editar responsáveis" }));
    expect(screen.getByRole("radio", { name: "Ana Souza é o responsável principal" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Carla Dias é o responsável principal" }));
    expect(h.update).toHaveBeenCalledWith({ taskId: "t1", input: { assignee_ids: [1, 3], primary_assignee_id: 3 } });
  });

  it("desmarcar o único responsável deixa a tarefa sem ninguém", async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.click(screen.getByRole("button", { name: "Editar responsáveis" }));
    await user.click(screen.getByRole("checkbox", { name: /Ana Souza/ }));
    expect(h.update).toHaveBeenCalledWith({ taskId: "t1", input: { assignee_ids: [], primary_assignee_id: null } });
  });

  it("recusa de membro (ASSIGNEE_NOT_MEMBER) vira texto claro", async () => {
    h.update.mockRejectedValueOnce(apiError("ASSIGNEE_NOT_MEMBER"));
    const user = userEvent.setup();
    renderEdit();
    await user.click(screen.getByRole("button", { name: "Editar responsáveis" }));
    await user.click(screen.getByRole("checkbox", { name: /Bruno Lima/ }));
    expect(await screen.findByText("Só membros ativos do workspace podem ser responsáveis.")).toBeInTheDocument();
  });

  it("lista de membros indisponível: avisa e ainda deixa tirar quem já é responsável", async () => {
    h.people = [];
    h.peopleFailed = true;
    const user = userEvent.setup();
    renderEdit();
    await user.click(screen.getByRole("button", { name: "Editar responsáveis" }));
    expect(screen.getByText(/Não foi possível carregar os membros/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Ana Souza/ })).toBeChecked();
  });

  it("etiquetas: Enter acrescenta, repetida e a 11ª são recusadas, e o × remove", async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.click(screen.getByRole("button", { name: "Adicionar etiqueta" }));
    await user.type(screen.getByLabelText("Nova etiqueta"), "  #Cliente {Enter}");
    expect(h.update).toHaveBeenCalledWith({ taskId: "t1", input: { tags: ["video", "Cliente"] } });
    await user.click(screen.getByRole("button", { name: "Adicionar etiqueta" }));
    await user.type(screen.getByLabelText("Nova etiqueta"), "VIDEO{Enter}");
    expect(screen.getByText("Essa etiqueta já está na tarefa")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remover etiqueta video" }));
    expect(h.update).toHaveBeenLastCalledWith({ taskId: "t1", input: { tags: [] } });
  });

  it("limite de 10 etiquetas", async () => {
    h.detail = detailOf({ tags: Array.from({ length: 10 }, (_, i) => `t${i}`) });
    const user = userEvent.setup();
    renderEdit();
    await user.click(screen.getByRole("button", { name: "Adicionar etiqueta" }));
    await user.type(screen.getByLabelText("Nova etiqueta"), "mais{Enter}");
    expect(screen.getByText("Cada tarefa aceita até 10 etiquetas")).toBeInTheDocument();
    expect(h.update).not.toHaveBeenCalled();
  });
});

describe("edição: subtarefas", () => {
  it("lista com progresso, adiciona (Enter), marca e reabre, abre e remove com confirmação", async () => {
    const user = userEvent.setup();
    renderEdit();
    const subs = section("Subtarefas");
    expect(subs.getByRole("progressbar", { name: "Subtarefas concluídas" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByRole("heading", { name: /Subtarefas/ })).toHaveTextContent("1/2");

    await user.click(subs.getByRole("button", { name: "+ Adicionar subtarefa" }));
    await user.type(subs.getByLabelText("Nova subtarefa"), "Revisar{Enter}");
    expect(h.create).toHaveBeenCalledWith({ title: "Revisar", parent_task_id: "t1" });
    await waitFor(() => expect(subs.queryByLabelText("Nova subtarefa")).not.toBeInTheDocument());

    await user.click(subs.getByRole("checkbox", { name: "Concluir subtarefa Pesquisa" }));
    expect(h.update).toHaveBeenCalledWith({ taskId: "s1", input: { status: "concluido" } });
    await user.click(subs.getByRole("checkbox", { name: "Reabrir subtarefa Rascunho" }));
    expect(h.update).toHaveBeenLastCalledWith({ taskId: "s2", input: { status: "aberto" } });

    await user.click(subs.getByRole("button", { name: "Pesquisa" }));
    expect(onOpenTask).toHaveBeenCalledWith("s1");

    await user.click(subs.getByRole("button", { name: "Remover subtarefa Pesquisa" }));
    expect(h.remove).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("alertdialog", { name: "Remover subtarefa?" })).getByRole("button", { name: "Remover subtarefa" }));
    await waitFor(() => expect(h.remove).toHaveBeenCalledWith("s1"));
  });

  it("título vazio da subtarefa avisa; SUBTASK_DEPTH vira texto claro", async () => {
    h.create.mockRejectedValueOnce(apiError("SUBTASK_DEPTH"));
    const user = userEvent.setup();
    renderEdit();
    const subs = section("Subtarefas");
    await user.click(subs.getByRole("button", { name: "+ Adicionar subtarefa" }));
    await user.type(subs.getByLabelText("Nova subtarefa"), "{Enter}");
    expect(subs.getByText("Informe o título da subtarefa")).toBeInTheDocument();
    expect(h.create).not.toHaveBeenCalled();
    await user.type(subs.getByLabelText("Nova subtarefa"), "Algo{Enter}");
    expect(await subs.findByText("Uma subtarefa não pode ter subtarefas.")).toBeInTheDocument();
  });

  it("uma subtarefa não tem bloco de subtarefas e leva de volta à tarefa-mãe", async () => {
    h.detail = detailOf({ id: "s1", title: "Pesquisa", parent_task_id: "t1", subtasks: [] });
    const user = userEvent.setup();
    renderEdit({ taskId: "s1" });
    expect(screen.getByRole("dialog", { name: "Subtarefa" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Subtarefas/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Roteiro" }));
    expect(onOpenTask).toHaveBeenCalledWith("t1");
  });
});

describe("edição: comentários", () => {
  it("mais antigo primeiro, comenta pelo botão e por Ctrl+Enter, e limpa o campo", async () => {
    const user = userEvent.setup();
    renderEdit();
    await openActivity();
    const comments = section("Comentários");
    expect(comments.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Primeiro comentário"),
      expect.stringContaining("Segundo comentário"),
    ]);
    const box = screen.getByLabelText("Novo comentário");
    await user.type(box, "Olá time");
    await user.click(screen.getByRole("button", { name: "Comentar" }));
    expect(h.addComment).toHaveBeenCalledWith({ taskId: "t1", body: "Olá time" });
    await waitFor(() => expect(box).toHaveValue(""));
    await user.type(box, "Outro{Control>}{Enter}{/Control}");
    expect(h.addComment).toHaveBeenLastCalledWith({ taskId: "t1", body: "Outro" });
  });

  it("comentário vazio avisa; falha mantém o texto e mostra o erro", async () => {
    h.addComment.mockRejectedValueOnce(new Error("Sem conexão"));
    const user = userEvent.setup();
    renderEdit();
    await openActivity();
    const comments = section("Comentários");
    await user.click(screen.getByRole("button", { name: "Comentar" }));
    expect(comments.getByText("Escreva o comentário")).toBeInTheDocument();
    expect(h.addComment).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Novo comentário"), "Texto");
    await user.click(screen.getByRole("button", { name: "Comentar" }));
    expect(await comments.findByText("Sem conexão")).toBeInTheDocument();
    expect(screen.getByLabelText("Novo comentário")).toHaveValue("Texto");
  });

  it("só o autor apaga o próprio comentário (sem exclusão); com campaigns_delete apaga qualquer um", async () => {
    const user = userEvent.setup();
    const { unmount } = renderEdit();
    await openActivity();
    expect(screen.getByRole("button", { name: "Excluir comentário de Ana Souza" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir comentário de Bruno Lima" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Excluir comentário de Ana Souza" }));
    await user.click(within(screen.getByRole("alertdialog", { name: "Excluir comentário?" })).getByRole("button", { name: "Excluir comentário" }));
    await waitFor(() => expect(h.removeComment).toHaveBeenCalledWith({ taskId: "t1", commentId: "c1" }));
    unmount();
    renderEdit({}, can({ canDelete: true }));
    await openActivity();
    expect(screen.getByRole("button", { name: "Excluir comentário de Bruno Lima" })).toBeInTheDocument();
  });
});

describe("edição: anexos", () => {
  const file = (name: string, size = 1024, type = "application/pdf") => {
    const f = new File(["x"], name, { type });
    Object.defineProperty(f, "size", { value: size });
    return f;
  };

  it("lista com tamanho e link que abre em outra aba; envia e mostra o limite de 10", async () => {
    const user = userEvent.setup();
    renderEdit();
    const attachments = section("Anexos");
    const link = attachments.getByRole("link", { name: "briefing.pdf" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link.getAttribute("href")).toContain("briefing.pdf");
    expect(attachments.getByText(/2 KB/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Anexos/ })).toHaveTextContent("1/10");
    const pdf = file("novo.pdf");
    await user.upload(attachments.getByLabelText("Arquivos para anexar"), pdf);
    await waitFor(() => expect(h.upload).toHaveBeenCalledWith({ taskId: "t1", file: pdf }));
  });

  it("arquivo grande demais não é enviado e o motivo aparece", async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.upload(section("Anexos").getByLabelText("Arquivos para anexar"), file("video.mov", 30 * 1024 * 1024));
    expect(await screen.findByText("“video.mov” passa de 25 MB")).toBeInTheDocument();
    expect(h.upload).not.toHaveBeenCalled();
  });

  it("erro da API (limite de anexos) vira texto claro com o nome do arquivo", async () => {
    h.upload.mockRejectedValueOnce(apiError("ATTACHMENT_LIMIT"));
    const user = userEvent.setup();
    renderEdit();
    await user.upload(section("Anexos").getByLabelText("Arquivos para anexar"), file("a.pdf"));
    expect(await screen.findByText("a.pdf: Cada tarefa aceita até 10 anexos.")).toBeInTheDocument();
  });

  it("com 10 anexos o botão de anexar fica desabilitado", () => {
    h.detail = detailOf({ attachments: Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, url: `/u/${i}.pdf`, name: `${i}.pdf`, mime_type: "application/pdf", size: 10, uploaded_by: 1, created_at: "2026-11-02T13:00:00Z" })) });
    renderEdit();
    expect(section("Anexos").getByRole("button", { name: "Anexar arquivo" })).toBeDisabled();
    expect(screen.getByText("Limite de 10 anexos por tarefa.")).toBeInTheDocument();
  });

  it("remove com confirmação", async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.click(section("Anexos").getByRole("button", { name: "Remover anexo briefing.pdf" }));
    await user.click(within(screen.getByRole("alertdialog", { name: "Remover anexo?" })).getByRole("button", { name: "Remover anexo" }));
    await waitFor(() => expect(h.removeAttachment).toHaveBeenCalledWith({ taskId: "t1", attachmentId: "a1" }));
  });
});

describe("edição: atividade", () => {
  it("rótulos em português, com o complemento da mudança, do mais novo para o mais antigo", async () => {
    renderEdit();
    await openActivity();
    const items = section("Atividade").getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Bruno Lima mudou o status (de Aberto para Em andamento)");
    expect(items[1]).toHaveTextContent("Ana Souza criou a tarefa");
  });

  it("mostra seis e 'Ver tudo' abre o resto", async () => {
    h.detail = detailOf({
      events: Array.from({ length: 9 }, (_, i) => ({ id: `e${i}`, actor: null, type: "comment", data: {}, created_at: `2026-11-0${i + 1}T12:00:00Z` })),
    });
    const user = userEvent.setup();
    renderEdit();
    await openActivity();
    expect(section("Atividade").getAllByRole("listitem")).toHaveLength(6);
    await user.click(section("Atividade").getByRole("button", { name: "Ver tudo (9)" }));
    expect(section("Atividade").getAllByRole("listitem")).toHaveLength(9);
  });
});

describe("edição: diálogo", () => {
  it("Esc fecha; fechar com texto pendente grava antes", async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.type(screen.getByLabelText("Título"), " 2");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.update).toHaveBeenCalledWith({ taskId: "t1", input: { title: "Roteiro 2" } });
  });

  it("gravando bloqueia fechar (Esc e botões)", async () => {
    h.pending = true;
    const user = userEvent.setup();
    renderEdit();
    expect(screen.getByRole("dialog", { name: "Tarefa" })).toHaveAttribute("aria-busy", "true");
    screen.getAllByRole("button", { name: "Fechar" }).forEach((b) => expect(b).toBeDisabled());
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("título inválido não prende: o segundo pedido de fechar descarta", async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.clear(screen.getByLabelText("Título"));
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Informe o título da tarefa")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.update).not.toHaveBeenCalled();
  });

  it("excluir tarefa: confirma, apaga, avisa e fecha", async () => {
    const user = userEvent.setup();
    renderEdit();
    await user.click(screen.getByRole("button", { name: "Mais opções da tarefa" }));
    await user.click(screen.getByRole("menuitem", { name: "Excluir tarefa" }));
    const confirm = screen.getByRole("alertdialog", { name: "Excluir tarefa?" });
    expect(confirm).toHaveTextContent("subtarefas, os comentários e os anexos");
    await user.click(within(confirm).getByRole("button", { name: "Excluir tarefa" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.remove).toHaveBeenCalledWith("t1");
    expect(h.toast.success).toHaveBeenCalledWith("Tarefa excluída");
  });

  it("enquanto o detalhe carrega usa a tarefa do quadro e mostra esqueleto nos blocos", async () => {
    h.detail = undefined;
    h.detailLoading = true;
    renderEdit();
    expect(screen.getByLabelText("Título")).toHaveValue("Roteiro");
    expect(screen.getByLabelText("Carregando subtarefas")).toBeInTheDocument();
    expect(screen.getByLabelText("Carregando anexos")).toBeInTheDocument();
    await openActivity();
    expect(screen.getByLabelText("Carregando comentários")).toBeInTheDocument();
  });

  it("tarefa inexistente: avisa e deixa fechar", async () => {
    h.detail = undefined;
    h.detailError = apiError("TASK_NOT_FOUND");
    const user = userEvent.setup();
    renderEdit({ taskId: "zzz" });
    expect(screen.getByRole("alert")).toHaveTextContent("Essa tarefa não existe mais.");
    await user.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Fechar" }).at(-1) as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  it("detalhe falhou mas a tarefa está no quadro: campos seguem editáveis e os blocos não ficam em esqueleto eterno", async () => {
    h.detail = undefined;
    h.detailError = new Error("Falha de rede");
    const user = userEvent.setup();
    renderEdit();
    expect(screen.getByLabelText("Título")).toHaveValue("Roteiro");
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar as subtarefas");
    expect(screen.queryByLabelText("Carregando comentários")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it("erro ao carregar: 'Tentar de novo'", async () => {
    h.detail = undefined;
    h.detailError = new Error("Falha de rede");
    const user = userEvent.setup();
    renderEdit({ taskId: "zzz" });
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(h.refetch).toHaveBeenCalled();
  });
});

describe("somente leitura", () => {
  it("campos travados, sem formulários de adicionar, sem excluir e com o aviso", () => {
    renderEdit({}, can({ canWrite: false, canCreate: false, canDelete: false }));
    expect(screen.getByText("Você pode ver esta tarefa, mas não editá-la.")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: /^Status/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Prioridade/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Prazo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar etiqueta" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Descrição/)).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Editar responsáveis" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nova etiqueta")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover etiqueta video" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nova subtarefa")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Concluir subtarefa Pesquisa" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Remover subtarefa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anexar arquivo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remover anexo/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Novo comentário")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir comentário/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir tarefa" })).not.toBeInTheDocument();
  });

  it("mexer nos campos não grava nada", async () => {
    const user = userEvent.setup();
    renderEdit({}, can({ canWrite: false }));
    await user.click(screen.getByLabelText("Título"));
    await user.tab();
    expect(h.update).not.toHaveBeenCalled();
  });
});

describe("criar tarefa", () => {
  it("abre vazia no status pedido, com o foco no título", () => {
    renderCreate({ defaultStatus: "em_aprovacao" });
    expect(screen.getByRole("dialog", { name: "Nova tarefa" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Status: Em aprovação" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prioridade: Normal" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Comentários/ })).not.toBeInTheDocument();
  });

  it("título é obrigatório: avisa e não chama a API", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(screen.getByText("Informe o título da tarefa")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveAttribute("aria-invalid", "true");
    expect(h.create).not.toHaveBeenCalled();
  });

  it("cria com tudo que foi preenchido, avisa e fecha", async () => {
    const user = userEvent.setup();
    renderCreate({ defaultStatus: "em_andamento" });
    await user.type(screen.getByLabelText("Título"), "  Gravar vídeo ");
    await choose(user, /^Prioridade/, "Alta");
    await choose(user, /^Prazo/, /^Hoje/, "menuitem");
    await user.click(screen.getByRole("button", { name: "Adicionar etiqueta" }));
    await user.type(screen.getByLabelText("Nova etiqueta"), "video{Enter}");
    await user.click(screen.getByRole("button", { name: "Editar responsáveis" }));
    await user.click(screen.getByRole("checkbox", { name: /Bruno Lima/ }));
    await user.type(screen.getByLabelText(/Descrição/), "Brief completo");
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 4000 });
    expect(h.create).toHaveBeenCalledWith({
      title: "Gravar vídeo",
      description: "Brief completo",
      status: "em_andamento",
      priority: "alta",
      due_date: todayInSaoPaulo(),
      tags: ["video"],
      assignee_ids: [2],
      primary_assignee_id: 2,
    });
    expect(h.toast.success).toHaveBeenCalledWith("Tarefa criada");
  });

  it("erro da API: mostra e continua aberto com o que foi digitado", async () => {
    h.create.mockRejectedValueOnce(apiError("ASSIGNEE_NOT_MEMBER"));
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByLabelText("Título"), "Tarefa nova");
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Só membros ativos do workspace podem ser responsáveis.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Título")).toHaveValue("Tarefa nova");
  });

  it("cancelar com algo preenchido pede confirmação de descarte; sem nada fecha direto", async () => {
    const user = userEvent.setup();
    const { unmount } = renderCreate();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    renderCreate();
    await user.type(screen.getByLabelText("Título"), "algo");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(within(screen.getByRole("alertdialog", { name: "Descartar a tarefa?" })).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
    expect(h.create).not.toHaveBeenCalled();
  });
});

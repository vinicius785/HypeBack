/**
 * Diálogos de grupo (novo e detalhe): o comportamento de diálogo de verdade (aria-modal, foco, Esc/fundo que não
 * fecham gravando), as abas do detalhe, os passos do novo grupo e as três confirmações (conteúdo, moderador,
 * arquivar) que saíram da linha e foram para o `AdminConfirmDialog`.
 */
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  getGroup: vi.fn(),
  listGroupPosts: vi.fn(),
  deleteGroup: vi.fn(),
  deleteGroupPost: vi.fn(),
  removeGroupModerator: vi.fn(),
  addGroupModerator: vi.fn(),
  updateGroup: vi.fn(),
  createGroup: vi.fn(),
  createGroupPost: vi.fn(),
  uploadCommunityImage: vi.fn(),
}));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }));

vi.mock("@/shared/services/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/groups")>()),
  getGroup: svc.getGroup,
  listGroupPosts: svc.listGroupPosts,
  deleteGroup: svc.deleteGroup,
  deleteGroupPost: svc.deleteGroupPost,
  removeGroupModerator: svc.removeGroupModerator,
  addGroupModerator: svc.addGroupModerator,
  updateGroup: svc.updateGroup,
  createGroup: svc.createGroup,
  createGroupPost: svc.createGroupPost,
  uploadGroupCover: svc.uploadCommunityImage,
  uploadCommunityImage: svc.uploadCommunityImage,
}));
vi.mock("sonner", () => ({ toast: toasts }));

import { renderAdminRoute } from "@/test/render-admin-route";
import type { CommunityGroupDetail, GroupPost } from "@/shared/types";

import { GroupDetailDialog } from "./group-detail-dialog";
import { GroupNewDialog } from "./group-new-dialog";

const GROUP: CommunityGroupDetail = {
  id: "g1",
  name: "Moda e Estilo",
  description: "Looks, tendências e bastidores",
  cover_url: null,
  icon_name: null,
  icon_color: null,
  required_level: null,
  required_hype_points: null,
  members_count: 120,
  is_official: false,
  posts_count: 1,
  deleted_at: null,
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:00:00.000Z",
  rules: null,
  moderators: [{ id: "m1", name: "Rafa Lima", username: "rafalima", avatar_url: null }],
};

const POST: GroupPost = {
  id: "p1",
  content: "Dica de look para o verão",
  image_url: null,
  video_url: null,
  video_thumbnail_url: null,
  author: { id: "u1", name: "Marina Alves", avatar_url: null },
  likes_count: 4,
  comments_count: 2,
  created_at: "2026-11-02T12:00:00.000Z",
};

const postsPage = (items: GroupPost[]) => ({ items, meta: { next_cursor: null, has_more: false } });

function renderDetail() {
  return renderAdminRoute(
    [
      { path: "/admin/groups", component: () => <div>lista de grupos</div> },
      { path: "/admin/groups/$groupId", component: () => <GroupDetailDialog groupId="g1" /> },
    ],
    "/admin/groups/g1",
  );
}

function renderNew() {
  return renderAdminRoute(
    [
      { path: "/admin/groups", component: () => <div>lista de grupos</div> },
      { path: "/admin/groups/new", component: GroupNewDialog },
      { path: "/admin/groups/$groupId", component: () => <div>detalhe do grupo</div> },
    ],
    "/admin/groups/new",
  );
}

const pending = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

beforeEach(() => {
  Object.values(svc).forEach((fn) => fn.mockReset());
  Object.values(toasts).forEach((fn) => fn.mockReset());
  svc.getGroup.mockResolvedValue(GROUP);
  svc.listGroupPosts.mockResolvedValue(postsPage([POST]));
  svc.deleteGroup.mockResolvedValue(undefined);
  svc.deleteGroupPost.mockResolvedValue(undefined);
  svc.removeGroupModerator.mockResolvedValue(undefined);
  svc.updateGroup.mockResolvedValue(GROUP);
  svc.createGroup.mockResolvedValue({ ...GROUP, id: "g-new" });
  svc.createGroupPost.mockResolvedValue({ id: "p-new" });
  // jsdom não implementa objectURL: o composer e o seletor de capa usam para a prévia.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("Detalhe do grupo: diálogo", () => {
  it("é um diálogo modal nomeado pelo grupo, com o foco dentro dele", async () => {
    renderDetail();

    const dialog = await screen.findByRole("dialog", { name: "Moda e Estilo" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    // A rolagem da página fica travada enquanto o diálogo está aberto.
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("carregando: o título é um esqueleto anunciado, não o texto 'Carregando…' solto", async () => {
    svc.getGroup.mockReturnValue(new Promise(() => {}));
    renderDetail();

    const dialog = await screen.findByRole("dialog", { name: "Grupo" });
    expect(within(dialog).getByText("Carregando grupo…")).toBeInTheDocument();
    expect(within(dialog).queryByRole("heading", { name: "Carregando…" })).not.toBeInTheDocument();
  });

  it("grupo inexistente (404): diz que não encontrou e oferece só Fechar", async () => {
    svc.getGroup.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
    renderDetail();

    expect(await screen.findByText("Não encontramos este grupo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Grupo não encontrado" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });

  it("falha ao carregar: mostra o motivo e 'Tentar de novo' busca outra vez", async () => {
    // A consulta tenta de novo sozinha antes de desistir: falha em todas as tentativas.
    svc.getGroup.mockRejectedValue(new Error("Falha ao carregar grupo (500)"));
    renderDetail();

    expect(await screen.findByText("Falha ao carregar grupo (500)")).toBeInTheDocument();
    svc.getGroup.mockResolvedValue(GROUP);
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("dialog", { name: "Moda e Estilo" })).toBeInTheDocument();
  });

  it("Esc fecha e volta à aba Grupos da Comunidade", async () => {
    const { router } = renderDetail();
    await screen.findByRole("dialog", { name: "Moda e Estilo" });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/groups"));
    expect(router.state.location.search).toMatchObject({ tab: "groups" });
  });

  it("gravando, Esc, o fundo e o botão de fechar não fecham", async () => {
    const save = pending<CommunityGroupDetail>();
    svc.updateGroup.mockReturnValue(save.promise);
    const { router } = renderDetail();
    await screen.findByRole("dialog", { name: "Moda e Estilo" });
    await userEvent.click(screen.getByRole("tab", { name: /Editar/ }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    const dialog = screen.getByRole("dialog", { name: "Moda e Estilo" });
    await waitFor(() => expect(dialog).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByRole("button", { name: "Fechar", hidden: false })).toBeDisabled();

    await userEvent.keyboard("{Escape}");
    fireEvent.click(document.querySelector(".ovb") as HTMLElement);
    expect(router.state.location.pathname).toBe("/admin/groups/g1");

    await act(async () => save.resolve(GROUP));
    await waitFor(() => expect(dialog).not.toHaveAttribute("aria-busy"));
    expect(toasts.success).toHaveBeenCalledWith("Alterações salvas", expect.anything());
    // Terminou: voltou a fechar.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/groups"));
  });
});

describe("Detalhe do grupo: envio do composer", () => {
  it("durante o upload da imagem, Esc, o fundo e os botões de fechar não fecham; ao terminar, voltam a fechar", async () => {
    const upload = pending<{ url: string }>();
    svc.uploadCommunityImage.mockReturnValue(upload.promise);
    const { router } = renderDetail();
    const dialog = await screen.findByRole("dialog", { name: "Moda e Estilo" });
    await userEvent.type(screen.getByLabelText("Publicar no grupo"), "Novidade do grupo");
    const imageInput = document.querySelector('input[type="file"][accept^="image"]') as HTMLInputElement;
    await userEvent.upload(imageInput, new File(["x"], "foto.png", { type: "image/png" }));

    await userEvent.click(screen.getByRole("button", { name: "Publicar" }));

    await waitFor(() => expect(dialog).toHaveAttribute("aria-busy", "true"));
    for (const close of screen.getAllByRole("button", { name: "Fechar" })) expect(close).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    fireEvent.click(document.querySelector(".ovb") as HTMLElement);
    expect(router.state.location.pathname).toBe("/admin/groups/g1");

    await act(async () => upload.resolve({ url: "/uploads/a.png" }));
    await waitFor(() => expect(svc.createGroupPost).toHaveBeenCalled());
    await waitFor(() => expect(dialog).not.toHaveAttribute("aria-busy"));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/groups"));
  });

  it("trocar de aba no meio do envio não deixa o diálogo travado", async () => {
    const upload = pending<{ url: string }>();
    svc.uploadCommunityImage.mockReturnValue(upload.promise);
    const { router } = renderDetail();
    const dialog = await screen.findByRole("dialog", { name: "Moda e Estilo" });
    await userEvent.type(screen.getByLabelText("Publicar no grupo"), "Novidade do grupo");
    const imageInput = document.querySelector('input[type="file"][accept^="image"]') as HTMLInputElement;
    await userEvent.upload(imageInput, new File(["x"], "foto.png", { type: "image/png" }));
    await userEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await waitFor(() => expect(dialog).toHaveAttribute("aria-busy", "true"));

    await userEvent.click(screen.getByRole("tab", { name: /Moderadores/ }));

    await waitFor(() => expect(dialog).not.toHaveAttribute("aria-busy"));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/groups"));
  });
});

describe("Detalhe do grupo: abas", () => {
  it("as seções são abas do kit (tablist, aria-selected) com as contagens, e trocam o painel", async () => {
    renderDetail();
    await screen.findByRole("dialog", { name: "Moda e Estilo" });

    const tabs = screen.getByRole("tablist", { name: "Seções do grupo" });
    expect(within(tabs).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Conteúdos1", "Moderadores1", "Editar"]);
    expect(screen.getByRole("tab", { name: /Conteúdos/ })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Dica de look para o verão")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /Moderadores/ }));

    expect(screen.getByRole("tab", { name: /Moderadores/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Moderadores/);
    expect(screen.getByText("@rafalima · Moderador")).toBeInTheDocument();
    expect(screen.queryByText("Dica de look para o verão")).not.toBeInTheDocument();
  });

  it("o painel é o AdminTabPanel do kit: rolável (.gpx-db), ligado à aba e com a aba apontando para ele", async () => {
    renderDetail();
    await screen.findByRole("dialog", { name: "Moda e Estilo" });

    const panel = screen.getByRole("tabpanel");
    const tab = screen.getByRole("tab", { name: /Conteúdos/ });
    expect(panel).toHaveClass("gpx-db", "swp");
    expect(panel).toHaveAttribute("tabindex", "0");
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(within(panel).getByLabelText("Publicar no grupo")).toBeInTheDocument();
  });

  it("setas movem entre as abas", async () => {
    renderDetail();
    await screen.findByRole("dialog", { name: "Moda e Estilo" });
    screen.getByRole("tab", { name: /Conteúdos/ }).focus();

    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: /Moderadores/ })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Detalhe do grupo: confirmações (antes inline na linha)", () => {
  it("remover conteúdo: pede confirmação com o autor e o trecho; cancelar não remove", async () => {
    renderDetail();
    await screen.findByText("Dica de look para o verão");

    await userEvent.click(screen.getByRole("button", { name: "Remover o conteúdo de Marina Alves" }));

    const confirm = screen.getByRole("alertdialog");
    expect(within(confirm).getByText("Remover este conteúdo?")).toBeInTheDocument();
    expect(within(confirm).getByText("Conteúdo de Marina Alves")).toBeInTheDocument();
    expect(within(confirm).getByText("Dica de look para o verão")).toBeInTheDocument();
    expect(within(confirm).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(confirm).getByText(/Esta ação não pode ser desfeita\./)).toBeInTheDocument();
    expect(within(confirm).queryByText(/backoffice/i)).not.toBeInTheDocument();

    await userEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(svc.deleteGroupPost).not.toHaveBeenCalled();
  });

  it("remover conteúdo: confirmar chama a API, avisa e recarrega; o Esc fecha só a confirmação", async () => {
    const { router } = renderDetail();
    await screen.findByText("Dica de look para o verão");
    await userEvent.click(screen.getByRole("button", { name: "Remover o conteúdo de Marina Alves" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/groups/g1");

    await userEvent.click(screen.getByRole("button", { name: "Remover o conteúdo de Marina Alves" }));
    svc.listGroupPosts.mockResolvedValue(postsPage([]));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(svc.deleteGroupPost).toHaveBeenCalledWith("g1", "p1"));
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Conteúdo removido", expect.anything()));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(await screen.findByText("Nenhum conteúdo ainda")).toBeInTheDocument();
  });

  it("remover conteúdo: se falha, a confirmação continua aberta com a mensagem do servidor", async () => {
    svc.deleteGroupPost.mockRejectedValue(new Error("Post not found"));
    renderDetail();
    await screen.findByText("Dica de look para o verão");
    await userEvent.click(screen.getByRole("button", { name: "Remover o conteúdo de Marina Alves" }));

    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remover" }));

    expect(await within(screen.getByRole("alertdialog")).findByText("Post not found")).toBeInTheDocument();
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("remover moderador: confirma com o nome e chama a API com o id do usuário", async () => {
    renderDetail();
    await screen.findByRole("dialog", { name: "Moda e Estilo" });
    await userEvent.click(screen.getByRole("tab", { name: /Moderadores/ }));

    await userEvent.click(screen.getByRole("button", { name: "Remover o moderador Rafa Lima" }));

    const confirm = screen.getByRole("alertdialog");
    expect(within(confirm).getByText("Remover moderador?")).toBeInTheDocument();
    expect(within(confirm).getByText("Rafa Lima deixa de moderar este grupo.")).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(svc.removeGroupModerator).toHaveBeenCalledWith("g1", "m1"));
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Moderador removido", expect.anything()));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("arquivar: o botão da aba Editar abre a confirmação; confirmar arquiva e fecha o grupo", async () => {
    const { router } = renderDetail();
    await screen.findByRole("dialog", { name: "Moda e Estilo" });
    await userEvent.click(screen.getByRole("tab", { name: /Editar/ }));

    await userEvent.click(screen.getByRole("button", { name: "Arquivar" }));

    const confirm = screen.getByRole("alertdialog");
    expect(within(confirm).getByText("Arquivar este grupo?")).toBeInTheDocument();
    expect(within(confirm).getByText(/deixa de aparecer no app dos criadores/)).toBeInTheDocument();
    expect(within(confirm).queryByText(/backoffice/i)).not.toBeInTheDocument();
    expect(svc.deleteGroup).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole("button", { name: "Arquivar" }));

    await waitFor(() => expect(svc.deleteGroup).toHaveBeenCalledWith("g1"));
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Grupo arquivado", expect.anything()));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/groups"));
  });

  it("arquivar: se falha, o diálogo mostra o motivo e o grupo continua aberto", async () => {
    svc.deleteGroup.mockRejectedValue(new Error("Grupo já arquivado"));
    const { router } = renderDetail();
    await screen.findByRole("dialog", { name: "Moda e Estilo" });
    await userEvent.click(screen.getByRole("tab", { name: /Editar/ }));
    await userEvent.click(screen.getByRole("button", { name: "Arquivar" }));

    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Arquivar" }));

    expect(await within(screen.getByRole("alertdialog")).findByText("Grupo já arquivado")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/groups/g1");
  });

  it("não restou nenhuma confirmação inline (hdx-cf) no detalhe", async () => {
    renderDetail();
    await screen.findByText("Dica de look para o verão");
    await userEvent.click(screen.getByRole("button", { name: "Remover o conteúdo de Marina Alves" }));

    expect(document.querySelector(".hdx-cf")).toBeNull();
  });
});

describe("Detalhe do grupo: capa não enviada", () => {
  it("se o envio da capa falha, é um aviso (não informação) e o resto é salvo sem alterar a capa", async () => {
    svc.uploadCommunityImage.mockRejectedValue(new Error("Falha no upload"));
    renderDetail();
    await screen.findByRole("dialog", { name: "Moda e Estilo" });
    await userEvent.click(screen.getByRole("tab", { name: /Editar/ }));
    const input = document.querySelector('input[type="file"][accept^="image"]') as HTMLInputElement;
    await userEvent.upload(input, new File(["x"], "capa.png", { type: "image/png" }));

    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(toasts.warning).toHaveBeenCalledWith("Não foi possível enviar a capa; salvando sem alterá-la.", expect.anything()));
    expect(toasts.info).not.toHaveBeenCalled();
    await waitFor(() => expect(svc.updateGroup).toHaveBeenCalled());
    expect(svc.updateGroup.mock.calls[0][1]).not.toHaveProperty("cover_url");
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Alterações salvas", expect.anything()));
  });
});

describe("Novo grupo: diálogo e passos", () => {
  it("é um diálogo modal; o passo atual é anunciado e o foco começa no nome", async () => {
    renderNew();

    const dialog = await screen.findByRole("dialog", { name: "Criar grupo" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const steps = within(dialog).getByRole("group", { name: "Passos para criar o grupo" });
    const [first, second] = within(steps).getAllByRole("button");
    expect(first).toHaveAttribute("aria-current", "step");
    expect(second).not.toHaveAttribute("aria-current");
    await waitFor(() => expect(screen.getByLabelText("Nome do grupo")).toHaveFocus());
  });

  it("'Continuar' com erro fica no passo e leva o foco ao primeiro campo com problema", async () => {
    renderNew();
    await screen.findByRole("dialog", { name: "Criar grupo" });
    await userEvent.type(screen.getByLabelText("Nome do grupo"), "Games");
    // Só o nome está preenchido: o primeiro campo com erro é a descrição.
    screen.getByRole("button", { name: /Continuar/ }).focus();

    await userEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    const description = screen.getByLabelText("Descrição");
    await waitFor(() => expect(description).toHaveFocus());
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Escreva uma descrição")).toBeInTheDocument();
    const steps = screen.getByRole("group", { name: "Passos para criar o grupo" });
    expect(within(steps).getAllByRole("button")[0]).toHaveAttribute("aria-current", "step");
  });

  it("com os detalhes certos avança para Acesso e cria o grupo com os mesmos dados de antes", async () => {
    const { router } = renderNew();
    await screen.findByRole("dialog", { name: "Criar grupo" });
    await userEvent.type(screen.getByLabelText("Nome do grupo"), "Games");
    await userEvent.type(screen.getByLabelText("Descrição"), "Quem joga");

    await userEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    const steps = screen.getByRole("group", { name: "Passos para criar o grupo" });
    expect(within(steps).getAllByRole("button")[1]).toHaveAttribute("aria-current", "step");
    await userEvent.click(screen.getByRole("button", { name: "Criar grupo" }));

    await waitFor(() =>
      expect(svc.createGroup).toHaveBeenCalledWith({
        name: "Games",
        description: "Quem joga",
        cover_url: null,
        is_official: false,
        rules: null,
        required_level: null,
        required_hype_points: null,
      }),
    );
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Grupo criado", expect.anything()));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/groups/g-new"));
  });

  it("gravando, Esc, o fundo e o botão de fechar não fecham", async () => {
    const create = pending<CommunityGroupDetail>();
    svc.createGroup.mockReturnValue(create.promise);
    const { router } = renderNew();
    await screen.findByRole("dialog", { name: "Criar grupo" });
    await userEvent.type(screen.getByLabelText("Nome do grupo"), "Games");
    await userEvent.type(screen.getByLabelText("Descrição"), "Quem joga");
    await userEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    await userEvent.click(screen.getByRole("button", { name: "Criar grupo" }));

    const dialog = screen.getByRole("dialog", { name: "Criar grupo" });
    await waitFor(() => expect(dialog).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled();
    // Os botões de passo também param: voltar ao passo 1 no meio da gravação não faz sentido.
    const steps = screen.getByRole("group", { name: "Passos para criar o grupo" });
    for (const step of within(steps).getAllByRole("button")) expect(step).toBeDisabled();
    expect(screen.getByRole("button", { name: /Voltar/ })).toBeDisabled();

    await userEvent.keyboard("{Escape}");
    fireEvent.click(document.querySelector(".ovb") as HTMLElement);
    expect(router.state.location.pathname).toBe("/admin/groups/new");

    await act(async () => create.resolve({ ...GROUP, id: "g-new" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/groups/g-new"));
  });

  it("clique no fundo fecha o diálogo vazio, mas não quando há algo digitado (Esc e Fechar continuam fechando)", async () => {
    const first = renderNew();
    await screen.findByRole("dialog", { name: "Criar grupo" });
    fireEvent.click(document.querySelector(".ovb") as HTMLElement);
    await waitFor(() => expect(first.router.state.location.pathname).toBe("/admin/groups"));
    cleanup();

    const { router } = renderNew();
    await screen.findByRole("dialog", { name: "Criar grupo" });
    await userEvent.type(screen.getByLabelText("Nome do grupo"), "Games");
    fireEvent.click(document.querySelector(".ovb") as HTMLElement);
    expect(router.state.location.pathname).toBe("/admin/groups/new");
    expect(screen.getByLabelText("Nome do grupo")).toHaveValue("Games");

    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/groups"));
  });

  it("escolher uma capa também conta como algo feito: o fundo não fecha", async () => {
    const { router } = renderNew();
    await screen.findByRole("dialog", { name: "Criar grupo" });
    const input = document.querySelector('input[type="file"][accept^="image"]') as HTMLInputElement;
    await userEvent.upload(input, new File(["x"], "capa.png", { type: "image/png" }));

    fireEvent.click(document.querySelector(".ovb") as HTMLElement);

    expect(router.state.location.pathname).toBe("/admin/groups/new");
  });

  it("se o envio da capa falha, é um aviso e o grupo é criado sem ela", async () => {
    svc.uploadCommunityImage.mockRejectedValue(new Error("Falha no upload"));
    renderNew();
    await screen.findByRole("dialog", { name: "Criar grupo" });
    const input = document.querySelector('input[type="file"][accept^="image"]') as HTMLInputElement;
    await userEvent.upload(input, new File(["x"], "capa.png", { type: "image/png" }));
    await userEvent.type(screen.getByLabelText("Nome do grupo"), "Games");
    await userEvent.type(screen.getByLabelText("Descrição"), "Quem joga");
    await userEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    await userEvent.click(screen.getByRole("button", { name: "Criar grupo" }));

    await waitFor(() => expect(toasts.warning).toHaveBeenCalledWith("Não foi possível enviar a capa; criando sem ela.", expect.anything()));
    expect(toasts.info).not.toHaveBeenCalled();
    await waitFor(() => expect(svc.createGroup).toHaveBeenCalledWith(expect.objectContaining({ cover_url: null })));
  });

  it("sem gravar, Esc fecha e volta à aba Grupos", async () => {
    const { router } = renderNew();
    await screen.findByRole("dialog", { name: "Criar grupo" });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/groups"));
    expect(router.state.location.search).toMatchObject({ tab: "groups" });
  });
});

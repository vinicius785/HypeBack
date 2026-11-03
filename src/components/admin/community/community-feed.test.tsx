import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posts = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/shared/services/community-posts", () => ({
  listCommunityPosts: posts.list,
  deleteCommunityPost: posts.remove,
}));
vi.mock("sonner", () => ({ toast: toasts }));

import { renderAdminRoute, stubRoute } from "@/test/render-admin-route";

import { CommunityFeed } from "./community-feed";
import { GROUP_REF, makePost, postPage } from "./community-fixtures";

const NOW = new Date("2026-11-02T14:00:00.000Z");

function renderFeed() {
  return renderAdminRoute([{ path: "/admin/groups", component: CommunityFeed }, stubRoute("/admin/groups/$groupId")], "/admin/groups");
}

function lastQuery(): Record<string, unknown> {
  return posts.list.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  posts.list.mockReset();
  posts.remove.mockReset();
  toasts.success.mockReset();
  toasts.error.mockReset();
  posts.list.mockResolvedValue(postPage([makePost()]));
  posts.remove.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CommunityFeed: a lista", () => {
  it("mostra a publicação com autor, quando foi feita, texto, curtidas e comentários", async () => {
    renderFeed();

    const item = (await screen.findByText("Gravei um vídeo novo hoje!")).closest("li") as HTMLElement;
    expect(within(item).getByText("Marina Alves")).toBeInTheDocument();
    expect(within(item).getByText(/há 2 horas/)).toBeInTheDocument();
    expect(within(item).getByText("12 curtidas")).toBeInTheDocument();
    expect(within(item).getByText("3 comentários")).toBeInTheDocument();
  });

  it("começa por todas as publicações, sem filtro de grupo nem de busca", async () => {
    renderFeed();
    await screen.findByText("Gravei um vídeo novo hoje!");

    expect(lastQuery()).toMatchObject({ group: "all", search: undefined, cursor: null, limit: 20 });
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("no singular: 1 curtida, 1 comentário", async () => {
    posts.list.mockResolvedValue(postPage([makePost({ likes_count: 1, comments_count: 1 })]));
    renderFeed();

    expect(await screen.findByText("1 curtida")).toBeInTheDocument();
    expect(screen.getByText("1 comentário")).toBeInTheDocument();
  });

  it("publicação de grupo traz o nome do grupo, que leva ao grupo; a de fora de grupos não traz etiqueta", async () => {
    posts.list.mockResolvedValue(
      postPage([
        makePost({ id: "p-grupo", content: "Dica de look", group: GROUP_REF }),
        makePost({ id: "p-geral", content: "Bom dia, pessoal" }),
      ]),
    );
    renderFeed();

    const withGroup = (await screen.findByText("Dica de look")).closest("li") as HTMLElement;
    const link = within(withGroup).getByRole("link", { name: "Moda e Estilo" });
    expect(link).toHaveAttribute("href", "/admin/groups/g-moda");

    const withoutGroup = screen.getByText("Bom dia, pessoal").closest("li") as HTMLElement;
    expect(within(withoutGroup).queryByRole("link")).not.toBeInTheDocument();
  });

  it("vídeo aparece com player; quando o post traz vídeo e imagem, o vídeo ganha", async () => {
    posts.list.mockResolvedValue(
      postPage([
        makePost({
          video_url: "https://cdn.test/post.mp4",
          video_thumbnail_url: "https://cdn.test/poster.jpg",
          image_url: "https://cdn.test/post.jpg",
        }),
      ]),
    );
    renderFeed();

    const video = await screen.findByLabelText("Vídeo da publicação");
    expect(video).toHaveAttribute("src", "https://cdn.test/post.mp4");
    expect(video).toHaveAttribute("poster", "https://cdn.test/poster.jpg");
    expect(screen.queryByAltText("Imagem da publicação")).not.toBeInTheDocument();
  });

  it("imagem aparece quando não há vídeo", async () => {
    posts.list.mockResolvedValue(postPage([makePost({ image_url: "https://cdn.test/post.jpg" })]));
    renderFeed();

    expect(await screen.findByAltText("Imagem da publicação")).toHaveAttribute("src", "https://cdn.test/post.jpg");
    expect(screen.queryByLabelText("Vídeo da publicação")).not.toBeInTheDocument();
  });

  it("publicação só com mídia (sem texto) não deixa um parágrafo vazio", async () => {
    posts.list.mockResolvedValue(postPage([makePost({ content: "", image_url: "https://cdn.test/post.jpg" })]));
    const { container } = renderFeed();

    await screen.findByAltText("Imagem da publicação");
    expect(container.querySelector(".adm-com-text")).toBeNull();
  });

  it("a mesma publicação em duas páginas aparece uma vez só", async () => {
    posts.list
      .mockResolvedValueOnce(postPage([makePost({ id: "p1" }), makePost({ id: "p2", content: "Segunda" })], "c1"))
      .mockResolvedValueOnce(postPage([makePost({ id: "p2", content: "Segunda" }), makePost({ id: "p3", content: "Terceira" })]));
    renderFeed();

    await screen.findByText("Segunda");
    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await screen.findByText("Terceira");

    expect(screen.getAllByText("Segunda")).toHaveLength(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("CommunityFeed: filtros e paginação", () => {
  it("'Sem grupo' pede só o que está fora de grupos", async () => {
    renderFeed();
    await screen.findByText("Gravei um vídeo novo hoje!");

    await userEvent.click(screen.getByRole("button", { name: "Sem grupo" }));

    await waitFor(() => expect(lastQuery()).toMatchObject({ group: "none" }));
    expect(screen.getByRole("button", { name: "Sem grupo" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a busca vai para a API com o texto aparado, e Enter busca na hora", async () => {
    renderFeed();
    await screen.findByText("Gravei um vídeo novo hoje!");

    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar publicações" }), "  viagem  {Enter}");

    await waitFor(() => expect(lastQuery()).toMatchObject({ search: "viagem" }));
  });

  it("busca sem resultado diz o que foi buscado e 'Limpar busca' volta à lista", async () => {
    posts.list.mockImplementation(async (params: { search?: string }) =>
      postPage(params.search ? [] : [makePost()]),
    );
    renderFeed();
    await screen.findByText("Gravei um vídeo novo hoje!");

    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar publicações" }), "xyz{Enter}");

    const empty = await screen.findByRole("status");
    expect(within(empty).getByText("Nenhuma publicação encontrada")).toBeInTheDocument();
    expect(within(empty).getByText(/com “xyz”/)).toBeInTheDocument();

    // O campo de busca também tem um "Limpar busca" (o ×): o do estado vazio é o que fica junto da mensagem.
    await userEvent.click(within(empty).getByRole("button", { name: "Limpar busca" }));

    expect(await screen.findByText("Gravei um vídeo novo hoje!")).toBeInTheDocument();
    await waitFor(() => expect(lastQuery()).toMatchObject({ search: undefined }));
  });

  it("'Carregar mais' pede a página seguinte pelo cursor e some quando não há mais", async () => {
    posts.list
      .mockResolvedValueOnce(postPage([makePost({ id: "p1" })], "cursor-1"))
      .mockResolvedValueOnce(postPage([makePost({ id: "p2", content: "Mais antiga" })]));
    renderFeed();
    await screen.findByText("Gravei um vídeo novo hoje!");

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("Mais antiga")).toBeInTheDocument();
    expect(lastQuery()).toMatchObject({ cursor: "cursor-1" });
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });
});

describe("CommunityFeed: estados", () => {
  it("sem publicações: diz que ainda não há nenhuma", async () => {
    posts.list.mockResolvedValue(postPage([]));
    renderFeed();

    expect(await screen.findByText("Nenhuma publicação ainda")).toBeInTheDocument();
  });

  it("sem publicações fora de grupos: o texto acompanha o filtro", async () => {
    posts.list.mockImplementation(async (params: { group?: string }) => postPage(params.group === "none" ? [] : [makePost()]));
    renderFeed();
    await screen.findByText("Gravei um vídeo novo hoje!");

    await userEvent.click(screen.getByRole("button", { name: "Sem grupo" }));

    expect(await screen.findByText("Nenhuma publicação fora de grupos")).toBeInTheDocument();
  });

  it("falha ao carregar: mostra o motivo e 'Tentar de novo' busca outra vez", async () => {
    // A consulta tenta de novo sozinha antes de desistir: falha em todas as tentativas.
    posts.list.mockRejectedValue(new Error("Falha ao listar posts (500)"));
    renderFeed();

    expect(await screen.findByText("Não foi possível carregar o feed")).toBeInTheDocument();
    expect(screen.getByText("Falha ao listar posts (500)")).toBeInTheDocument();

    posts.list.mockResolvedValue(postPage([makePost()]));
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Gravei um vídeo novo hoje!")).toBeInTheDocument();
  });

  it("enquanto carrega mostra o esqueleto, sem lista", async () => {
    posts.list.mockReturnValue(new Promise(() => {}));
    renderFeed();

    expect(await screen.findByRole("status")).toHaveTextContent("Carregando…");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("CommunityFeed: remover", () => {
  async function openRemove() {
    renderFeed();
    await screen.findByText("Gravei um vídeo novo hoje!");
    await userEvent.click(screen.getByRole("button", { name: "Remover a publicação de Marina Alves" }));
    return screen.getByRole("alertdialog");
  }

  it("pede confirmação, com quem publicou e o trecho do texto, e não pede motivo", async () => {
    const dialog = await openRemove();

    expect(within(dialog).getByText("Remover esta publicação?")).toBeInTheDocument();
    expect(within(dialog).getByText("Publicação de Marina Alves")).toBeInTheDocument();
    expect(within(dialog).getByText("Gravei um vídeo novo hoje!")).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(posts.remove).not.toHaveBeenCalled();
  });

  it("cancelar não remove nada", async () => {
    const dialog = await openRemove();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(posts.remove).not.toHaveBeenCalled();
  });

  it("confirmar remove a publicação, avisa e recarrega o feed", async () => {
    const dialog = await openRemove();
    const loadsBefore = posts.list.mock.calls.length;
    posts.list.mockResolvedValue(postPage([]));

    await userEvent.click(within(dialog).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(posts.remove).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Publicação removida"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(await screen.findByText("Nenhuma publicação ainda")).toBeInTheDocument();
    expect(posts.list.mock.calls.length).toBeGreaterThan(loadsBefore);
  });

  it("se a remoção falha, o diálogo continua aberto com a mensagem do servidor", async () => {
    posts.remove.mockRejectedValue(new Error("Post not found"));
    const dialog = await openRemove();

    await userEvent.click(within(dialog).getByRole("button", { name: "Remover" }));

    expect(await within(screen.getByRole("alertdialog")).findByText("Post not found")).toBeInTheDocument();
    expect(toasts.success).not.toHaveBeenCalled();
    expect(screen.getByText("Gravei um vídeo novo hoje!", { selector: ".adm-com-text" })).toBeInTheDocument();
  });
});

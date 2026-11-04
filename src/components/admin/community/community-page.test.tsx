import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posts = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn() }));
const groups = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/shared/services/community-posts", () => ({
  listCommunityPosts: posts.list,
  deleteCommunityPost: posts.remove,
}));
vi.mock("@/shared/services/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/groups")>()),
  listGroups: groups.list,
}));

import { currentSearch, renderAdminRoute, stubRoute } from "@/test/render-admin-route";
import type { CommunityGroup } from "@/shared/types";

import { CommunityPage } from "./community-page";
import { makePost, postPage } from "./community-fixtures";
import { validateCommunitySearch } from "./community-search";

const GROUP: CommunityGroup = {
  id: "g-moda",
  name: "Moda e Estilo",
  description: "Looks, tendências e bastidores",
  cover_url: null,
  icon_name: null,
  icon_color: null,
  required_level: null,
  required_hype_points: null,
  members_count: 120,
  is_official: false,
  posts_count: 8,
  deleted_at: null,
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:00:00.000Z",
};

function renderPage(url = "/admin/groups") {
  return renderAdminRoute(
    [
      { path: "/admin/groups", component: CommunityPage, validateSearch: validateCommunitySearch },
      stubRoute("/admin/groups/new"),
      stubRoute("/admin/groups/$groupId"),
    ],
    url,
  );
}

function tab(name: string) {
  return screen.getByRole("tab", { name });
}

beforeEach(() => {
  posts.list.mockReset();
  posts.remove.mockReset();
  groups.list.mockReset();
  posts.list.mockResolvedValue(postPage([makePost()]));
  groups.list.mockResolvedValue({ items: [GROUP], meta: { next_cursor: null, has_more: false } });
});

afterEach(cleanup);

describe("CommunityPage: abre na comunidade padrão", () => {
  it("o Feed vem primeiro, selecionado, e mostra as publicações dos criadores", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Comunidade", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Feed", "Grupos", "Equipe"]);
    expect(tab("Feed")).toHaveAttribute("aria-selected", "true");
    expect(tab("Grupos")).toHaveAttribute("aria-selected", "false");
    expect(await screen.findByText("Gravei um vídeo novo hoje!")).toBeInTheDocument();
  });

  it("no Feed não busca os grupos e o cabeçalho não tem ação nenhuma (Atualizar mora na barra do Feed)", async () => {
    renderPage();
    await screen.findByText("Gravei um vídeo novo hoje!");

    expect(groups.list).not.toHaveBeenCalled();
    const header = screen.getByRole("banner");
    expect(within(header).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar grupo" })).not.toBeInTheDocument();
    // "Atualizar" é um ícone no fim da barra de filtros, não um botão de texto do cabeçalho.
    const refresh = screen.getByRole("button", { name: "Atualizar" });
    expect(refresh.closest(".adm-filters")).not.toBeNull();
    expect(refresh).toHaveTextContent("");
  });

  it("Atualizar busca o feed de novo", async () => {
    renderPage();
    await screen.findByText("Gravei um vídeo novo hoje!");
    const before = posts.list.mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() => expect(posts.list.mock.calls.length).toBeGreaterThan(before));
  });

  it("aba desconhecida na URL cai no Feed", async () => {
    renderPage("/admin/groups?tab=outra");

    expect(await screen.findByText("Gravei um vídeo novo hoje!")).toBeInTheDocument();
    expect(tab("Feed")).toHaveAttribute("aria-selected", "true");
  });
});

describe("CommunityPage: a função dos grupos continua aqui", () => {
  it("?tab=groups abre direto nos Grupos, com a lista e o Criar grupo do cabeçalho", async () => {
    renderPage("/admin/groups?tab=groups");

    expect(await screen.findByText("Moda e Estilo")).toBeInTheDocument();
    expect(tab("Grupos")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Criar grupo" })).toBeInTheDocument();
    expect(posts.list).not.toHaveBeenCalled();
  });

  it("trocar de aba pelo clique grava a aba na URL; voltar ao Feed a tira (é o padrão)", async () => {
    const { router } = renderPage();
    await screen.findByText("Gravei um vídeo novo hoje!");

    await userEvent.click(tab("Grupos"));

    expect(await screen.findByText("Moda e Estilo")).toBeInTheDocument();
    expect(currentSearch(router).tab).toBe("groups");
    expect(screen.queryByText("Gravei um vídeo novo hoje!")).not.toBeInTheDocument();

    await userEvent.click(tab("Feed"));

    expect(await screen.findByText("Gravei um vídeo novo hoje!")).toBeInTheDocument();
    expect(currentSearch(router).tab).toBeUndefined();
  });

  it("o subtítulo é fixo: não muda com a aba", async () => {
    renderPage();
    await screen.findByText("Gravei um vídeo novo hoje!");
    const subtitle = screen.getByRole("banner").querySelector(".adm-head-sub")?.textContent;
    expect(subtitle).toMatch(/publicam no app e os grupos deles/);

    await userEvent.click(tab("Grupos"));
    await screen.findByText("Moda e Estilo");

    expect(screen.getByRole("banner").querySelector(".adm-head-sub")?.textContent).toBe(subtitle);
  });

  it("o cabeçalho só tem a ação primária da aba: Criar grupo nos Grupos, nenhuma no Feed", async () => {
    renderPage("/admin/groups?tab=groups");
    await screen.findByText("Moda e Estilo");

    const buttons = within(screen.getByRole("banner")).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Criar grupo"]);
    expect(screen.queryByRole("button", { name: "Atualizar" })).not.toBeInTheDocument();
  });

  it("Criar grupo leva ao diálogo de novo grupo", async () => {
    const { router } = renderPage("/admin/groups?tab=groups");
    await screen.findByText("Moda e Estilo");

    await userEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Criar grupo" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/groups/new"));
  });

  it("abrir um grupo da lista leva ao diálogo daquele grupo", async () => {
    const { router } = renderPage("/admin/groups?tab=groups");

    await userEvent.click(await screen.findByRole("button", { name: /Moda e Estilo/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/groups/g-moda"));
  });
});

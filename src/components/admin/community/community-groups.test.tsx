import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const groups = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/shared/services/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/groups")>()),
  listGroups: groups.list,
}));

import { renderAdminRoute, stubRoute } from "@/test/render-admin-route";
import type { CommunityGroup } from "@/shared/types";

import { CommunityGroups } from "./community-groups";

function makeGroup(overrides: Partial<CommunityGroup> = {}): CommunityGroup {
  return {
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
    ...overrides,
  };
}

const page = (items: CommunityGroup[], next: string | null = null) => ({
  items,
  meta: { next_cursor: next, has_more: next !== null },
});

function renderGroups() {
  return renderAdminRoute(
    [{ path: "/admin/groups", component: CommunityGroups }, stubRoute("/admin/groups/new"), stubRoute("/admin/groups/$groupId")],
    "/admin/groups",
  );
}

function lastQuery(): Record<string, unknown> {
  return groups.list.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  groups.list.mockReset();
  groups.list.mockResolvedValue(page([makeGroup()]));
});

afterEach(cleanup);

describe("CommunityGroups: filtros", () => {
  it("usa a barra de filtros do kit: segmento de estado e busca com rótulo, e começa pelos ativos", async () => {
    renderGroups();
    await screen.findByText("Moda e Estilo");

    expect(lastQuery()).toMatchObject({ status: "active", search: undefined });
    // o estado é um filtro do painel (ícone de filtro), não um segmento na barra
    const status = screen.getByRole("combobox", { name: "Status dos grupos" });
    expect(status).toHaveValue("active");
    expect(within(status).getAllByRole("option").map((o) => o.textContent)).toEqual(["Ativos", "Arquivados", "Todos"]);
    expect(screen.getByRole("searchbox", { name: "Buscar grupos" })).toBeInTheDocument();
  });

  it("trocar o estado pede aquele estado à API", async () => {
    renderGroups();
    await screen.findByText("Moda e Estilo");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status dos grupos" }), "Arquivados");
    await waitFor(() => expect(lastQuery()).toMatchObject({ status: "deleted" }));

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status dos grupos" }), "Todos");
    await waitFor(() => expect(lastQuery()).toMatchObject({ status: "all" }));
  });

  it("a busca vai para a API aparada, e Enter busca na hora", async () => {
    renderGroups();
    await screen.findByText("Moda e Estilo");

    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar grupos" }), "  moda  {Enter}");

    await waitFor(() => expect(lastQuery()).toMatchObject({ search: "moda" }));
  });
});

describe("CommunityGroups: segmento como filtro", () => {
  it("Ativos é o padrão e não conta como filtro; Arquivados vira chip e 'Limpar filtros' volta aos Ativos", async () => {
    renderGroups();
    await screen.findByText("Moda e Estilo");
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status dos grupos" }), "Arquivados");

    await waitFor(() => expect(lastQuery()).toMatchObject({ status: "deleted" }));
    expect(screen.getByRole("button", { name: "Remover filtro Status dos grupos: Arquivados" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => expect(lastQuery()).toMatchObject({ status: "active" }));
    expect(screen.getByRole("combobox", { name: "Status dos grupos" })).toHaveValue("active");
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });
});

describe("CommunityGroups: a lista", () => {
  it("não tem o cartão 'Criar grupo' no meio da lista (o botão é só o do cabeçalho)", async () => {
    renderGroups();
    await screen.findByText("Moda e Estilo");

    expect(screen.queryByRole("button", { name: /Criar grupo/ })).not.toBeInTheDocument();
  });

  it("abrir um grupo leva ao diálogo dele, com Enter e com Espaço", async () => {
    const { router } = renderGroups();
    const card = await screen.findByRole("button", { name: /Moda e Estilo/ });
    card.focus();

    await userEvent.keyboard(" ");

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/groups/g-moda"));
  });

  it("'Carregar mais' pede a página seguinte e o contador conta os grupos carregados", async () => {
    groups.list
      .mockResolvedValueOnce(page([makeGroup({ id: "g1" })], "c1"))
      .mockResolvedValueOnce(page([makeGroup({ id: "g2", name: "Games" })]));
    renderGroups();
    await screen.findByText("Moda e Estilo");
    expect(screen.getByText("1 grupo carregado")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("Games")).toBeInTheDocument();
    expect(lastQuery()).toMatchObject({ cursor: "c1" });
    expect(screen.getByText("2 grupos carregados · fim da lista")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });
});

describe("CommunityGroups: estados do kit", () => {
  it("carregando: esqueleto anunciado, sem lista", async () => {
    groups.list.mockReturnValue(new Promise(() => {}));
    renderGroups();

    expect(await screen.findByText("Carregando grupos…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Moda e Estilo/ })).not.toBeInTheDocument();
  });

  it("falha: mostra o motivo e 'Tentar de novo' busca outra vez", async () => {
    groups.list.mockRejectedValue(new Error("Falha ao listar grupos (500)"));
    renderGroups();

    expect(await screen.findByText("Não foi possível carregar os grupos")).toBeInTheDocument();
    expect(screen.getByText("Falha ao listar grupos (500)")).toBeInTheDocument();

    groups.list.mockResolvedValue(page([makeGroup()]));
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Moda e Estilo")).toBeInTheDocument();
  });

  it("sem grupos: o vazio só orienta para o 'Criar grupo' do cabeçalho, sem repetir o botão", async () => {
    groups.list.mockResolvedValue(page([]));
    renderGroups();

    const empty = (await screen.findByText("Nenhum grupo ainda")).closest('[role="status"]') as HTMLElement;

    expect(within(empty).queryByRole("button")).not.toBeInTheDocument();
    expect(within(empty).getByText(/“Criar grupo”, no topo da página/)).toBeInTheDocument();
    // Esta aba sozinha não tem nenhum "Criar grupo" (o único da tela é o do cabeçalho da página).
    expect(screen.queryByRole("button", { name: "Criar grupo" })).not.toBeInTheDocument();
  });

  it("arquivados vazio: só o texto, sem ação de criar", async () => {
    groups.list.mockImplementation(async (params: { status?: string }) =>
      page(params.status === "deleted" ? [] : [makeGroup()]),
    );
    renderGroups();
    await screen.findByText("Moda e Estilo");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status dos grupos" }), "Arquivados");

    const empty = (await screen.findByText("Nenhum grupo arquivado")).closest('[role="status"]') as HTMLElement;
    expect(within(empty).queryByRole("button")).not.toBeInTheDocument();
  });

  it("busca sem resultado: diz o que foi buscado e 'Limpar busca' volta à lista", async () => {
    groups.list.mockImplementation(async (params: { search?: string }) => page(params.search ? [] : [makeGroup()]));
    renderGroups();
    await screen.findByText("Moda e Estilo");

    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar grupos" }), "xyz{Enter}");

    const empty = (await screen.findByText("Nenhum grupo encontrado")).closest('[role="status"]') as HTMLElement;
    expect(within(empty).getByText(/corresponde a “xyz”/)).toBeInTheDocument();
    expect(within(empty).queryByRole("button", { name: "Criar grupo" })).not.toBeInTheDocument();

    await userEvent.click(within(empty).getByRole("button", { name: "Limpar busca" }));

    expect(await screen.findByText("Moda e Estilo")).toBeInTheDocument();
  });
});

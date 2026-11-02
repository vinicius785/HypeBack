import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  adminList: vi.fn(),
  adminGet: vi.fn(),
  adminGetEnvelope: vi.fn(),
  adminPost: vi.fn(),
  adminPatch: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return {
    ...actual,
    adminList: client.adminList,
    adminGet: client.adminGet,
    adminGetEnvelope: client.adminGetEnvelope,
    adminPost: client.adminPost,
    adminPatch: client.adminPatch,
  };
});

vi.mock("@/hooks/admin/use-admin-creators-profile", () => ({
  useAdminCreatorsNicheProfile: () => ({ data: undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }),
  useAdminCreatorsSizeProfile: () => ({ data: undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }),
}));

import { currentSearch } from "@/test/render-admin-route";

import { DUPLICATE_GROUP, INCONSISTENCIES, makeCreator, pageOf } from "./creator-fixtures";
import { renderCreators } from "./creator-test-utils";

const COMPUTED_AT = "2026-10-31T15:00:00.000Z";

/** Quantas consultas já saíram para cada caminho. */
function callsTo(path: string): number {
  return client.adminList.mock.calls.filter(([p]) => p === path).length;
}

beforeEach(() => {
  for (const mock of Object.values(client)) mock.mockReset();
  client.adminList.mockImplementation(async (path: string) =>
    path === "/admin/creators/duplicates" ? pageOf([DUPLICATE_GROUP]) : pageOf([makeCreator()]),
  );
  client.adminGetEnvelope.mockImplementation(async () => ({ data: INCONSISTENCIES, meta: { computed_at: COMPUTED_AT } }));
});

afterEach(() => {
  cleanup();
});

describe("Criadores: cabeçalho e abas", () => {
  it("título, subtítulo e as três abas, com a de criadores aberta por padrão", async () => {
    renderCreators();
    expect(await screen.findByRole("heading", { level: 1, name: "Criadores" })).toBeInTheDocument();
    expect(screen.getByText("A base de criadores da plataforma.")).toBeInTheDocument();

    const tabs = within(screen.getByRole("tablist", { name: "Seções de criadores" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Criadores", "Duplicados", "Inconsistências"]);
    expect(screen.getByRole("tab", { name: "Criadores" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("table", { name: "Criadores" })).toBeInTheDocument();
  });

  it("só a aba aberta consulta o servidor", async () => {
    renderCreators();
    await screen.findByText("Rafael Borges Mendes");
    expect(callsTo("/admin/creators")).toBe(1);
    expect(callsTo("/admin/creators/duplicates")).toBe(0);
    expect(client.adminGetEnvelope).not.toHaveBeenCalled();
  });

  it("trocar de aba muda a URL, mostra a aba e só então consulta o que ela precisa", async () => {
    const { router } = renderCreators();
    await screen.findByText("Rafael Borges Mendes");

    await userEvent.click(screen.getByRole("tab", { name: "Duplicados" }));
    expect(await screen.findByRole("article", { name: /E-mail/ })).toBeInTheDocument();
    expect(currentSearch(router)).toEqual({ tab: "duplicates" });
    expect(screen.getByRole("tab", { name: "Duplicados" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("table", { name: "Criadores" })).not.toBeInTheDocument();
    expect(client.adminGetEnvelope).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("tab", { name: "Inconsistências" }));
    expect(await screen.findByRole("article", { name: "Workspaces de marca sem proprietário" })).toBeInTheDocument();
    expect(currentSearch(router)).toEqual({ tab: "inconsistencies" });
    expect(screen.queryByRole("article", { name: /E-mail/ })).not.toBeInTheDocument();

    // voltar para a primeira aba não escreve nada na URL
    await userEvent.click(screen.getByRole("tab", { name: "Criadores" }));
    expect(await screen.findByText("Rafael Borges Mendes")).toBeInTheDocument();
    expect(currentSearch(router)).toEqual({});
  });

  it("trocar de aba não arrasta os filtros de uma para a outra (nem para a URL, nem para a consulta)", async () => {
    const { router } = renderCreators("/admin/creators?registration=incomplete&network=tiktok&search=ana&page=2&sort_by=name&order=asc");
    await screen.findByText("Rafael Borges Mendes");
    expect(client.adminList.mock.calls.at(-1)?.[1]).toMatchObject({ registration: "incomplete", network: "tiktok", search: "ana" });

    await userEvent.click(screen.getByRole("tab", { name: "Duplicados" }));
    await screen.findByRole("article", { name: /E-mail/ });
    expect(currentSearch(router)).toEqual({ tab: "duplicates" });
    const dupCall = client.adminList.mock.calls.filter(([path]) => path === "/admin/creators/duplicates").at(-1);
    expect(dupCall?.[1]).toEqual({ page: 1, per_page: 10 });

    // ao voltar, os filtros da aba de criadores recomeçam do zero
    await userEvent.click(screen.getByRole("tab", { name: "Criadores" }));
    await screen.findByText("Rafael Borges Mendes");
    expect(client.adminList.mock.calls.at(-1)?.[1]).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" });
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("o link de uma aba abre direto nela, e uma aba desconhecida na URL cai na de criadores", async () => {
    renderCreators("/admin/creators?tab=inconsistencies");
    expect(await screen.findByRole("article", { name: "Workspaces de marca sem proprietário" })).toBeInTheDocument();
    expect(callsTo("/admin/creators")).toBe(0);
    cleanup();

    renderCreators("/admin/creators?tab=qualquer");
    expect(await screen.findByRole("table", { name: "Criadores" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Criadores" })).toHaveAttribute("aria-selected", "true");
  });

  it("o painel aberto é ligado à aba (WAI-ARIA)", async () => {
    renderCreators("/admin/creators?tab=duplicates");
    await screen.findByRole("article", { name: /E-mail/ });
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", screen.getByRole("tab", { name: "Duplicados" }).id);
  });

  it("a tela inteira é só leitura: nenhuma aba chama escrita", async () => {
    renderCreators();
    await screen.findByText("Rafael Borges Mendes");
    await userEvent.click(screen.getByRole("tab", { name: "Duplicados" }));
    await screen.findByRole("article", { name: /E-mail/ });
    await userEvent.click(screen.getByRole("tab", { name: "Inconsistências" }));
    await screen.findByRole("article", { name: "Workspaces de marca sem proprietário" });
    await waitFor(() => expect(client.adminGetEnvelope).toHaveBeenCalled());
    expect(client.adminPost).not.toHaveBeenCalled();
    expect(client.adminPatch).not.toHaveBeenCalled();
  });
});

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminList: vi.fn(),
  adminFeed: vi.fn(),
  adminPost: vi.fn(),
  adminPatch: vi.fn(),
}));
vi.mock("@/lib/admin/admin-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/admin-client")>()),
  ...api,
}));
vi.mock("@tanstack/react-router", async () => (await import("./test-support")).routerModuleMock());

import { toAdminApiError } from "@/lib/admin/admin-client";

import { deferred, listOf, makeCampaign, makeDetail, NOW_ISO, renderWithQuery, routeReads, WS_ID } from "./test-support";
import { WorkspaceCampaignsTab } from "./workspace-campaigns-tab";

const PATH = `/admin/workspaces/${WS_ID}/campaigns`;
const FESTIVAL = makeCampaign();
const RASCUNHO = makeCampaign({
  id: "ca3b0000-0000-4000-8000-000000000002",
  title: "Rascunho de inverno",
  status: "draft",
  participants: { total: 0, participating: 0 },
  committed_cents: 0,
  released_cents: 0,
  created_at: "2026-10-01T12:00:00.000Z",
});

const lastParams = () => api.adminList.mock.calls.at(-1)?.[1] as Record<string, unknown>;
const rowOf = (text: string) => screen.getByText(text).closest('[role="row"]') as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
  Object.values(api).forEach((mock) => mock.mockReset());
  routeReads(api.adminList, {
    [PATH]: (query) =>
      listOf([FESTIVAL, RASCUNHO], 60, Number(query?.page ?? 1), 25, {
        participants: "Total = todas as participações; em andamento = os 14 estados que ocupam vaga.",
        committed_cents: "Reservas em aberto desta campanha.",
      }),
  });
});
afterEach(() => vi.useRealTimers());

function renderTab() {
  return renderWithQuery(<WorkspaceCampaignsTab workspace={makeDetail()} />);
}

describe("WorkspaceCampaignsTab", () => {
  it("título, status, criadores (em andamento / total), comprometido, liberado e data", async () => {
    renderTab();
    await screen.findByText("Festival Café Serra Verde");

    const festival = rowOf("Festival Café Serra Verde");
    expect(within(festival).getByText("Publicada", { selector: ".adm-badge" })).toBeInTheDocument();
    expect(within(festival).getByText("5", { selector: "b" })).toBeInTheDocument();
    expect(within(festival).getByText(/\/ 12/)).toBeInTheDocument();
    expect(within(festival).getByText("R$ 2.500,00")).toBeInTheDocument();
    expect(within(festival).getByText("R$ 800,00")).toBeInTheDocument();
    expect(within(festival).getByText("10/09/2026")).toBeInTheDocument();
    expect(within(rowOf("Rascunho de inverno")).getByText("Rascunho", { selector: ".adm-badge" })).toBeInTheDocument();
  });

  it("a linha leva à campanha (/admin/campaigns/:id)", async () => {
    renderTab();
    const link = await screen.findByRole("link", { name: /Festival Café Serra Verde/ });
    expect(link).toHaveAttribute("href", `/admin/campaigns/${FESTIVAL.id}`);
  });

  it("pede ao servidor as campanhas DESTE workspace, mais novas primeiro", async () => {
    renderTab();
    await screen.findByText("Festival Café Serra Verde");
    expect(api.adminList.mock.calls[0][0]).toBe(PATH);
    expect(lastParams()).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" });
    expect(screen.getByRole("columnheader", { name: /Criada em/ })).toHaveAttribute("aria-sort", "descending");
  });

  it.each([
    ["Campanha", "title", "asc"],
    ["Criadores", "creators", "desc"],
    ["Comprometido", "committed", "desc"],
    ["Liberado", "released", "desc"],
  ])("cabeçalho %s ordena por %s, começando em %s, e inverte no segundo clique", async (header, sortBy, order) => {
    renderTab();
    await screen.findByText("Festival Café Serra Verde");
    const table = screen.getByRole("table", { name: "Campanhas do workspace" });

    await userEvent.click(within(table).getByRole("button", { name: new RegExp(`^${header}`) }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: sortBy, order, page: 1 }));

    await userEvent.click(within(table).getByRole("button", { name: new RegExp(`^${header}`) }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: sortBy, order: order === "asc" ? "desc" : "asc" }));
  });

  it("mostra a definição do servidor nas colunas que a têm", async () => {
    renderTab();
    await screen.findByText("Festival Café Serra Verde");
    expect(screen.getByRole("button", { name: "Como é calculado: Criadores" })).toHaveAccessibleDescription(/em andamento = os 14 estados/);
    expect(screen.getByRole("button", { name: "Como é calculado: Comprometido" })).toHaveAccessibleDescription("Reservas em aberto desta campanha.");
    expect(screen.queryByRole("button", { name: "Como é calculado: Liberado" })).not.toBeInTheDocument();
  });

  it("paginação numerada com o total do servidor", async () => {
    renderTab();
    await screen.findByText("Festival Café Serra Verde");
    expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("1–25 de 60");

    await userEvent.click(screen.getByRole("button", { name: "Página 2" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));
  });

  it("carregando, vazio e erro", async () => {
    api.adminList.mockReturnValue(deferred<never>().promise);
    const loading = renderTab();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
    loading.unmount();

    routeReads(api.adminList, { [PATH]: listOf([]) });
    const empty = renderTab();
    expect(await screen.findByText("Nenhuma campanha")).toBeInTheDocument();
    empty.unmount();

    api.adminList.mockRejectedValue(toAdminApiError(404, { statusCode: 404, message: "Cannot GET /x" }));
    renderTab();
    expect(await screen.findByText("Recurso indisponível")).toBeInTheDocument();
  });
});

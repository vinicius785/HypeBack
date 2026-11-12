/**
 * O Dashboard com o roteador DE VERDADE (histórico em memória): confere o que o teste da página, que simula o roteador,
 * não pode conferir: o `validateSearch` da rota, o período na URL ao trocar, e os links dos cartões abrindo a rota de
 * destino com os filtros certos na busca.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminGetEnvelope: vi.fn(),
  adminFeed: vi.fn(),
  adminList: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: api.adminGet, adminGetEnvelope: api.adminGetEnvelope, adminFeed: api.adminFeed, adminList: api.adminList };
});

import { readPeriodSearch } from "@/lib/admin/period";

import { AdminDashboardPage } from "./admin-dashboard-page";
import { ALERTS, EVENTS, OVERVIEW } from "./dashboard-fixtures";

const NOW = Date.UTC(2026, 9, 31, 15, 0, 0);

function buildRouter(initialUrl: string) {
  const root = createRootRoute({ component: Outlet });
  const dashboard = createRoute({
    getParentRoute: () => root,
    path: "/admin/dashboard",
    validateSearch: readPeriodSearch,
    component: AdminDashboardPage,
  });
  const stub = (path: string) =>
    createRoute({ getParentRoute: () => root, path, component: () => <div data-testid="destino">{path}</div> });
  const destinations = [
    "/admin/workspaces",
    "/admin/users",
    "/admin/creators",
    "/admin/campaigns",
    "/admin/financial",
    "/admin/health",
    "/admin/activity",
    "/admin/workspaces/$workspaceId",
  ].map(stub);
  return createRouter({
    routeTree: root.addChildren([dashboard, ...destinations]),
    history: createMemoryHistory({ initialEntries: [initialUrl] }),
  });
}

function renderAt(initialUrl: string) {
  const router = buildRouter(initialUrl);
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retryDelay: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const overviewParams = () => api.adminGet.mock.calls.map((call) => call[1] as { from: string; to: string });

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  // o roteador restaura a rolagem ao navegar; o jsdom não implementa `scrollTo`
  window.scrollTo = vi.fn();
  api.adminGet.mockReset().mockResolvedValue(OVERVIEW);
  api.adminGetEnvelope.mockReset().mockResolvedValue({ data: ALERTS, meta: { computed_at: "2026-10-31T15:00:00.000Z" } });
  api.adminList.mockReset().mockImplementation(async (path: string) => ({
    data: [],
    meta: { page: 1, per_page: 1, total: path === "/admin/campaigns" ? 460 : 10, total_pages: 1, applications: { today: 5, last_7_days: 21, month_to_date: 55 } },
  }));
  api.adminFeed.mockReset().mockResolvedValue({ data: EVENTS, meta: { next_cursor: null, has_more: false } });
});

afterEach(() => {
  vi.mocked(Date.now).mockRestore();
});

describe("Dashboard com o roteador real", () => {
  it("abre em /admin/dashboard sem nada na URL: este mês", async () => {
    const router = renderAt("/admin/dashboard");
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    await waitFor(() => expect(overviewParams()).toEqual([{ from: "2026-10-01", to: "2026-10-31" }]));
    expect(router.state.location.search).toEqual({});
  });

  it("trocar o período coloca ?period= na URL (sem empilhar histórico) e consulta de novo", async () => {
    const router = renderAt("/admin/dashboard");
    await userEvent.click(await screen.findByRole("button", { name: "Esta semana" }));

    await waitFor(() => expect(router.state.location.search).toEqual({ period: "week" }));
    expect(router.state.location.pathname).toBe("/admin/dashboard");
    expect(router.history.location.href).toBe("/admin/dashboard?period=week");
    await waitFor(() => expect(overviewParams().at(-1)).toEqual({ from: "2026-10-26", to: "2026-10-31" }));
    expect(router.history.length).toBe(1); // `replace`: nenhum "voltar" por clique no seletor

    await userEvent.click(screen.getByRole("button", { name: "Este mês" }));
    await waitFor(() => expect(router.history.location.href).toBe("/admin/dashboard"));
  });

  it("o personalizado vai inteiro na URL e volta como o mesmo período ao recarregar", async () => {
    const router = renderAt("/admin/dashboard");
    await userEvent.click(await screen.findByRole("button", { name: "Personalizado" }));
    await waitFor(() =>
      expect(router.history.location.href).toBe("/admin/dashboard?period=custom&from=2026-10-01&to=2026-10-31"),
    );
    expect(router.state.location.search).toEqual({ period: "custom", from: "2026-10-01", to: "2026-10-31" });
  });

  it("abre direto num período da URL (link compartilhado)", async () => {
    renderAt("/admin/dashboard?period=custom&from=2026-09-01&to=2026-09-15");
    expect(await screen.findByLabelText("De")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("Até")).toHaveValue("2026-09-15");
    await waitFor(() => expect(overviewParams()).toEqual([{ from: "2026-09-01", to: "2026-09-15" }]));
  });

  it("período inválido na URL abre a tela no padrão (o roteador mantém a busca crua; a tela a revalida)", async () => {
    renderAt("/admin/dashboard?period=decada&from=2026-02-30");
    expect(await screen.findByRole("button", { name: "Este mês", pressed: true })).toBeInTheDocument();
    await waitFor(() => expect(overviewParams()).toEqual([{ from: "2026-10-01", to: "2026-10-31" }]));
    expect(screen.queryByLabelText("De")).not.toBeInTheDocument();
  });

  it.each([
    ["Clientes", "Clientes", "/admin/workspaces", {}],
    ["Clientes", "Ativos", "/admin/workspaces", { status: "active", activity: "active" }],
    ["Usuários", "Usuários", "/admin/users", {}],
    ["Criadores", "Criadores", "/admin/creators", { status: "active" }],
    ["Campanhas", "Publicadas", "/admin/campaigns", { status: "published" }],
  ] as const)("clicar em %s › %s abre %s com os filtros na busca", async (panel, label, path, search) => {
    const router = renderAt("/admin/dashboard");
    const region = await screen.findByRole("region", { name: panel });
    await waitFor(() => expect(within(region).getByRole("link", { name: `Ver ${label}` })).toBeInTheDocument());
    await userEvent.click(within(region).getByRole("link", { name: `Ver ${label}` }));

    expect(await screen.findByTestId("destino")).toHaveTextContent(path);
    expect(router.state.location.pathname).toBe(path);
    expect(router.state.location.search).toEqual(search);
  });

  it("um alerta leva à rota do servidor com os filtros na busca; 'Ver todos' abre a atividade", async () => {
    const router = renderAt("/admin/dashboard");
    const attention = await screen.findByRole("region", { name: /^Precisa de atenção/ });
    await userEvent.click(await within(attention).findByRole("link", { name: /Saques de criadores travados/ }));
    expect(await screen.findByTestId("destino")).toHaveTextContent("/admin/financial");
    expect(router.state.location.search).toEqual({ type: "withdrawal" });

    router.history.back();
    const back = await screen.findByRole("region", { name: /^Precisa de atenção/ });
    await userEvent.click(within(back).getByRole("link", { name: "Ver todos" }));
    expect(await screen.findByTestId("destino")).toHaveTextContent("/admin/activity");
  });

  it("um evento leva ao detalhe do que mudou (rota com parâmetro)", async () => {
    const router = renderAt("/admin/dashboard");
    const activity = await screen.findByRole("region", { name: "Atividade recente" });
    await userEvent.click(await within(activity).findByRole("link", { name: "Workspace suspenso: Aurora Beauty Studio" }));
    expect(await screen.findByTestId("destino")).toHaveTextContent("/admin/workspaces/$workspaceId");
    expect(router.state.location.pathname).toBe("/admin/workspaces/7a1e0000-0000-4000-8000-000000000004");
  });

  it("voltar da lista para o Dashboard preserva o período escolhido", async () => {
    const router = renderAt("/admin/dashboard");
    await userEvent.click(await screen.findByRole("button", { name: "Esta semana" }));
    await waitFor(() => expect(router.history.location.href).toBe("/admin/dashboard?period=week"));

    const clients = screen.getByRole("region", { name: "Clientes" });
    await userEvent.click(within(clients).getByRole("link", { name: "Ver Ativos" }));
    expect(await screen.findByTestId("destino")).toHaveTextContent("/admin/workspaces");

    router.history.back();
    expect(await screen.findByRole("button", { name: "Esta semana", pressed: true })).toBeInTheDocument();
    expect(router.history.location.href).toBe("/admin/dashboard?period=week");
  });
});

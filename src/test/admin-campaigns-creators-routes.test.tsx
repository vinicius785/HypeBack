/**
 * As rotas reais de Campanhas e Criadores (os arquivos de `src/screens`), montadas como o gerador de rotas as monta
 * (`Route.update({ id, path, getParentRoute })`): confere a fiação de cada uma (tela, `validateSearch`, parâmetro da
 * URL). Fica em `src/test`: tudo dentro de `src/screens` é lido pelo gerador de rotas.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRouter, Outlet, RouterProvider, type AnyRoute } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ adminList: vi.fn(), adminGet: vi.fn(), adminGetEnvelope: vi.fn() }));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminList: client.adminList, adminGet: client.adminGet, adminGetEnvelope: client.adminGetEnvelope };
});
vi.mock("@/hooks/admin/use-admin-creators-profile", () => ({
  useAdminCreatorsNicheProfile: () => ({ data: undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }),
  useAdminCreatorsSizeProfile: () => ({ data: undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }),
}));
vi.mock("@/components/admin/users/admin-workspace-picker", () => ({
  AdminWorkspacePicker: () => <div data-testid="workspace-picker" />,
  useAdminWorkspaceSelection: () => ({ summary: undefined }),
}));

import { AdminCampaignsList } from "@/components/admin/campaigns/admin-campaigns-list";
import { makeCampaign, makeCampaignDetail, pageOf } from "@/components/admin/campaigns/campaign-fixtures";
import { AdminCreatorsScreen } from "@/components/admin/creators/admin-creators-screen";
import { makeCreator } from "@/components/admin/creators/creator-fixtures";
import { validateAdminCampaignsSearch } from "@/hooks/admin/use-admin-campaigns";
import { validateAdminCreatorsSearch } from "@/hooks/admin/use-admin-creators";
import { Route as CampaignDetailRoute } from "@/screens/(private)/(admin)/admin.campaigns.$campaignId";
import { Route as CampaignsIndexRoute } from "@/screens/(private)/(admin)/admin.campaigns.index";
import { Route as CampaignsLayoutRoute } from "@/screens/(private)/(admin)/admin.campaigns";
import { Route as CreatorsRoute } from "@/screens/(private)/(admin)/admin.creators";

// O jsdom não implementa `scrollTo` (o roteador chama a cada navegação) e reclama no console.
window.scrollTo = (() => {}) as typeof window.scrollTo;

type Updatable = {
  update: (options: { id: string; path: string; getParentRoute: () => AnyRoute }) => AnyRoute;
  options: { component?: unknown; validateSearch?: unknown };
};
const asUpdatable = (route: unknown) => route as Updatable;

function renderRoutes(url: string) {
  const root = createRootRoute({ component: Outlet });
  const layout = asUpdatable(CampaignsLayoutRoute).update({ id: "/admin/campaigns", path: "/admin/campaigns", getParentRoute: () => root });
  const index = asUpdatable(CampaignsIndexRoute).update({ id: "/", path: "/", getParentRoute: () => layout });
  const detail = asUpdatable(CampaignDetailRoute).update({ id: "/$campaignId", path: "/$campaignId", getParentRoute: () => layout });
  const creators = asUpdatable(CreatorsRoute).update({ id: "/admin/creators", path: "/admin/creators", getParentRoute: () => root });
  const router = createRouter({
    routeTree: root.addChildren([(layout as AnyRoute & { addChildren: (c: AnyRoute[]) => AnyRoute }).addChildren([index, detail]), creators]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  client.adminList.mockReset();
  client.adminGet.mockReset();
  client.adminGetEnvelope.mockReset();
  client.adminList.mockImplementation(async (path: string) =>
    path === "/admin/campaigns" ? pageOf([makeCampaign()]) : pageOf([makeCreator()]),
  );
  client.adminGet.mockImplementation(async () => makeCampaignDetail());
  client.adminGetEnvelope.mockImplementation(async () => ({ data: [], meta: { computed_at: "2026-10-31T15:00:00.000Z" } }));
});

afterEach(() => cleanup());

describe("rotas de Campanhas e Criadores", () => {
  it("cada rota usa a tela e o validador de busca do módulo", () => {
    expect(CampaignsIndexRoute.options.component).toBe(AdminCampaignsList);
    expect(CampaignsIndexRoute.options.validateSearch).toBe(validateAdminCampaignsSearch);
    expect(CreatorsRoute.options.component).toBe(AdminCreatorsScreen);
    expect(CreatorsRoute.options.validateSearch).toBe(validateAdminCreatorsSearch);
  });

  it("/admin/campaigns abre a lista, com a busca da URL valendo", async () => {
    renderRoutes("/admin/campaigns?status=published&sort_by=title&order=asc");
    expect(await screen.findByText("Festival Café Serra Verde")).toBeInTheDocument();
    expect(client.adminList).toHaveBeenCalledWith(
      "/admin/campaigns",
      { page: 1, per_page: 25, sort_by: "title", order: "asc", status: "published" },
      expect.anything(),
    );
    expect(screen.getByRole("heading", { level: 1, name: "Campanhas" })).toBeInTheDocument();
  });

  it("/admin/campaigns/:campaignId abre o detalhe com o id da URL", async () => {
    renderRoutes("/admin/campaigns/ca3b0000-0000-4000-8000-000000000006");
    expect(await screen.findByRole("heading", { level: 1, name: "Festival Café Serra Verde" })).toBeInTheDocument();
    expect(client.adminGet).toHaveBeenCalledWith("/admin/campaigns/ca3b0000-0000-4000-8000-000000000006", undefined, expect.anything());
    expect(client.adminList).not.toHaveBeenCalled();
  });

  it("/admin/creators abre os criadores e, com ?tab=, a aba pedida", async () => {
    renderRoutes("/admin/creators");
    expect(await screen.findByText("Rafael Borges Mendes")).toBeInTheDocument();
    cleanup();

    renderRoutes("/admin/creators?tab=inconsistencies");
    expect(await screen.findByText("Nenhuma inconsistência encontrada")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Inconsistências" })).toHaveAttribute("aria-selected", "true");
  });
});

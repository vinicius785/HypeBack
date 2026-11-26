import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ adminGetStamped: vi.fn(), tab: { value: "overview" as string } }));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGetStamped: api.adminGetStamped };
});

// A aba mora na URL de verdade; aqui ela vira estado de teste.
vi.mock("@/hooks/admin/use-admin-search-param", () => ({
  useAdminSearchParam: (_key: string, defaultValue: string) => {
    const [value, setValue] = useState<string>(api.tab.value || defaultValue);
    return [value, setValue];
  },
}));

vi.mock("@/hooks/admin/use-admin-overview", () => ({
  useAdminOverview: () => ({ data: undefined }),
  useAdminDashboardAlerts: () => ({ data: undefined }),
  useAdminRecentActivity: () => ({ data: undefined }),
}));

vi.mock("./use-dashboard-period", () => ({
  useDashboardPeriod: () => ({
    period: { preset: "30d", from: "2026-10-01", to: "2026-10-31" },
    today: "2026-10-31",
    selectPreset: vi.fn(),
    setCustomRange: vi.fn(),
  }),
}));

vi.mock("./dashboard-news-island", () => ({
  DashboardNewsIsland: ({ controls }: { controls?: React.ReactNode }) => <div data-testid="island">{controls}</div>,
}));
vi.mock("./dashboard-stat-areas", () => ({ DashboardStatAreas: () => <div>áreas de números</div> }));
vi.mock("./dashboard-attention", () => ({ DashboardAttention: () => <div>atenção</div> }));
vi.mock("./dashboard-activity", () => ({ DashboardActivity: () => <div>atividade</div> }));

import { AdminDashboardPage } from "./admin-dashboard-page";
import {
  ACTIVE,
  APPLICATIONS,
  BASE,
  ENGAGEMENT,
  FUNNEL,
  NEVER_APPLIED,
  PROFILE,
  TIMELINE_MONTH,
  TREND,
} from "./growth/growth-fixtures";

const BY_NAME: Record<string, unknown> = {
  base: BASE,
  active: ACTIVE,
  trend: TREND,
  timeline: TIMELINE_MONTH,
  funnel: FUNNEL,
  applications: APPLICATIONS,
  engagement: ENGAGEMENT,
  "never-applied": NEVER_APPLIED,
  profile: PROFILE,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminDashboardPage />
    </QueryClientProvider>,
  );
}

const calledNames = () => api.adminGetStamped.mock.calls.map(([path]) => String(path).split("/").pop());

beforeEach(() => {
  api.tab.value = "overview";
  api.adminGetStamped.mockReset();
  api.adminGetStamped.mockImplementation(async (path: string) => {
    const name = path.split("/").pop();
    return { data: BY_NAME[name as string], generated_at: "2026-11-25T17:20:00.000Z", cached: false };
  });
});

describe("abas do dashboard", () => {
  it("abre em Visão geral, sem pedir nenhum dado de crescimento", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "Visão geral", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Crescimento" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Criadores" })).toBeInTheDocument();
    expect(screen.getByText("áreas de números")).toBeInTheDocument();
    expect(api.adminGetStamped).not.toHaveBeenCalled();
  });

  it("o seletor de período só aparece na Visão geral (o crescimento é a foto de agora)", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByTestId("island")).not.toBeEmptyDOMElement();
    await user.click(screen.getByRole("tab", { name: "Crescimento" }));
    expect(screen.getByTestId("island")).toBeEmptyDOMElement();
  });

  it("o engajamento (a consulta mais pesada) só é pedido ao abrir Criadores", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Crescimento" }));
    await waitFor(() => expect(calledNames()).toContain("base"));
    expect(calledNames()).not.toContain("engagement");
    expect(screen.queryByText("áreas de números")).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Criadores" }));
    await waitFor(() => expect(calledNames()).toContain("engagement"));
    expect(calledNames()).toContain("profile");
    expect(calledNames()).toContain("never-applied");
  });

  it("voltar para a Visão geral desmonta as outras abas", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Crescimento" }));
    expect(await screen.findByRole("heading", { name: "Base de criadores" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Visão geral" }));
    expect(screen.queryByRole("heading", { name: "Base de criadores" })).toBeNull();
    expect(screen.getByText("áreas de números")).toBeInTheDocument();
  });
});

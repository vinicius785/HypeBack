import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ workspace: vi.fn(), users: vi.fn(), campaigns: vi.fn() }));

vi.mock("@/styles/management-board.css", () => ({}));
vi.mock("@/styles/admin-dashboard.css", () => ({}));
vi.mock("@/hooks/admin/use-admin-workspaces", () => ({ useAdminWorkspaceList: (params: unknown) => h.workspace(params) }));
vi.mock("@/hooks/admin/use-admin-users", () => ({ useAdminUsers: (params: unknown, options?: unknown) => h.users(params, options) }));
vi.mock("@/hooks/admin/use-admin-campaigns", () => ({ useAdminCampaigns: (params: unknown, options?: unknown) => h.campaigns(params, options) }));

import { DashboardNewsIsland } from "./dashboard-news-island";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const list = (...data: object[]) => ({ data: { data, meta: { total: data.length } } });

let current = { workspace: list(), user: list(), creator: list(), campaign: list() as { data?: unknown }, applications: 0 };

function wire() {
  h.workspace.mockImplementation(() => current.workspace);
  h.users.mockImplementation((params: { kind?: string }) => (params.kind === "creator" ? current.creator : current.user));
  h.campaigns.mockImplementation(() => ({
    data: { data: (current.campaign.data as { data: object[] } | undefined)?.data ?? [], meta: { total: 1, applications: { today: current.applications, last_7_days: 0, month_to_date: 0 } } },
  }));
}

beforeEach(() => {
  vi.useRealTimers();
  current = {
    workspace: list({ id: "w1", name: "Café Serra Verde", created_at: ago(120) }),
    user: list({ id: 7, name: "Marina Alves", created_at: ago(30) }),
    creator: list({ id: 9, name: "Bia Creator", created_at: ago(5) }),
    campaign: list({ id: "c1", title: "Black Friday", created_at: ago(600) }),
    applications: 0,
  };
  wire();
});

describe("DashboardNewsIsland (Dashboard)", () => {
  it("mostra só a última novidade, a mais recente entre todas as fontes (aqui, o criador de há 5 minutos)", () => {
    render(<DashboardNewsIsland activity={[]} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Novo criador");
    expect(status).toHaveTextContent("Bia Creator");
    expect(status).toHaveTextContent("há 5 minutos");
    expect(screen.queryByText("Marina Alves")).not.toBeInTheDocument();
    expect(screen.queryByText("Café Serra Verde")).not.toBeInTheDocument();
  });

  it("na primeira carga não anuncia: fica em repouso", () => {
    render(<DashboardNewsIsland activity={[]} />);
    expect(screen.getByRole("region", { name: "Última novidade" })).toHaveAttribute("data-state", "idle");
  });

  it("chegando novidade (id novo), a ilha abre, anuncia e volta ao repouso depois de alguns segundos", () => {
    vi.useFakeTimers();
    const view = render(<DashboardNewsIsland activity={[]} />);
    current = { ...current, user: list({ id: 8, name: "Novo Usuário", created_at: new Date().toISOString() }) };
    wire();
    view.rerender(<DashboardNewsIsland activity={[]} />);
    const island = screen.getByRole("region", { name: "Última novidade" });
    expect(island).toHaveAttribute("data-state", "announce");
    expect(screen.getByRole("status")).toHaveTextContent("Novo usuário");
    expect(screen.getByRole("status")).toHaveTextContent("Novo Usuário");
    act(() => {
      vi.advanceTimersByTime(6100);
    });
    expect(island).toHaveAttribute("data-state", "idle");
  });

  it("aporte e saque pagos do feed também entram como novidade", () => {
    current = { ...current, creator: list(), user: list(), workspace: list(), campaign: list() };
    wire();
    render(<DashboardNewsIsland activity={[{ id: "e1", kind: "charge_paid", title: "Aporte de R$ 500,00 pago", occurred_at: ago(1) } as never]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Aporte pago");
    expect(screen.getByRole("status")).toHaveTextContent("Aporte de R$ 500,00 pago");
  });

  it("inscrição não tem item na API: vira novidade quando o contador do dia SOBE entre duas leituras", () => {
    const view = render(<DashboardNewsIsland activity={[]} />);
    expect(screen.getByRole("status")).not.toHaveTextContent("inscrição");
    current = { ...current, applications: 2 };
    wire();
    view.rerender(<DashboardNewsIsland activity={[]} />);
    // a primeira leitura (0) já existia: subir para 2 anuncia "2 novas inscrições"
    expect(screen.getByRole("status")).toHaveTextContent("Nova inscrição");
    expect(screen.getByRole("status")).toHaveTextContent("2 novas inscrições");
  });

  it("sem nenhuma fonte, a ilha diz que não há novidades (e não quebra)", () => {
    current = { workspace: list(), user: list(), creator: list(), campaign: list(), applications: 0 };
    wire();
    render(<DashboardNewsIsland activity={undefined} />);
    expect(screen.getByRole("region", { name: "Última novidade" })).toHaveTextContent("Sem novidades ainda");
  });
});

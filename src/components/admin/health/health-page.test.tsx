import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminGetEnvelope: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: client.adminGet, adminGetEnvelope: client.adminGetEnvelope };
});

import { AdminApiError } from "@/lib/admin/admin-client";
import { currentSearch, renderAdminRoute, stubRoute } from "@/test/render-admin-route";
import type { AdminAlert, AdminSystemHealth } from "@/shared/admin-platform.types";

import { HealthPage } from "./health-page";
import { validateHealthSearch } from "./health-search";

const NOW = new Date("2026-10-31T15:00:00.000Z");
const COMPUTED_AT = "2026-10-31T14:55:00.000Z";

function makeAlert(overrides: Partial<AdminAlert> = {}): AdminAlert {
  return {
    id: "alert-1",
    code: "drift_committed",
    kind: "alert",
    severity: "critical",
    title: "Comprometido diverge das reservas",
    description: "O valor comprometido do workspace não bate com as reservas do ledger.",
    rule: "workspace_balances.committed_cents diferente da soma das reservas do ledger",
    source: "workspace_balances, balance_entries",
    count: 7,
    samples: [
      { type: "workspace", id: "7a1e0000-0000-4000-8000-000000000002", label: "Café Serra Verde", detail: "R$ 250,00 de diferença" },
      { type: "charge", id: "c-1", label: "Cobrança pay_8a7b" },
    ],
    link: { path: "/admin/workspaces", query: { status: "active" } },
    ...overrides,
  };
}

const CRITICAL = makeAlert();
const WARNING = makeAlert({
  id: "alert-2",
  code: "pending_charges_old",
  severity: "warning",
  title: "Cobranças pendentes há muito tempo",
  rule: "asaas_charges pendentes há mais de 3 dias",
  count: 1,
  samples: [],
  link: null,
});
const INFO = makeAlert({ id: "alert-3", code: "no_creators", severity: "info", title: "Workspace sem criadores", rule: "sem membros criadores", count: 2, samples: [] });
const SUGGESTION = makeAlert({
  id: "sug-1",
  code: "inactive_30d",
  kind: "suggestion",
  severity: "info",
  title: "Workspaces sem atividade",
  description: "Workspaces que não criaram campanha nem aportaram recentemente.",
  rule: "Sem campanha nem aporte há 30 dias ou mais (limite escolhido pelo produto)",
  count: 12,
  samples: [],
  link: { path: "/admin/workspaces", query: { inactive: "30" } },
});

const SYSTEM: AdminSystemHealth = {
  checked_at: "2026-10-31T14:59:00.000Z",
  database: { status: "ok", latency_ms: 12 },
  redis: { status: "disabled", latency_ms: null },
  metrics_snapshot: { last_computed_at: "2026-10-31T03:00:00.000Z", age_hours: 12.4 },
  scheduled_jobs: { value: null, unit: "count", kind: "unavailable", definition: "Não há registro de execução dos jobs agendados." },
};

function alertCalls() {
  return client.adminGetEnvelope.mock.calls.filter(([path]) => path === "/admin/health/alerts");
}
function lastAlertQuery(): Record<string, unknown> {
  return alertCalls().at(-1)?.[1] as Record<string, unknown>;
}

function respond(alerts: AdminAlert[]) {
  client.adminGetEnvelope.mockImplementation(async (path: string, query: { kind?: string; severity?: string } = {}) => {
    if (path !== "/admin/health/alerts") throw new Error(`rota inesperada: ${path}`);
    return {
      data: alerts.filter((a) => (!query.kind || a.kind === query.kind) && (!query.severity || a.severity === query.severity)),
      meta: { computed_at: COMPUTED_AT },
    };
  });
}

function renderHealth(url = "/admin/health") {
  return renderAdminRoute(
    [
      { path: "/admin/health", component: HealthPage, validateSearch: validateHealthSearch },
      stubRoute("/admin/workspaces"),
      stubRoute("/admin/workspaces/$workspaceId"),
      stubRoute("/admin/users/$userId"),
      stubRoute("/admin/campaigns/$campaignId"),
    ],
    url,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  client.adminGet.mockReset();
  client.adminGetEnvelope.mockReset();
  respond([CRITICAL, WARNING, INFO, SUGGESTION]);
  client.adminGet.mockImplementation(async () => SYSTEM);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Saúde: alertas", () => {
  it("agrupa por gravidade (crítico, atenção, informativo) e mostra regra, origem e contagem", async () => {
    renderHealth();
    const critical = await screen.findByRole("region", { name: "Alertas: Crítico" });
    expect(within(critical).getByText("Comprometido diverge das reservas")).toBeInTheDocument();
    expect(within(critical).getByText("workspace_balances.committed_cents diferente da soma das reservas do ledger")).toBeInTheDocument();
    expect(within(critical).getByText("workspace_balances, balance_entries")).toBeInTheDocument();
    expect(within(critical).getByText("7")).toBeInTheDocument();
    expect(within(critical).getByText("ocorrências")).toBeInTheDocument();

    const warning = screen.getByRole("region", { name: "Alertas: Atenção" });
    expect(within(warning).getByText("asaas_charges pendentes há mais de 3 dias")).toBeInTheDocument();
    expect(within(warning).getByText("ocorrência")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Alertas: Informativo" })).toBeInTheDocument();

    const order = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(order.indexOf("Alertas: Crítico")).toBeLessThan(order.indexOf("Alertas: Atenção"));
    expect(order.indexOf("Alertas: Atenção")).toBeLessThan(order.indexOf("Alertas: Informativo"));
  });

  it("mostra os exemplos (só rótulos): os que têm tela viram link, e 'Ver todos' leva à lista", async () => {
    renderHealth();
    const card = await screen.findByRole("article", { name: "Comprometido diverge das reservas" });
    const sample = within(card).getByRole("link", { name: /Café Serra Verde/ });
    expect(sample).toHaveAttribute("href", "/admin/workspaces/7a1e0000-0000-4000-8000-000000000002");
    expect(within(card).getByText("R$ 250,00 de diferença")).toBeInTheDocument();
    // cobrança não tem página própria: texto, não link
    expect(within(card).getByText("Cobrança pay_8a7b").closest("a")).toBeNull();
    expect(within(card).getByText(/Exemplos \(2 de 7\)/)).toBeInTheDocument();

    const all = within(card).getByRole("link", { name: "Ver todos" });
    expect(all.getAttribute("href")).toContain("/admin/workspaces");
    expect(all.getAttribute("href")).toContain("status=active");
  });

  it("alerta sem link não mostra 'Ver todos'", async () => {
    renderHealth();
    const card = await screen.findByRole("article", { name: "Cobranças pendentes há muito tempo" });
    expect(within(card).queryByRole("link", { name: "Ver todos" })).not.toBeInTheDocument();
  });

  it("todos os alertas ok: diz que não há alerta ativo", async () => {
    respond([SUGGESTION]);
    renderHealth();
    expect(await screen.findByText("Nenhum alerta ativo")).toBeInTheDocument();
  });
});

describe("Saúde: sugestões", () => {
  it("ficam numa seção própria, rotuladas 'Sugestão' e com o limite da regra à vista", async () => {
    renderHealth();
    const row = await screen.findByRole("listitem", { name: "Workspaces sem atividade" });
    expect(within(row).getByText("Sugestão")).toBeInTheDocument();
    expect(within(row).getByText(/Sem campanha nem aporte há 30 dias ou mais/)).toBeInTheDocument();
    expect(within(row).getByText("12")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Ver todos" }).getAttribute("href")).toContain("inactive=");
  });

  it("alerta e sugestão não se misturam: a sugestão não aparece entre os alertas e vice-versa", async () => {
    renderHealth();
    await screen.findByRole("listitem", { name: "Workspaces sem atividade" });
    const alertRegions = screen.getAllByRole("region", { name: /^Alertas: / });
    for (const region of alertRegions) expect(within(region).queryByText("Workspaces sem atividade")).not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Workspaces sem atividade" })).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "Comprometido diverge das reservas" })).not.toBeInTheDocument();
  });

  it("nenhuma sugestão: diz isso", async () => {
    respond([CRITICAL]);
    renderHealth();
    expect(await screen.findByText("Nenhuma sugestão agora")).toBeInTheDocument();
  });
});

describe("Saúde: filtros e atualização", () => {
  it("abre sem filtro nenhum na consulta", async () => {
    renderHealth();
    await screen.findByText("Comprometido diverge das reservas");
    expect(lastAlertQuery()).toEqual({});
  });

  it("tipo e gravidade vão para a API e para a URL", async () => {
    const { router } = renderHealth();
    await screen.findByText("Comprometido diverge das reservas");

    const kind = screen.getByRole("group", { name: "Tipo" });
    await userEvent.click(within(kind).getByRole("button", { name: "Sugestões" }));
    await waitFor(() => expect(lastAlertQuery()).toMatchObject({ kind: "suggestion" }));
    expect(currentSearch(router)).toMatchObject({ kind: "suggestion" });
    expect(await screen.findByText("Alertas ocultos pelo filtro")).toBeInTheDocument();

    await userEvent.click(within(kind).getByRole("button", { name: "Todos" }));
    const severity = screen.getByRole("group", { name: "Gravidade" });
    await userEvent.click(within(severity).getByRole("button", { name: "Crítico" }));
    await waitFor(() => expect(lastAlertQuery()).toEqual({ severity: "critical" }));
    expect(await screen.findByText("Nenhuma sugestão de gravidade crítico")).toBeInTheDocument();
  });

  it("filtro inválido na URL é descartado", async () => {
    renderHealth("/admin/health?kind=xis&severity=grave");
    await screen.findByText("Comprometido diverge das reservas");
    expect(lastAlertQuery()).toEqual({});
  });

  it("mostra 'Verificado há' a partir do computed_at do servidor", async () => {
    renderHealth();
    const checked = await screen.findByText(/Verificado há 5 minutos/);
    expect(checked.closest("time")).toHaveAttribute("datetime", COMPUTED_AT);
  });

  it("Atualizar refaz as duas consultas", async () => {
    renderHealth();
    await screen.findByText("Comprometido diverge das reservas");
    const alertsBefore = alertCalls().length;
    const systemBefore = client.adminGet.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(alertCalls().length).toBeGreaterThan(alertsBefore));
    await waitFor(() => expect(client.adminGet.mock.calls.length).toBeGreaterThan(systemBefore));
  });
});

describe("Saúde: sistema", () => {
  it("mostra banco, redis, snapshot com idade e jobs como 'Não apurado' (nunca zero)", async () => {
    renderHealth();
    const section = (await screen.findByRole("heading", { name: "Sistema" })).closest("section")!;
    expect(await within(section).findByText("Banco de dados")).toBeInTheDocument();
    expect(within(section).getByText("Operando")).toBeInTheDocument();
    expect(within(section).getByText("Latência de 12 ms")).toBeInTheDocument();
    expect(within(section).getByText("Desativado neste ambiente")).toBeInTheDocument();
    expect(within(section).getByText(/Calculado há 12,4 horas/)).toBeInTheDocument();
    expect(within(section).getByText("Jobs agendados")).toBeInTheDocument();
    expect(within(section).getByText("Não apurado")).toBeInTheDocument();
    expect(within(section).queryByText("0")).not.toBeInTheDocument();
    const checked = within(section).getByText("há 1 minuto");
    expect(checked.closest("time")).toHaveAttribute("datetime", SYSTEM.checked_at);
  });

  it("banco fora do ar aparece como tal", async () => {
    client.adminGet.mockResolvedValue({ ...SYSTEM, database: { status: "down", latency_ms: null } });
    renderHealth();
    expect(await screen.findByText("Fora do ar")).toBeInTheDocument();
    expect(screen.getByText("Sem medição de latência")).toBeInTheDocument();
  });

  it("snapshot nunca calculado", async () => {
    client.adminGet.mockResolvedValue({ ...SYSTEM, metrics_snapshot: { last_computed_at: null, age_hours: null } });
    renderHealth();
    expect(await screen.findByText("Nunca calculado")).toBeInTheDocument();
  });

  it("erro no sistema não derruba os alertas, e tentar de novo refaz só o sistema", async () => {
    client.adminGet.mockRejectedValue(new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }));
    renderHealth();
    expect(await screen.findByText("Comprometido diverge das reservas")).toBeInTheDocument();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Recurso indisponível")).toBeInTheDocument();

    client.adminGet.mockImplementation(async () => SYSTEM);
    await userEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Operando")).toBeInTheDocument();
  });
});

describe("Saúde: estados dos alertas", () => {
  it("carregando: esqueleto nas duas seções", async () => {
    client.adminGetEnvelope.mockReturnValue(new Promise(() => {}));
    const { container } = renderHealth();
    await waitFor(() => expect(container.querySelectorAll(".adm-health-skeleton .adm-sk").length).toBeGreaterThan(0));
    expect(screen.queryByText("Nenhum alerta ativo")).not.toBeInTheDocument();
  });

  it("recurso ainda não disponível no servidor, com tentar de novo", async () => {
    client.adminGetEnvelope.mockRejectedValueOnce(
      new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }),
    );
    renderHealth();
    const alerts = await screen.findAllByRole("alert");
    const unavailable = alerts.find((el) => within(el).queryByText("Recurso indisponível"));
    expect(unavailable).toBeDefined();
    await userEvent.click(within(unavailable!).getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Comprometido diverge das reservas")).toBeInTheDocument();
  });
});

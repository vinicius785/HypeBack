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

import { adminKeys } from "@/hooks/admin/admin-query-keys";
import { ADMIN_HEALTH_RESOURCE } from "@/hooks/admin/use-admin-health";
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
  it("agrupa por gravidade (crítico, atenção, informativo) com a contagem em texto simples e mostra título e contagem", async () => {
    renderHealth();
    const critical = await screen.findByRole("region", { name: "Alertas: Crítico" });
    expect(within(critical).getByRole("heading", { level: 3, name: "Crítico · 1" })).toBeInTheDocument();
    expect(within(critical).getByText("Comprometido diverge das reservas")).toBeInTheDocument();
    expect(within(critical).getByText("7")).toBeInTheDocument();
    expect(within(critical).getByText("ocorrências")).toBeInTheDocument();

    const warning = screen.getByRole("region", { name: "Alertas: Atenção" });
    expect(within(warning).getByText("ocorrência")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Alertas: Informativo" })).toBeInTheDocument();

    const order = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(order.indexOf("Alertas: Crítico")).toBeLessThan(order.indexOf("Alertas: Atenção"));
    expect(order.indexOf("Alertas: Atenção")).toBeLessThan(order.indexOf("Alertas: Informativo"));
  });

  it("a gravidade é dita uma vez: o cartão não tem selo de gravidade nem de tipo (o grupo e a seção já dizem)", async () => {
    renderHealth();
    const card = await screen.findByRole("article", { name: "Comprometido diverge das reservas" });
    expect(within(card).queryByText("Crítico")).not.toBeInTheDocument();
    expect(within(card).queryByText("Alerta")).not.toBeInTheDocument();
    expect(card.querySelector(".adm-badge")).toBeNull();
    // o título do grupo é a única menção
    expect(within(screen.getByRole("region", { name: "Alertas: Crítico" })).getAllByText(/Crítico/)).toHaveLength(1);
  });

  it("regra e origem ficam recolhidas em 'Como é calculado' (o texto continua lá); os exemplos ficam à vista", async () => {
    renderHealth();
    const card = await screen.findByRole("article", { name: "Comprometido diverge das reservas" });
    const details = card.querySelector("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByText("Como é calculado", { selector: "summary" })).toBeInTheDocument();
    expect(within(details).getByText("Regra")).toBeInTheDocument();
    expect(within(details).getByText("workspace_balances.committed_cents diferente da soma das reservas do ledger")).toBeInTheDocument();
    expect(within(details).getByText("Origem")).toBeInTheDocument();
    expect(within(details).getByText("workspace_balances, balance_entries")).toBeInTheDocument();
    // em primeiro plano (fora do detalhe): título, contagem, exemplos e "Ver todos"
    expect(within(card).getByRole("heading", { level: 4, name: "Comprometido diverge das reservas" })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Ver todos" }).closest("details")).toBeNull();
    expect(within(card).getByText("7").closest("details")).toBeNull();
    expect(within(card).getByText(/Exemplos \(2 de 7\)/).closest("details")).toBeNull();

    await userEvent.click(within(details).getByText("Como é calculado"));
    expect(details).toHaveAttribute("open");
  });

  it("mostra os exemplos (só rótulos): os que têm tela viram link, e 'Ver todos' leva à lista", async () => {
    renderHealth();
    const card = await screen.findByRole("article", { name: "Comprometido diverge das reservas" });
    // sem abrir nada: quem é afetado é o que a pessoa age em cima
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
  it("ficam numa seção própria (sem selo 'Sugestão'), com o limite da regra recolhido em 'Como é calculado'", async () => {
    renderHealth();
    const row = await screen.findByRole("listitem", { name: "Workspaces sem atividade" });
    expect(within(row).queryByText("Sugestão")).not.toBeInTheDocument();
    expect(row.querySelector(".adm-badge")).toBeNull();
    const details = row.querySelector("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByText("Limite e regra")).toBeInTheDocument();
    expect(within(details).getByText(/Sem campanha nem aporte há 30 dias ou mais/)).toBeInTheDocument();
    expect(within(details).getByText("Origem")).toBeInTheDocument();
    expect(within(details).getByText("Gravidade")).toBeInTheDocument();
    expect(within(details).getByText("Informativo")).toBeInTheDocument();
    expect(within(row).getByText("12").closest("details")).toBeNull();
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

  it("os exemplos da sugestão ficam à vista, fora do detalhe recolhido", async () => {
    respond([
      makeAlert({
        id: "sug-2",
        code: "inactive_30d",
        kind: "suggestion",
        severity: "info",
        title: "Workspaces sem atividade",
        samples: [{ type: "workspace", id: "7a1e0000-0000-4000-8000-000000000002", label: "Café Serra Verde" }],
        link: null,
      }),
    ]);
    renderHealth();
    const row = await screen.findByRole("listitem", { name: "Workspaces sem atividade" });
    const sample = within(row).getByRole("link", { name: /Café Serra Verde/ });
    expect(sample.closest("details")).toBeNull();
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

  it("não há filtro de tipo: as seções Alertas e Sugestões já separam", async () => {
    renderHealth();
    await screen.findByText("Comprometido diverge das reservas");
    expect(screen.queryByRole("group", { name: "Tipo" })).not.toBeInTheDocument();
    expect(screen.queryByText("Alertas ocultos pelo filtro")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Alertas · 3" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Sugestões · 1" })).toBeInTheDocument();
  });

  it("a gravidade vai para a API e para a URL, e o vazio de cada seção oferece limpar o filtro", async () => {
    const { router } = renderHealth();
    await screen.findByText("Comprometido diverge das reservas");

    const severity = screen.getByRole("group", { name: "Gravidade" });
    await userEvent.click(within(severity).getByRole("button", { name: "Crítico" }));
    await waitFor(() => expect(lastAlertQuery()).toEqual({ severity: "critical" }));
    expect(currentSearch(router)).toEqual({ severity: "critical" });
    expect(await screen.findByText("Nenhuma sugestão de gravidade crítico")).toBeInTheDocument();

    const suggestions = screen.getByRole("heading", { level: 2, name: /^Sugestões/ }).closest("section")!;
    await userEvent.click(within(suggestions).getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({}));
    expect(await screen.findByText("Workspaces sem atividade")).toBeInTheDocument();
    expect(lastAlertQuery()).toEqual({});
  });

  it("'Limpar filtros' da barra volta a gravidade ao padrão", async () => {
    const { router } = renderHealth("/admin/health?severity=warning");
    await screen.findByText("Cobranças pendentes há muito tempo");
    expect(lastAlertQuery()).toEqual({ severity: "warning" });
    const bar = screen.getByRole("group", { name: "Gravidade" }).closest(".adm-filters") as HTMLElement;
    await userEvent.click(within(bar).getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({}));
  });

  it("um ?kind= antigo na URL é ignorado (não há mais filtro de tipo): a consulta sai sem ele e as duas seções aparecem", async () => {
    renderHealth("/admin/health?kind=suggestion");
    await screen.findByText("Comprometido diverge das reservas");
    expect(lastAlertQuery()).toEqual({});
    expect(screen.getByText("Workspaces sem atividade")).toBeInTheDocument();
  });

  it("filtro inválido na URL é descartado", async () => {
    renderHealth("/admin/health?kind=xis&severity=grave");
    await screen.findByText("Comprometido diverge das reservas");
    expect(lastAlertQuery()).toEqual({});
  });

  it("mostra 'Verificado há' UMA vez (no cabeçalho), a partir do computed_at do servidor, sem região viva", async () => {
    renderHealth();
    const checked = await screen.findByText(/Verificado há 5 minutos/);
    expect(checked.closest("time")).toHaveAttribute("datetime", COMPUTED_AT);
    expect(checked.closest("header")).not.toBeNull();
    expect(checked.closest("[role='status']")).toBeNull();
    await screen.findByText("Banco de dados");
    expect(screen.getAllByText(/Verificado/)).toHaveLength(1);
  });

  it("se os alertas falham, o 'Verificado há' vem da verificação do sistema", async () => {
    client.adminGetEnvelope.mockRejectedValue(new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }));
    renderHealth();
    const checked = await screen.findByText(/Verificado há 1 minuto/);
    expect(checked.closest("time")).toHaveAttribute("datetime", SYSTEM.checked_at);
  });

  it("Atualizar (ícone no fim da barra de filtros, fora do cabeçalho) refaz as duas consultas", async () => {
    renderHealth();
    await screen.findByText("Comprometido diverge das reservas");
    const alertsBefore = alertCalls().length;
    const systemBefore = client.adminGet.mock.calls.length;
    const refresh = screen.getByRole("button", { name: "Atualizar" });
    expect(refresh.closest("header")).toBeNull();
    expect(refresh.closest(".adm-filters")).not.toBeNull();
    await userEvent.click(refresh);
    await waitFor(() => expect(alertCalls().length).toBeGreaterThan(alertsBefore));
    await waitFor(() => expect(client.adminGet.mock.calls.length).toBeGreaterThan(systemBefore));
  });
});

describe("Saúde: atualizar e leitor de tela", () => {
  it("o clique em Atualizar anuncia 'Atualizando…' e 'Atualizado'", async () => {
    renderHealth();
    await screen.findByText("Comprometido diverge das reservas");
    const refresh = screen.getByRole("button", { name: "Atualizar" });
    const live = refresh.nextElementSibling as HTMLElement;
    expect(live).toHaveAttribute("role", "status");
    expect(live).toBeEmptyDOMElement();

    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const original = client.adminGetEnvelope.getMockImplementation()!;
    client.adminGetEnvelope.mockImplementation(async (...args: unknown[]) => {
      await gate;
      return original(...(args as [string, never]));
    });
    await userEvent.click(refresh);
    await waitFor(() => expect(live).toHaveTextContent("Atualizando…"));
    expect(refresh).toHaveAttribute("aria-busy", "true");
    release();
    await waitFor(() => expect(live).toHaveTextContent("Atualizado"));
  });

  it("a atualização automática (sem clique) não anuncia nada, mas o botão segue ocupado enquanto ela roda", async () => {
    const { queryClient } = renderHealth();
    await screen.findByText("Comprometido diverge das reservas");
    const refresh = screen.getByRole("button", { name: "Atualizar" });
    const live = refresh.nextElementSibling as HTMLElement;

    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const original = client.adminGetEnvelope.getMockImplementation()!;
    client.adminGetEnvelope.mockImplementation(async (...args: unknown[]) => {
      await gate;
      return original(...(args as [string, never]));
    });
    // o mesmo que o `refetchInterval` faz a cada 60 s: refaz sem ninguém clicar
    void queryClient.refetchQueries({ queryKey: adminKeys.resource(ADMIN_HEALTH_RESOURCE) });
    await waitFor(() => expect(refresh).toHaveAttribute("aria-busy", "true"));
    expect(live).toBeEmptyDOMElement();
    release();
    await waitFor(() => expect(refresh).not.toHaveAttribute("aria-busy"));
    expect(live).toBeEmptyDOMElement();
  });
});

describe("Saúde: sistema", () => {
  it("mostra banco, redis, snapshot com idade e jobs como 'Não apurado' (nunca zero)", async () => {
    renderHealth();
    const section = (await screen.findByRole("heading", { name: "Sistema" })).closest("section")!;
    expect(await within(section).findByText("Banco de dados")).toBeInTheDocument();
    expect(within(section).getByText("Operando")).toBeInTheDocument();
    expect(within(section).getByText("Latência de 12 ms")).toBeInTheDocument();
    expect(within(section).getByText("Desativado")).toBeInTheDocument();
    expect(within(section).getByText("Não é usado neste ambiente")).toBeInTheDocument();
    expect(within(section).getByText(/Calculado há 12,4 horas/)).toBeInTheDocument();
    expect(within(section).getByText("Jobs agendados")).toBeInTheDocument();
    expect(within(section).getByText("Não apurado")).toBeInTheDocument();
    expect(within(section).queryByText("0")).not.toBeInTheDocument();
    // a hora da verificação não se repete no cartão: ela é uma só, no cabeçalho
    expect(within(section).queryByText(/Verificado/)).not.toBeInTheDocument();
    expect(section.querySelector("time")).toBeNull();
  });

  it("a faixa do sistema vem ANTES das listas, com o resumo em selo verde", async () => {
    renderHealth();
    const section = (await screen.findByRole("heading", { name: "Sistema" })).closest("section")!;
    expect(await within(section).findByText("Banco de dados operando")).toHaveAttribute("data-tone", "ok");
    const alerts = screen.getByRole("heading", { level: 2, name: /^Alertas/ });
    expect(section.compareDocumentPosition(alerts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("o selo só olha banco e Redis, e diz isso: 'Banco e Redis operando' (Redis desativado: só o banco)", async () => {
    client.adminGet.mockResolvedValue({ ...SYSTEM, redis: { status: "ok", latency_ms: 3 } });
    renderHealth();
    expect(await screen.findByText("Banco e Redis operando")).toHaveAttribute("data-tone", "ok");
    expect(screen.queryByText("Sistemas operando")).not.toBeInTheDocument();
  });

  it("Redis fora do ar: o selo vermelho nomeia só quem caiu", async () => {
    client.adminGet.mockResolvedValue({ ...SYSTEM, redis: { status: "down", latency_ms: null } });
    renderHealth();
    expect(await screen.findByText("Fora do ar: Redis")).toHaveAttribute("data-tone", "bad");
  });

  it("usa a faixa do kit (AdminKeyValueList strip), sem a lista local, e o esqueleto é a faixa do kit", async () => {
    let resolve!: (value: AdminSystemHealth) => void;
    client.adminGet.mockReturnValue(new Promise<AdminSystemHealth>((r) => (resolve = r)));
    renderHealth();
    const section = (await screen.findByRole("heading", { name: "Sistema" })).closest("section")!;
    expect(within(section).getByText("Carregando o estado do sistema…")).toBeInTheDocument();
    expect(section.querySelector(".adm-lsk[data-variant='strip']")).not.toBeNull();
    resolve(SYSTEM);
    await within(section).findByText("Banco de dados");
    expect(section.querySelector("dl.adm-kv[data-layout='strip']")).not.toBeNull();
    expect(section.querySelector(".adm-health-sys")).toBeNull();
    expect(section.querySelector(".adm-lsk")).toBeNull();
  });

  it("o 'i' dos jobs explica por que não é apurado (não é um cálculo): nome acessível próprio, ao lado do valor", async () => {
    renderHealth();
    const section = (await screen.findByRole("heading", { name: "Sistema" })).closest("section")!;
    const info = await within(section).findByRole("button", { name: "Por que os jobs agendados não são apurados" });
    expect(info).toHaveAccessibleDescription("Não há registro de execução dos jobs agendados.");
    expect(info.closest("dd")).toHaveTextContent("Não apurado");
    // o do snapshot explica um cálculo (a idade): mantém "Como é calculado"
    expect(within(section).getByRole("button", { name: "Como é calculado: Snapshot de métricas" })).toBeInTheDocument();
  });

  it("banco fora do ar aparece como tal", async () => {
    client.adminGet.mockResolvedValue({ ...SYSTEM, database: { status: "down", latency_ms: null } });
    renderHealth();
    expect(await screen.findByText("Fora do ar")).toHaveAttribute("data-tone", "bad");
    expect(screen.getByText("Fora do ar: Banco de dados")).toHaveAttribute("data-tone", "bad");
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
  it("carregando: esqueleto do kit nas duas seções, sem vazio nem erro", async () => {
    client.adminGetEnvelope.mockReturnValue(new Promise(() => {}));
    renderHealth();
    expect(await screen.findByText("Carregando alertas…")).toBeInTheDocument();
    expect(screen.getByText("Carregando sugestões…")).toBeInTheDocument();
    expect(screen.getAllByRole("status").some((el) => el.classList.contains("adm-lsk"))).toBe(true);
    expect(screen.queryByText("Nenhum alerta ativo")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

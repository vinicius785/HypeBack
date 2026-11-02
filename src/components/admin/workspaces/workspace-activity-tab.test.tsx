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

import {
  apiError,
  deferred,
  listOf,
  makeAuditEntry,
  makeDetail,
  makeEvent,
  NOW_ISO,
  renderWithQuery,
  routeReads,
  WS_ID,
} from "./test-support";
import { WorkspaceActivityTab } from "./workspace-activity-tab";

const ACTIVITY = `/admin/workspaces/${WS_ID}/activity`;
const AUDIT = "/admin/audit-log";

// 28/10/2026 22:30 em São Paulo (01:30 UTC do dia 29): o dia civil de São Paulo é 28, não 29.
const ADMIN_EVENT = makeEvent({
  id: "action:7",
  occurred_at: "2026-10-29T01:30:00.000Z",
  kind: "admin_action",
  source: "platform_admin_action_log",
  title: 'Workspace "Café Serra Verde" suspenso',
  actor: { user_id: 1, name: "Marina Albuquerque" },
  reason: "Cobrança em aberto",
});
const CAMPAIGN_EVENT = makeEvent();
const CHARGE_EVENT = makeEvent({
  id: "charge:aa11",
  occurred_at: "2026-10-20T15:00:00.000Z",
  kind: "charge_paid",
  title: "Aporte de R$ 2.500,00 pago",
  actor: null,
});

const feed = (data = [ADMIN_EVENT, CAMPAIGN_EVENT, CHARGE_EVENT], hasMore = false, cursor: string | null = null) => ({
  data,
  meta: { next_cursor: cursor, has_more: hasMore },
});

const auditParams = () => api.adminList.mock.calls.at(-1)?.[1] as Record<string, unknown>;
const activityParams = () => api.adminFeed.mock.calls.at(-1)?.[1] as Record<string, unknown>;

function renderTab() {
  return renderWithQuery(<WorkspaceActivityTab workspace={makeDetail()} />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
  Object.values(api).forEach((mock) => mock.mockReset());
  routeReads(api.adminFeed, { [ACTIVITY]: () => feed() });
  routeReads(api.adminList, { [AUDIT]: () => listOf([makeAuditEntry({ id: 7, created_at: "2026-10-29T01:30:00.000Z" })]) });
});
afterEach(() => vi.useRealTimers());

describe("WorkspaceActivityTab · linha do tempo", () => {
  it("cada evento com data e hora de São Paulo, o tipo, a frase pronta e quem fez", async () => {
    renderTab();
    await screen.findByText("Aporte de R$ 2.500,00 pago");

    const campanha = screen.getByText('Campanha "Festival Café Serra Verde" criada').closest("li") as HTMLElement;
    expect(within(campanha).getByText("Campanha criada")).toBeInTheDocument(); // o tipo (ACTIVITY_KIND_LABEL)
    expect(within(campanha).getByText("28/10/2026 12:30")).toBeInTheDocument();
    expect(within(campanha).getByText("por Helena Prado")).toBeInTheDocument();

    const aporte = screen.getByText("Aporte de R$ 2.500,00 pago").closest("li") as HTMLElement;
    expect(within(aporte).getByText("Aporte pago")).toBeInTheDocument();
    expect(within(aporte).queryByText(/^por /)).not.toBeInTheDocument(); // sem ator, sem "por"
  });

  it("ação do Admin mostra o motivo e o botão 'Ver antes e depois'; fato derivado não tem o botão", async () => {
    renderTab();
    await screen.findByText('Workspace "Café Serra Verde" suspenso');

    const acao = screen.getByText('Workspace "Café Serra Verde" suspenso').closest("li") as HTMLElement;
    expect(within(acao).getByText("Ação administrativa")).toBeInTheDocument();
    expect(within(acao).getByText("28/10/2026 22:30")).toBeInTheDocument();
    expect(within(acao).getByText("Motivo: Cobrança em aberto")).toBeInTheDocument();
    expect(within(acao).getByRole("button", { name: "Ver antes e depois" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("button", { name: "Ver antes e depois" })).toHaveLength(1);
  });

  it("pede a atividade DESTE workspace pelo cursor; sem filtro, nada de `kind`", async () => {
    renderTab();
    await screen.findByText("Aporte de R$ 2.500,00 pago");
    expect(api.adminFeed.mock.calls[0][0]).toBe(ACTIVITY);
    expect(activityParams().kind).toBeUndefined();
  });

  it("filtro 'Ações do Admin' manda kind=admin_action ao servidor; 'Tudo' devolve tudo", async () => {
    routeReads(api.adminFeed, { [ACTIVITY]: (query) => (query?.kind === "admin_action" ? feed([ADMIN_EVENT]) : feed()) });
    renderTab();
    await screen.findByText("Aporte de R$ 2.500,00 pago");

    await userEvent.click(screen.getByRole("button", { name: "Ações do Admin" }));
    await waitFor(() => expect(activityParams()).toMatchObject({ kind: "admin_action" }));
    await waitFor(() => expect(screen.queryByText("Aporte de R$ 2.500,00 pago")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Ações do Admin" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Tudo" }));
    expect(await screen.findByText("Aporte de R$ 2.500,00 pago")).toBeInTheDocument();
  });

  it("'Carregar mais' usa o cursor, acrescenta os eventos e some quando acaba", async () => {
    routeReads(api.adminFeed, {
      [ACTIVITY]: (query) => (query?.cursor === "c1" ? feed([CHARGE_EVENT], false, null) : feed([CAMPAIGN_EVENT], true, "c1")),
    });
    renderTab();
    await screen.findByText('Campanha "Festival Café Serra Verde" criada');
    expect(screen.queryByText("Aporte de R$ 2.500,00 pago")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByText("Aporte de R$ 2.500,00 pago")).toBeInTheDocument();
    expect(activityParams()).toMatchObject({ cursor: "c1" });
    expect(screen.getByText('Campanha "Festival Café Serra Verde" criada')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("falha ao carregar a próxima página: a lista fica e há 'Tentar de novo' para a próxima página", async () => {
    routeReads(api.adminFeed, {
      [ACTIVITY]: (query) => {
        if (query?.cursor === "c1") throw apiError(500, "SERVER_ERROR", "boom");
        return feed([CAMPAIGN_EVENT], true, "c1");
      },
    });
    renderTab();
    await screen.findByText('Campanha "Festival Café Serra Verde" criada');
    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    const retry = await screen.findByRole("button", { name: /Tentar de novo/ }, { timeout: 3000 });
    expect(screen.getByText('Campanha "Festival Café Serra Verde" criada')).toBeInTheDocument();

    routeReads(api.adminFeed, { [ACTIVITY]: (query) => (query?.cursor === "c1" ? feed([CHARGE_EVENT]) : feed([CAMPAIGN_EVENT], true, "c1")) });
    await userEvent.click(retry);
    expect(await screen.findByText("Aporte de R$ 2.500,00 pago")).toBeInTheDocument();
  });
});

describe("WorkspaceActivityTab · antes e depois (auditoria, sob demanda)", () => {
  it("não consulta a auditoria enquanto ninguém expande; ao expandir, pede o dia de SÃO PAULO do evento", async () => {
    renderTab();
    await screen.findByText('Workspace "Café Serra Verde" suspenso');
    expect(api.adminList).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Ver antes e depois" }));
    await waitFor(() => expect(api.adminList).toHaveBeenCalled());
    expect(api.adminList.mock.calls[0][0]).toBe(AUDIT);
    // 01:30 UTC de 29/10 é 22:30 de 28/10 em São Paulo
    expect(auditParams()).toEqual({ workspace_id: WS_ID, from: "2026-10-28", to: "2026-10-28", per_page: 100 });
  });

  it("mostra quem registrou, o IP e a tabela antes → depois; recolher esconde e reabrir não consulta de novo", async () => {
    renderTab();
    await screen.findByText('Workspace "Café Serra Verde" suspenso');
    await userEvent.click(screen.getByRole("button", { name: "Ver antes e depois" }));

    const table = await screen.findByRole("table", { name: "Antes e depois da ação" });
    expect(within(table).getByText("Estado")).toBeInTheDocument();
    expect(within(table).getByText("Ativo")).toBeInTheDocument();
    expect(within(table).getByText("Suspenso")).toBeInTheDocument();
    expect(screen.getByText(/Registrado por Marina Albuquerque \(marina@hype.com.br\) · IP 203.0.113.10/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocultar antes e depois" })).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(screen.getByRole("button", { name: "Ocultar antes e depois" }));
    expect(screen.queryByRole("table", { name: "Antes e depois da ação" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver antes e depois" }));
    expect(await screen.findByRole("table", { name: "Antes e depois da ação" })).toBeInTheDocument();
    expect(api.adminList).toHaveBeenCalledTimes(1);
  });

  it("enquanto a auditoria carrega, um aviso de carregamento", async () => {
    api.adminList.mockReturnValue(deferred<never>().promise);
    renderTab();
    await screen.findByText('Workspace "Café Serra Verde" suspenso');
    await userEvent.click(screen.getByRole("button", { name: "Ver antes e depois" }));
    expect(await screen.findByText("Carregando o registro da ação…")).toBeInTheDocument();
  });

  it("registro que não está no dia consultado: avisa em vez de inventar", async () => {
    routeReads(api.adminList, { [AUDIT]: () => listOf([makeAuditEntry({ id: 99, created_at: "2020-01-01T00:00:00.000Z", reason: "outro" })]) });
    renderTab();
    await screen.findByText('Workspace "Café Serra Verde" suspenso');
    await userEvent.click(screen.getByRole("button", { name: "Ver antes e depois" }));
    expect(await screen.findByText("Não encontramos o registro desta ação na auditoria.")).toBeInTheDocument();
  });

  it("erro na auditoria: mensagem com 'Tentar de novo'", async () => {
    api.adminList.mockRejectedValue(apiError(500, "SERVER_ERROR", "boom"));
    renderTab();
    await screen.findByText('Workspace "Café Serra Verde" suspenso');
    await userEvent.click(screen.getByRole("button", { name: "Ver antes e depois" }));

    const retry = await screen.findByRole("button", { name: /Tentar de novo/ }, { timeout: 3000 });
    routeReads(api.adminList, { [AUDIT]: () => listOf([makeAuditEntry({ id: 7, created_at: "2026-10-29T01:30:00.000Z" })]) });
    await userEvent.click(retry);
    expect(await screen.findByRole("table", { name: "Antes e depois da ação" })).toBeInTheDocument();
  });
});

describe("WorkspaceActivityTab · estados", () => {
  it("carregando", async () => {
    api.adminFeed.mockReturnValue(deferred<never>().promise);
    renderTab();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando a atividade…");
  });

  it("vazio: sem filtro e com o filtro de ações do Admin", async () => {
    routeReads(api.adminFeed, { [ACTIVITY]: () => feed([]) });
    renderTab();
    expect(await screen.findByText("Nenhuma atividade registrada")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Ações do Admin" }));
    expect(await screen.findByText("Nenhuma ação do Admin neste workspace")).toBeInTheDocument();
  });

  it("erro com 'Tentar de novo' e recurso indisponível", async () => {
    api.adminFeed.mockRejectedValue(apiError(500, "SERVER_ERROR", "boom"));
    const first = renderTab();
    const retry = await screen.findByRole("button", { name: /Tentar de novo/ }, { timeout: 3000 });
    routeReads(api.adminFeed, { [ACTIVITY]: () => feed() });
    await userEvent.click(retry);
    expect(await screen.findByText("Aporte de R$ 2.500,00 pago")).toBeInTheDocument();
    first.unmount();

    api.adminFeed.mockRejectedValue(toAdminApiError(404, { statusCode: 404, message: "Cannot GET /x" }));
    renderTab();
    expect(await screen.findByText("Recurso indisponível")).toBeInTheDocument();
  });
});

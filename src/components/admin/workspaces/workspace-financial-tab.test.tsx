import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
  figure,
  makeDetail,
  makeFinancial,
  makeMovement,
  NOW_ISO,
  renderWithQuery,
  routeReads,
  WS_ID,
} from "./test-support";
import { WorkspaceFinancialTab } from "./workspace-financial-tab";

const FINANCIAL = `/admin/workspaces/${WS_ID}/financial`;
const MOVEMENTS = "/admin/financial/movements";

const ENTRADA = makeMovement();
const SAQUE = makeMovement({
  id: "withdrawal:9",
  type: "withdrawal",
  direction: "out",
  status: "paid",
  status_label: "Pago",
  amount_cents: 70000,
  kind: "realized",
  campaign: null,
  user: { user_id: 1002, name: "Vanessa Mendes" },
  origin: { type: "withdrawal", id: "9", external_id: null },
  description: null,
  occurred_at: "2026-10-27T10:00:00.000Z",
});
const LANCAMENTO = makeMovement({
  id: "entry:7",
  type: "ledger_entry",
  direction: "internal",
  status: "reserved",
  status_label: "Reservado",
  amount_cents: 40000,
  kind: "committed",
  user: null,
  origin: { type: "balance_entry", id: "e7", external_id: null },
  occurred_at: "2026-10-26T10:00:00.000Z",
});

const feed = (data = [ENTRADA, SAQUE, LANCAMENTO], hasMore = false, cursor: string | null = null) => ({
  data,
  meta: { next_cursor: cursor, has_more: hasMore },
});

const financialParams = () => api.adminGet.mock.calls.at(-1)?.[1] as Record<string, unknown>;
const movementParams = () => api.adminFeed.mock.calls.at(-1)?.[1] as Record<string, unknown>;
const card = (label: string) => screen.getByText(label, { selector: ".adm-fig-label" }).closest(".adm-fig") as HTMLElement;

function renderTab(workspace = makeDetail()) {
  return renderWithQuery(<WorkspaceFinancialTab workspace={workspace} />);
}

beforeEach(() => {
  // 31/10/2026 12:00 em São Paulo: hoje, para os atalhos de período
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
  Object.values(api).forEach((mock) => mock.mockReset());
  routeReads(api.adminGet, { [FINANCIAL]: () => makeFinancial() });
  routeReads(api.adminFeed, { [MOVEMENTS]: () => feed() });
});
afterEach(() => vi.useRealTimers());

describe("WorkspaceFinancialTab · números", () => {
  it("abre nos últimos 30 dias contando hoje (de hoje-29 até hoje) e pede os números do workspace nesse período", async () => {
    renderTab();
    await screen.findByText("Aportes recebidos (total)");

    expect(api.adminGet.mock.calls[0][0]).toBe(FINANCIAL);
    expect(financialParams()).toEqual({ from: "2026-10-02", to: "2026-10-31" });
    expect(screen.getByRole("button", { name: "30 dias" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Dias de São Paulo · 02\/10\/2026 – 31\/10\/2026/)).toBeInTheDocument();
  });

  it("oito indicadores em destaque, sem selo de tipo; os outros seis ficam em 'Ver detalhes', agrupados (nada some)", async () => {
    renderTab();
    await screen.findByText("Aportes recebidos (total)");

    const highlights = ["Aportes recebidos (total)", "Aportes recebidos no período", "Em custódia", "Comprometido", "Saldo livre", "Liberado no período", "Disponível para saque", "Cobranças pendentes"];
    const details = screen.getByText("Ver detalhes").closest("details") as HTMLElement;
    for (const label of highlights) {
      const cardEl = card(label);
      expect(details.contains(cardEl)).toBe(false);
      expect(cardEl.querySelector(".adm-kind")).toBeNull();
    }
    expect(details).not.toHaveAttribute("open");
    const groups = within(details)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(groups).toEqual(["Entradas", "Criadores", "Pendências"]);
    for (const label of ["Receita da plataforma", "Liberado (total)", "Em carência", "PIX concluído no período", "PIX concluído (total)", "Saques em andamento"]) {
      expect(details.contains(card(label))).toBe(true);
    }
    expect(screen.getAllByText(/.*/, { selector: ".adm-fig-label" })).toHaveLength(14);
    expect(screen.getByRole("heading", { level: 2, name: "Movimentações" })).toBeInTheDocument();
  });

  it("'Ver detalhes' abre e mostra os números restantes com valor exato", async () => {
    renderTab();
    await screen.findByText("R$ 1.234.567,89");
    await userEvent.click(screen.getByText("Ver detalhes"));
    expect(screen.getByText("Ver detalhes").closest("details")).toHaveAttribute("open");
    expect(within(card("Em carência")).getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(within(card("Saques em andamento")).getByText("R$ 300,00")).toBeInTheDocument();
  });

  it("cada número exato; o tipo (kind) e a definição do servidor vivem no 'i' do rótulo", async () => {
    renderTab();
    await screen.findByText("R$ 1.234.567,89");

    expect(within(card("Aportes recebidos (total)")).getByText("R$ 1.234.567,89")).toBeInTheDocument();
    expect(within(card("Em custódia")).getByText("R$ 45.000,50")).toBeInTheDocument();
    const info = screen.getByRole("button", { name: "Como é calculado: Em custódia" });
    expect(info).toHaveAccessibleDescription(/Definição de teste \(stock\)/);
    expect(info).toHaveAccessibleDescription(/Tipo: Posição atual/);
    expect(screen.getByRole("button", { name: "Como é calculado: Saldo livre" })).toHaveAccessibleDescription(/Tipo: Calculado/);
    expect(screen.getByRole("button", { name: "Como é calculado: Comprometido" })).toHaveAccessibleDescription(/Tipo: Comprometido/);
  });

  it("número que não existe no banco é 'Não apurado', nunca R$ 0,00", async () => {
    renderTab();
    await screen.findByText("R$ 1.234.567,89");

    await userEvent.click(screen.getByText("Ver detalhes"));
    const revenue = card("Receita da plataforma");
    expect(within(revenue).getByText("Não apurado", { selector: ".adm-fig-value" })).toBeInTheDocument();
    expect(revenue).not.toHaveTextContent("R$");
  });

  it("os números que dependem do período dizem isso no nome (sem 'no período' repetido embaixo de cada um)", async () => {
    renderTab();
    await screen.findByText("R$ 1.234.567,89");
    expect(card("Aportes recebidos no período")).toBeInTheDocument();
    expect(card("Liberado no período")).toBeInTheDocument();
    expect(document.querySelectorAll(".adm-fig-hint")).toHaveLength(0);
  });

  it("zero de verdade é R$ 0,00 (diferente de não apurado)", async () => {
    routeReads(api.adminGet, { [FINANCIAL]: () => makeFinancial({ pending_charges: figure("stock", 0) }) });
    renderTab();
    await waitFor(() => expect(within(card("Cobranças pendentes")).getByText("R$ 0,00")).toBeInTheDocument());
  });

  it("carregando mostra os cartões em esqueleto (sem números inventados)", async () => {
    api.adminGet.mockReturnValue(deferred<never>().promise);
    const { container } = renderTab();
    expect(container.querySelectorAll(".adm-fig[aria-busy='true']").length).toBe(14);
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });

  it("erro dos números: mensagem, 'Tentar de novo' e as movimentações seguem; recurso indisponível tem texto próprio", async () => {
    api.adminGet.mockRejectedValue(apiError(500, "SERVER_ERROR", "boom"));
    const first = renderTab();
    const retry = await screen.findByRole("button", { name: /Tentar de novo/ }, { timeout: 3000 });
    expect(await screen.findByText("Aporte")).toBeInTheDocument(); // as movimentações carregaram
    routeReads(api.adminGet, { [FINANCIAL]: () => makeFinancial() });
    await userEvent.click(retry);
    expect(await screen.findByText("Aportes recebidos (total)")).toBeInTheDocument();
    first.unmount();

    api.adminGet.mockRejectedValue(toAdminApiError(404, { statusCode: 404, message: "Cannot GET /x" }));
    renderTab();
    expect(await screen.findByText("Recurso indisponível")).toBeInTheDocument();
  });
});

describe("WorkspaceFinancialTab · período", () => {
  it.each([
    ["7 dias", "2026-10-25"],
    ["90 dias", "2026-08-03"],
  ])("atalho %s: de %s até hoje, nos números e nas movimentações", async (label, from) => {
    renderTab();
    await screen.findByText("Aportes recebidos (total)");

    await userEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(financialParams()).toEqual({ from, to: "2026-10-31" }));
    await waitFor(() => expect(movementParams()).toMatchObject({ workspace_id: WS_ID, from, to: "2026-10-31" }));
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
  });

  it("voltar ao atalho de 30 dias restaura o período padrão (e o que já foi consultado vem do cache)", async () => {
    renderTab();
    await screen.findByText("R$ 1.234.567,89");
    await userEvent.click(screen.getByRole("button", { name: "7 dias" }));
    await userEvent.click(screen.getByRole("button", { name: "30 dias" }));

    expect(screen.getByRole("button", { name: "30 dias" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Dias de São Paulo · 02\/10\/2026 – 31\/10\/2026/)).toBeInTheDocument();
  });

  it("período personalizado: as datas só valem quando formam um período válido", async () => {
    renderTab();
    await screen.findByText("Aportes recebidos (total)");
    await userEvent.click(screen.getByRole("button", { name: "Personalizado" }));

    const from = screen.getByLabelText("De");
    const to = screen.getByLabelText("Até");
    expect(from).toHaveValue("2026-10-02");
    expect(to).toHaveValue("2026-10-31");

    fireEvent.change(from, { target: { value: "2026-09-01" } });
    await waitFor(() => expect(financialParams()).toEqual({ from: "2026-09-01", to: "2026-10-31" }));
    expect(screen.getByRole("button", { name: "Personalizado" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/01\/09\/2026 – 31\/10\/2026/)).toBeInTheDocument();
  });

  it.each([
    ["mais de 366 dias", "De", "2025-01-01", "O período pode ter no máximo 366 dias."],
    ["fim antes do início", "Até", "2026-10-01", "A data inicial não pode ser depois da data final."],
    ["depois de hoje", "Até", "2026-11-05", "As datas não podem passar de 31/10/2026."],
  ])("intervalo inválido (%s): mostra o aviso e mantém o período anterior, sem consultar", async (_name, field, value, message) => {
    renderTab();
    await screen.findByText("Aportes recebidos (total)");
    await userEvent.click(screen.getByRole("button", { name: "Personalizado" }));
    const calls = api.adminGet.mock.calls.length;
    const feedCalls = api.adminFeed.mock.calls.length;

    fireEvent.change(screen.getByLabelText(field), { target: { value } });

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(api.adminGet.mock.calls.length).toBe(calls);
    expect(api.adminFeed.mock.calls.length).toBe(feedCalls);
    expect(financialParams()).toEqual({ from: "2026-10-02", to: "2026-10-31" });
  });

  it("corrigir o intervalo depois do aviso aplica o período e tira o aviso", async () => {
    renderTab();
    await screen.findByText("Aportes recebidos (total)");
    await userEvent.click(screen.getByRole("button", { name: "Personalizado" }));
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2025-01-01" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-10-20" } });
    await waitFor(() => expect(financialParams()).toEqual({ from: "2026-10-20", to: "2026-10-31" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("WorkspaceFinancialTab · atualizar", () => {
  it("o botão de atualizar (só ícone, ao lado do período) consulta de novo os números e as movimentações", async () => {
    renderTab();
    await screen.findByText("R$ 1.234.567,89");
    const gets = api.adminGet.mock.calls.length;
    const feeds = api.adminFeed.mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(api.adminGet.mock.calls.length).toBeGreaterThan(gets));
    await waitFor(() => expect(api.adminFeed.mock.calls.length).toBeGreaterThan(feeds));
  });
});

describe("WorkspaceFinancialTab · movimentações", () => {
  it("pede só as movimentações deste workspace, no período, e mostra cada uma com valor exato e tipo do valor", async () => {
    renderTab();
    await screen.findByText("Aporte");

    expect(api.adminFeed.mock.calls[0][0]).toBe(MOVEMENTS);
    expect(movementParams()).toMatchObject({ workspace_id: WS_ID, from: "2026-10-02", to: "2026-10-31" });
    expect(movementParams().type).toBeUndefined();

    const entrada = screen.getByText("Aporte").closest('[role="row"]') as HTMLElement;
    expect(within(entrada).getByText(/Paga/)).toBeInTheDocument();
    expect(within(entrada).getByText("Aporte via PIX")).toBeInTheDocument();
    expect(within(entrada).getByText("+R$ 2.500,00")).toBeInTheDocument();
    // o tipo do valor é um selo junto do valor (não uma coluna à parte)
    expect(within(entrada).getByText("Realizado", { selector: ".adm-kind" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Tipo do valor/ })).not.toBeInTheDocument();
    expect(within(entrada).getByText("28/10/2026 12:30")).toBeInTheDocument();
  });

  it("saída leva sinal de menos, lançamento interno não leva sinal; cada tipo do valor tem o seu rótulo", async () => {
    renderTab();
    await screen.findByText("Saque", { selector: "b" });

    const saque = screen.getByText("Saque", { selector: "b" }).closest('[role="row"]') as HTMLElement;
    expect(within(saque).getByText("−R$ 700,00")).toBeInTheDocument();
    const lancamento = screen.getByText("Lançamento", { selector: "b" }).closest('[role="row"]') as HTMLElement;
    expect(within(lancamento).getByText("R$ 400,00").closest(".adm-workspaces-amount")).toHaveAttribute("data-direction", "internal");
    expect(within(lancamento).getByText("Comprometido", { selector: ".adm-kind" })).toBeInTheDocument();
  });

  it("a barra de Movimentações é só o segmento (sem filtros nem valores vazios) e a coluna Data não leva largura ajustada à mão", async () => {
    renderTab();
    await screen.findByText("Aporte", { selector: "b" });
    const bar = screen.getByRole("group", { name: "Tipo de movimentação" }).closest(".adm-filters") as HTMLElement;
    expect(bar.querySelector(".adm-filters-row")).toBeNull();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    // a tabela tem linha expansível: o kit soma o botão à coluna 0, então a tela passa só a largura do conteúdo (136px, não 176px)
    const table = document.querySelector(".adm-table") as HTMLElement;
    const columns = table.style.getPropertyValue("--adm-cols") || table.getAttribute("style") || "";
    expect(columns).toMatch(/136px/);
    expect(columns).not.toMatch(/176px/);
  });

  it("origem do valor (só o tipo na linha, sem id cru), campanha e criador como links", async () => {
    renderTab();
    await screen.findByText("Aporte", { selector: "b" });

    const entrada = screen.getByText("Aporte", { selector: "b" }).closest('[role="row"]') as HTMLElement;
    expect(within(entrada).getByText("Cobrança Asaas")).toBeInTheDocument();
    expect(within(entrada).queryByText("aa11-origem")).not.toBeInTheDocument();
    expect(within(entrada).getByRole("link", { name: "Festival Café Serra Verde" })).toHaveAttribute(
      "href",
      "/admin/campaigns/ca3b0000-0000-4000-8000-000000000006",
    );

    expect(within(entrada).getByRole("link", { name: "Festival Café Serra Verde" })).toHaveClass("adm-textlink");

    const saque = screen.getByText("Saque", { selector: "b" }).closest('[role="row"]') as HTMLElement;
    expect(within(saque).getByText("Saque", { selector: ".adm-cell" })).toBeInTheDocument();
    expect(within(saque).getByRole("link", { name: "Vanessa Mendes" })).toHaveAttribute("href", "/admin/users/1002");
  });

  it("o identificador sai da linha e vai para os detalhes da movimentação, copiável (com o externo, quando há)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderTab();
    await screen.findByText("Aporte", { selector: "b" });

    const entrada = () => screen.getByText("Aporte", { selector: "b" }).closest('[role="row"]') as HTMLElement;
    await userEvent.click(within(entrada()).getByRole("button", { name: /^Detalhes da movimentação Aporte de 28\/10\/2026 12:30$/ }));

    const details = screen.getByText("Identificador externo").closest("dl") as HTMLElement;
    expect(within(details).getByText("aa11-origem")).toBeInTheDocument();
    expect(within(details).getByText("pay_123")).toBeInTheDocument();
    expect(within(details).getByText("Cobrança Asaas")).toBeInTheDocument();

    await userEvent.click(within(details).getByRole("button", { name: "Copiar identificador" }));
    expect(writeText).toHaveBeenCalledWith("aa11-origem");
    await userEvent.click(within(details).getByRole("button", { name: "Copiar identificador externo" }));
    expect(writeText).toHaveBeenLastCalledWith("pay_123");
  });

  it("movimentação sem identificador externo não mostra a linha dele", async () => {
    renderTab();
    await screen.findByText("Saque", { selector: "b" });
    const saque = screen.getByText("Saque", { selector: "b" }).closest('[role="row"]') as HTMLElement;
    await userEvent.click(within(saque).getByRole("button", { name: /^Detalhes da movimentação Saque/ }));
    expect(screen.queryByText("Identificador externo")).not.toBeInTheDocument();
    expect(screen.getByText("Identificador")).toBeInTheDocument();
  });

  it("'Carregar mais' pede a próxima página pelo cursor e acrescenta; some quando acaba", async () => {
    routeReads(api.adminFeed, {
      [MOVEMENTS]: (query) => (query?.cursor === "c1" ? feed([SAQUE], false, null) : feed([ENTRADA], true, "c1")),
    });
    renderTab();
    await screen.findByText("Aporte", { selector: "b" });
    expect(screen.queryByText("Saque", { selector: "b" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await waitFor(() => expect(screen.getByText("Saque", { selector: "b" })).toBeInTheDocument());
    expect(screen.getByText("Aporte", { selector: "b" })).toBeInTheDocument();
    expect(movementParams()).toMatchObject({ cursor: "c1", workspace_id: WS_ID });
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("filtro por tipo muda o que o servidor devolve; 'Tudo' volta a mostrar tudo (sem o parâmetro)", async () => {
    routeReads(api.adminFeed, { [MOVEMENTS]: (query) => (query?.type === "charge" ? feed([ENTRADA]) : feed()) });
    renderTab();
    await screen.findByText("Saque", { selector: "b" });
    expect(api.adminFeed.mock.calls.every((call) => (call[1] as Record<string, unknown>).type === undefined)).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Aportes" }));
    await waitFor(() => expect(movementParams()).toMatchObject({ type: "charge", workspace_id: WS_ID }));
    await waitFor(() => expect(screen.queryByText("Saque", { selector: "b" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Aportes" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Tudo" }));
    expect(await screen.findByText("Saque", { selector: "b" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tudo" })).toHaveAttribute("aria-pressed", "true");
  });

  it("sem movimentações no período: texto de vazio", async () => {
    routeReads(api.adminFeed, { [MOVEMENTS]: () => feed([]) });
    renderTab();
    expect(await screen.findByText("Nenhuma movimentação no período")).toBeInTheDocument();
  });

  it("erro nas movimentações: mensagem e 'Tentar de novo'; recurso indisponível tem texto próprio", async () => {
    api.adminFeed.mockRejectedValue(apiError(500, "SERVER_ERROR", "boom"));
    const first = renderTab();
    const retry = await screen.findByRole("button", { name: /Tentar de novo/ }, { timeout: 3000 });
    routeReads(api.adminFeed, { [MOVEMENTS]: () => feed() });
    await userEvent.click(retry);
    expect(await screen.findByText("Aporte")).toBeInTheDocument();
    first.unmount();

    api.adminFeed.mockRejectedValue(toAdminApiError(404, { statusCode: 404, message: "Cannot GET /x" }));
    renderTab();
    expect(await screen.findAllByText("Recurso indisponível")).not.toHaveLength(0);
  });
});

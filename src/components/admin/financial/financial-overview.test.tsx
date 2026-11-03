import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminList: vi.fn(),
  adminFeed: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: client.adminGet, adminList: client.adminList, adminFeed: client.adminFeed };
});

import { AdminApiError } from "@/lib/admin/admin-client";
import { currentSearch } from "@/test/render-admin-route";

import { DEFINITIONS, feedPage, listPage, makeFigures, makeSummary, money } from "./financial-fixtures";
import { renderFinancial } from "./financial-test-support";

/** São Paulo: 31/10/2026 12:00 (UTC-3). "Hoje" nos testes é sempre 2026-10-31. */
const NOW = new Date("2026-10-31T15:00:00.000Z");

function summaryCalls() {
  return client.adminGet.mock.calls.filter(([path]) => path === "/admin/financial/summary");
}

/** O cartão de um número, pelo rótulo: valor, tipo e botão de definição. */
function figureOf(label: string) {
  const card = screen.getByText(label, { selector: ".adm-fig-label" }).closest<HTMLElement>(".adm-fig");
  if (!card) throw new Error(`cartão "${label}" não encontrado`);
  return {
    card,
    // o formato de moeda usa espaço não separável após "R$"
    value: (card.querySelector(".adm-fig-value")?.textContent ?? "").replace(/ /g, " "),
    // com a faixa quieta o tipo vive só no popover do "i" (a linha "Tipo: Realizado")
    kind: (card.querySelector(".adm-fig-kindline")?.textContent ?? "").replace(/^Tipo: /, ""),
    info: card.querySelector<HTMLButtonElement>("button.adm-info"),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  client.adminGet.mockReset();
  client.adminList.mockReset();
  client.adminFeed.mockReset();
  client.adminGet.mockImplementation(async (path: string) => {
    if (path === "/admin/financial/summary") return makeSummary();
    throw new Error(`consulta inesperada: ${path}`);
  });
  client.adminList.mockImplementation(async () => listPage([]));
  client.adminFeed.mockImplementation(async () => feedPage([]));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Financeiro: visão geral", () => {
  it("mostra os números do contrato em blocos com nome, valor exato em reais, tipo e definição", async () => {
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");

    const entradas = screen.getByRole("region", { name: "Entradas" });
    expect(within(entradas).getByText("Aportes no período")).toBeInTheDocument();
    expect(figureOf("Aportes no período")).toMatchObject({ value: "R$ 50.000,50", kind: "Realizado" });
    expect(figureOf("Aportes totais")).toMatchObject({ value: "R$ 1.234.567,89", kind: "Realizado" });
    expect(figureOf("Cobranças pendentes")).toMatchObject({ value: "R$ 3.000,00", kind: "Posição atual" });

    expect(figureOf("Em custódia")).toMatchObject({ value: "R$ 987.654,32", kind: "Posição atual" });
    expect(figureOf("Comprometido")).toMatchObject({ value: "R$ 123.456,00", kind: "Comprometido" });
    expect(figureOf("Saldo livre")).toMatchObject({ value: "R$ 864.198,32", kind: "Calculado" });

    expect(figureOf("Em carência")).toMatchObject({ value: "R$ 2.500,75", kind: "Posição atual" });
    expect(figureOf("Disponível para saque")).toMatchObject({ value: "R$ 800,00" });
    expect(figureOf("Saques em andamento")).toMatchObject({ value: "R$ 450,00" });
    expect(figureOf("Liberado no período")).toMatchObject({ value: "R$ 15.000,00", kind: "Realizado" });
    expect(figureOf("Liberado no total")).toMatchObject({ value: "R$ 76.543,21", kind: "Realizado" });

    expect(figureOf("Pago via PIX no período")).toMatchObject({ value: "R$ 9.000,00", kind: "Realizado" });
    expect(figureOf("Pago via PIX no total")).toMatchObject({ value: "R$ 43.210,00", kind: "Realizado" });
  });

  it("agrupa em Entradas, Custódia, Criadores, Pago, Plataforma e Conferências", async () => {
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    const names = screen.getAllByRole("region").map((region) => region.getAttribute("aria-labelledby"));
    const headings = names.map((id) => document.getElementById(id as string)?.textContent);
    expect(headings).toEqual(["Entradas", "Custódia", "Criadores", "Pago", "Plataforma", "Conferências"]);
  });

  it("cada número leva a regra de cálculo que veio da API (o 'i' ao lado do rótulo)", async () => {
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    expect(figureOf("Aportes totais").info).toHaveAccessibleDescription(expect.stringContaining(DEFINITIONS.funded_total));
    expect(figureOf("Em custódia").info).toHaveAccessibleDescription(expect.stringContaining(DEFINITIONS.custody));
    expect(figureOf("Em custódia").info).toHaveAccessibleName("Como é calculado: Em custódia");
  });

  it("número que não existe no banco (receita da plataforma) é 'Não apurado', nunca zero", async () => {
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");

    const revenue = figureOf("Receita da plataforma");
    expect(revenue.value).toBe("Não apurado");
    expect(revenue.kind).toBe("Não apurado");
    expect(revenue.card.querySelector(".adm-fig-value")).toHaveAttribute("data-unavailable", "true");
    expect(revenue.card).not.toHaveTextContent("R$");
    expect(revenue.info).toHaveAccessibleDescription(expect.stringContaining(DEFINITIONS.platform_revenue));
  });

  it("um número indisponível em qualquer bloco também é 'Não apurado' (nunca R$ 0,00)", async () => {
    client.adminGet.mockResolvedValue(
      makeSummary({ figures: makeFigures({ paid_pix_total: money(null, "unavailable", "Sem registro de transferências.") }) }),
    );
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    expect(figureOf("Pago via PIX no total")).toMatchObject({ value: "Não apurado", kind: "Não apurado" });
  });

  it("deixa o vocabulário explícito em uma linha: liberado não é pago, com o período apurado e a hora", async () => {
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    const note = screen.getByText(/Liberado não é pago:/).closest("p")!;
    expect(note).toHaveTextContent("liberado é o que foi para o saldo do criador; pago é o PIX concluído");
    expect(note).toHaveTextContent("Período apurado: 02/10/2026 – 31/10/2026");
    expect(note).toHaveTextContent("gerado em 31/10/2026 12:00");
  });

  it("o texto completo do aviso fica no 'i' do cabeçalho (liberado × pago, período × posição atual)", async () => {
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    const info = screen.getByRole("button", { name: "Como ler: Liberado e pago" });
    expect(info).toHaveAccessibleDescription(expect.stringContaining("Liberado é o valor que foi para o saldo do criador (em carência, disponível ou já sacado)"));
    expect(info).toHaveAccessibleDescription(expect.stringContaining("pago é o PIX concluído"));
    expect(info).toHaveAccessibleDescription(expect.stringContaining("“Posição atual” são a foto de agora"));
    // cada parágrafo do "i" é o do kit (um <span> em bloco), não uma classe local
    expect(document.querySelector(".adm-fin-help")).toBeNull();
    // o aviso longo não ocupa a página
    expect(screen.queryByText(/Os dois aparecem separados nesta página/, { selector: "p" })).not.toBeInTheDocument();
  });

  it("os indicadores não repetem o tipo nem 'no período': o rótulo diz o período e o tipo vive no 'i'", async () => {
    const { container } = renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    expect(container.querySelector(".adm-fig .adm-kind")).toBeNull();
    // sem "no período" repetido em cada número: o único apoio é o selo de Confere/Investigar da conferência
    expect(Array.from(container.querySelectorAll(".adm-fig-hint")).filter((hint) => /no período/.test(hint.textContent ?? ""))).toHaveLength(0);
    expect(screen.getByText("Aportes no período", { selector: ".adm-fig-label" })).toBeInTheDocument();
    expect(screen.getByText("Pago via PIX no período", { selector: ".adm-fig-label" })).toBeInTheDocument();
    expect(figureOf("Em custódia").card).not.toHaveTextContent("no período");
    // o tipo e a regra continuam acessíveis no popover do "i"
    expect(figureOf("Aportes no período").info).toHaveAccessibleDescription(expect.stringContaining("Tipo: Realizado"));
  });

  it("Conferências: diferença diferente de zero pede investigação e a explicação diz o que é", async () => {
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    const recon = screen.getByRole("region", { name: "Conferências" });

    const drift = figureOf("Comprometido × reservas");
    expect(drift.value).toBe("R$ 250,00");
    expect(drift.kind).toBe("Calculado");
    expect(drift.card).toHaveTextContent("Investigar");
    expect(drift.info).toHaveAccessibleDescription(expect.stringContaining(DEFINITIONS.drift));

    expect(within(recon).getByText(/sinal para investigar, não um erro desta tela/)).toBeInTheDocument();
    // a explicação da conferência está no "i" (e o card traz só número + selo)
    expect(drift.info).toHaveAccessibleDescription(expect.stringContaining("Zero quer dizer que as duas fontes batem"));
    expect(figureOf("Reservas sem campanha").info).toHaveAccessibleDescription(expect.stringContaining("não pertencem a nenhum workspace"));
    // reserva sem campanha é zero: nada de link para a distribuição
    expect(within(recon).queryByRole("link", { name: "Ver por workspace" })).not.toBeInTheDocument();
  });

  it("Conferências: diferença zero confere; reserva sem campanha leva à distribuição por workspace", async () => {
    client.adminGet.mockResolvedValue(
      makeSummary({
        reconciliation: {
          committed_vs_reserved_drift: money(0, "derived", DEFINITIONS.drift),
          unattributed_reserved: money(12_345, "committed", "Reservas sem campanha."),
        },
      }),
    );
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");

    const drift = figureOf("Comprometido × reservas");
    expect(drift.value).toBe("R$ 0,00");
    expect(drift.card).toHaveTextContent("Confere");
    expect(drift.card).not.toHaveTextContent("Investigar");

    expect(figureOf("Reservas sem campanha").value).toBe("R$ 123,45");
    const link = screen.getByRole("link", { name: "Ver por workspace" });
    expect(link).toHaveAttribute("href", expect.stringContaining("tab=by-workspace"));
    expect(link).toHaveAttribute("href", expect.stringContaining("from=2026-10-02"));
  });

  it("uma conferência que não existe é 'Não apurado' e não leva veredito", async () => {
    client.adminGet.mockResolvedValue(
      makeSummary({
        reconciliation: {
          committed_vs_reserved_drift: money(null, "unavailable", "Sem dados de reservas."),
          unattributed_reserved: money(0, "committed"),
        },
      }),
    );
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    const drift = figureOf("Comprometido × reservas");
    expect(drift.value).toBe("Não apurado");
    expect(drift.card).not.toHaveTextContent("Confere");
    expect(drift.card).not.toHaveTextContent("Investigar");
  });
});

describe("Financeiro: estados da visão geral", () => {
  it("carregando: cartões em esqueleto (sem valor nenhum) até a resposta chegar", async () => {
    let resolve!: (value: ReturnType<typeof makeSummary>) => void;
    client.adminGet.mockReturnValue(new Promise((r) => (resolve = r)));
    const { container } = renderFinancial();

    await screen.findByRole("heading", { name: "Financeiro", level: 1 });
    await waitFor(() => expect(container.querySelectorAll(".adm-fig[aria-busy='true']").length).toBeGreaterThan(10));
    expect(container.querySelector(".adm-fig-value")).toBeNull();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();

    resolve(makeSummary());
    await screen.findByText("R$ 1.234.567,89");
    expect(container.querySelector(".adm-fig[aria-busy='true']")).toBeNull();
  });

  it("recurso ainda não disponível no servidor: título e texto próprios, com 'Tentar de novo'", async () => {
    client.adminGet.mockRejectedValueOnce(
      new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }),
    );
    renderFinancial();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Recurso indisponível")).toBeInTheDocument();
    expect(within(alert).getByText("Este recurso ainda não está disponível no servidor.")).toBeInTheDocument();
    // o mesmo erro do Dashboard: cartão branco sobre o fundo da página, compacto
    expect(alert).toHaveClass("adm-state-boxed", "adm-state-compact");
    expect(screen.queryByText("Entradas")).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    await screen.findByText("R$ 1.234.567,89");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(summaryCalls()).toHaveLength(2);
  });

  it("erro de rede: mensagem em português e tentar de novo refaz a consulta", async () => {
    // Rede cai e volta a tentar sozinha (até 2 vezes): só vira erro depois das três falhas.
    client.adminGet.mockRejectedValue(
      new AdminApiError({ status: 0, code: "NETWORK_ERROR", message: "Não foi possível falar com o servidor. Verifique a conexão e tente de novo." }),
    );
    renderFinancial();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Sem conexão")).toBeInTheDocument();
    client.adminGet.mockImplementation(async () => makeSummary());
    await userEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    await screen.findByText("R$ 1.234.567,89");
  });

  it("falta de permissão não oferece repetir", async () => {
    client.adminGet.mockRejectedValue(new AdminApiError({ status: 403, code: "FORBIDDEN", message: "Você não tem permissão para acessar este recurso." }));
    renderFinancial();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Sem permissão")).toBeInTheDocument();
    expect(within(alert).queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });
});

describe("Financeiro: período (dias de São Paulo)", () => {
  it("abre com os 30 dias que terminam hoje e manda as duas datas à API (nunca depende do padrão do servidor)", async () => {
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    expect(summaryCalls()[0][1]).toEqual({ from: "2026-10-02", to: "2026-10-31" });

    const group = screen.getByRole("group", { name: "Período" });
    expect(within(group).getByRole("button", { name: "30 dias" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("02/10/2026 – 31/10/2026")).toBeInTheDocument();
    expect(screen.getByText(/30 dias · horário de São Paulo/)).toBeInTheDocument();
  });

  it("trocar o atalho refaz a consulta com o novo período e grava na URL (o padrão sai da URL)", async () => {
    const { router } = renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    const group = screen.getByRole("group", { name: "Período" });

    await userEvent.click(within(group).getByRole("button", { name: "7 dias" }));
    await waitFor(() => expect(summaryCalls().at(-1)?.[1]).toEqual({ from: "2026-10-25", to: "2026-10-31" }));
    expect(currentSearch(router)).toEqual({ from: "2026-10-25", to: "2026-10-31" });
    expect(screen.getByText("25/10/2026 – 31/10/2026")).toBeInTheDocument();

    await userEvent.click(within(group).getByRole("button", { name: "Mês passado" }));
    await waitFor(() => expect(summaryCalls().at(-1)?.[1]).toEqual({ from: "2026-09-01", to: "2026-09-30" }));

    await userEvent.click(within(group).getByRole("button", { name: "30 dias" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({}));
    await waitFor(() => expect(summaryCalls().at(-1)?.[1]).toEqual({ from: "2026-10-02", to: "2026-10-31" }));
  });

  it("recarregar a página com o período na URL preserva a tela", async () => {
    renderFinancial("/admin/financial?from=2026-09-01&to=2026-09-30");
    await screen.findByText("R$ 1.234.567,89");
    expect(summaryCalls()[0][1]).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    const group = screen.getByRole("group", { name: "Período" });
    expect(within(group).getByRole("button", { name: "Mês passado" })).toHaveAttribute("aria-pressed", "true");
  });

  it("período inválido na URL volta ao padrão (a barra de endereço é entrada de usuário)", async () => {
    renderFinancial("/admin/financial?from=ontem&to=2026-02-30");
    await screen.findByText("R$ 1.234.567,89");
    expect(summaryCalls()[0][1]).toEqual({ from: "2026-10-02", to: "2026-10-31" });
  });

  it("Personalizado abre os campos de data; o intervalo inválido avisa e mantém o período anterior", async () => {
    const { router } = renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    const group = screen.getByRole("group", { name: "Período" });
    expect(screen.queryByRole("group", { name: "Período personalizado" })).not.toBeInTheDocument();

    await userEvent.click(within(group).getByRole("button", { name: "Personalizado" }));
    const custom = screen.getByRole("group", { name: "Período personalizado" });
    const from = within(custom).getByLabelText("De");
    const to = within(custom).getByLabelText("Até");
    expect(from).toHaveValue("2026-10-02");
    expect(to).toHaveValue("2026-10-31");
    expect(to).toHaveAttribute("max", "2026-10-31");

    // a partir de 1º de janeiro de 2025 passaria de 366 dias: o aviso aparece e o período não muda
    fireEvent.change(from, { target: { value: "2025-01-01" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("O período pode ter no máximo 366 dias.");
    expect(currentSearch(router)).toEqual({});
    expect(summaryCalls().at(-1)?.[1]).toEqual({ from: "2026-10-02", to: "2026-10-31" });

    // intervalo válido: vai para a URL e para a API, e o resumo diz o limite do personalizado
    fireEvent.change(from, { target: { value: "2026-01-01" } });
    await waitFor(() => expect(currentSearch(router)).toEqual({ from: "2026-01-01", to: "2026-10-31" }));
    await waitFor(() => expect(summaryCalls().at(-1)?.[1]).toEqual({ from: "2026-01-01", to: "2026-10-31" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // "até" antes do "de": avisa e mantém
    fireEvent.change(to, { target: { value: "2025-12-01" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("A data inicial não pode ser depois da data final.");
    expect(currentSearch(router)).toEqual({ from: "2026-01-01", to: "2026-10-31" });
  });

  it("o resumo do período personalizado lembra o limite de dias", async () => {
    renderFinancial("/admin/financial?from=2025-11-01&to=2026-10-31");
    await screen.findByText("R$ 1.234.567,89");
    expect(screen.getByText(/365 dias · horário de São Paulo · no máximo 366 dias/)).toBeInTheDocument();
  });

  it("Personalizado continua aberto enquanto se mexe nas datas, mesmo que coincidam com um atalho", async () => {
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    const group = screen.getByRole("group", { name: "Período" });
    await userEvent.click(within(group).getByRole("button", { name: "Personalizado" }));
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-10-25" } });
    await waitFor(() => expect(summaryCalls().at(-1)?.[1]).toEqual({ from: "2026-10-25", to: "2026-10-31" }));
    // coincide com "7 dias", mas a pessoa está no campo
    expect(screen.getByRole("group", { name: "Período personalizado" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Personalizado" })).toHaveAttribute("aria-pressed", "true");
  });

  it("campo de data apagado à mão não muda o período", async () => {
    const { router } = renderFinancial("/admin/financial?from=2026-10-10&to=2026-10-20");
    await screen.findByText("R$ 1.234.567,89");
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Informe as duas datas.");
    expect(currentSearch(router)).toEqual({ from: "2026-10-10", to: "2026-10-20" });
  });

  it("o período é um só, no cabeçalho (nenhum seletor dentro das abas)", async () => {
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    expect(screen.getAllByRole("group", { name: "Período" })).toHaveLength(1);
    const header = screen.getByRole("heading", { name: "Financeiro", level: 1 }).closest("header")!;
    expect(within(header).getByRole("group", { name: "Período" })).toBeInTheDocument();
  });
});

describe("Financeiro: abas e atualizar", () => {
  it("a aba fica na URL e leva só o período; a visão geral é o padrão", async () => {
    const { router } = renderFinancial("/admin/financial?from=2026-10-10&to=2026-10-20");
    await screen.findByText("R$ 1.234.567,89");
    expect(screen.getByRole("tab", { name: "Visão geral" })).toHaveAttribute("aria-selected", "true");

    await userEvent.click(screen.getByRole("tab", { name: "Movimentações" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ tab: "movements", from: "2026-10-10", to: "2026-10-20" }));
    expect(screen.getByRole("tab", { name: "Movimentações" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Entradas")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Por workspace" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ tab: "by-workspace", from: "2026-10-10", to: "2026-10-20" }));

    await userEvent.click(screen.getByRole("tab", { name: "Visão geral" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ from: "2026-10-10", to: "2026-10-20" }));
    await screen.findByText("Entradas");
  });

  it("trocar de aba descarta os filtros da outra (só o período atravessa)", async () => {
    const { router } = renderFinancial("/admin/financial?tab=movements&type=withdrawal&from=2026-10-10&to=2026-10-20");
    await screen.findByRole("tab", { name: "Movimentações", selected: true });
    await userEvent.click(screen.getByRole("tab", { name: "Por workspace" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ tab: "by-workspace", from: "2026-10-10", to: "2026-10-20" }));
  });

  it("um link de filtro sem aba (o 'Ver todos' dos alertas) abre as Movimentações já filtradas", async () => {
    renderFinancial("/admin/financial?type=withdrawal");
    await screen.findByRole("tab", { name: "Movimentações", selected: true });
    await waitFor(() => expect(client.adminFeed).toHaveBeenCalled());
    expect(client.adminFeed.mock.calls[0][1]).toMatchObject({ type: "withdrawal" });
  });

  it("'Atualizar' é só o ícone, ao lado do período na visão geral (sem barra de filtros), e refaz a consulta", async () => {
    renderFinancial();
    await screen.findByText("R$ 1.234.567,89");
    expect(summaryCalls()).toHaveLength(1);

    const refresh = screen.getByRole("button", { name: "Atualizar" });
    expect(refresh).toHaveAttribute("data-icon-only", "true");
    expect(refresh.closest("header")).not.toBeNull();
    await userEvent.click(refresh);
    await waitFor(() => expect(summaryCalls()).toHaveLength(2));
  });

  it("nas listas o 'Atualizar' vai para o fim da barra de filtros (um só por tela)", async () => {
    renderFinancial("/admin/financial?tab=movements");
    await screen.findByRole("table", { name: "Movimentações financeiras" });
    const refresh = screen.getByRole("button", { name: "Atualizar" });
    expect(screen.getAllByRole("button", { name: "Atualizar" })).toHaveLength(1);
    expect(refresh.closest("header")).toBeNull();
    expect(refresh.closest(".adm-filters")).not.toBeNull();
  });
});

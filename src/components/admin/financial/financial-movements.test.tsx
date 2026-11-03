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
import type { AdminFinancialMovement } from "@/shared/admin-platform.types";
import { currentSearch } from "@/test/render-admin-route";

import {
  CAFE_ID,
  CAFE_WORKSPACE_DETAIL,
  CAFE_WORKSPACE_ITEM,
  LEDGER_MOVEMENT,
  WITHDRAWAL_MOVEMENT,
  feedPage,
  listPage,
  makeMovement,
  makeSummary,
} from "./financial-fixtures";
import { renderFinancial } from "./financial-test-support";

const NOW = new Date("2026-10-31T15:00:00.000Z");
const CHARGE = makeMovement();

function feedCalls() {
  return client.adminFeed.mock.calls.filter(([path]) => path === "/admin/financial/movements");
}

function lastFeedQuery(): Record<string, unknown> {
  return feedCalls().at(-1)?.[1] as Record<string, unknown>;
}

async function openMovements(url = "/admin/financial?tab=movements") {
  const view = renderFinancial(url);
  const table = await screen.findByRole("table", { name: "Movimentações financeiras" });
  // a tabela existe já no esqueleto: as linhas só depois da primeira resposta
  await waitFor(() => expect(table).not.toHaveAttribute("aria-busy", "true"));
  return { ...view, table };
}

function dataRows(table: HTMLElement) {
  return within(table).getAllByRole("row").slice(1);
}

/** O seletor de workspace da barra: a pílula "Workspace: Todos" que abre a busca. */
const workspacePill = () => screen.getByRole("button", { name: /^Workspace:/ });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  client.adminGet.mockReset();
  client.adminList.mockReset();
  client.adminFeed.mockReset();
  // o seletor de workspace de verdade: a busca (`/admin/workspaces`) e o nome de um id da URL (`/admin/workspaces/:id`)
  client.adminGet.mockImplementation(async (path: string) => (path.startsWith("/admin/workspaces/") ? CAFE_WORKSPACE_DETAIL : makeSummary()));
  client.adminList.mockImplementation(async (path: string) => listPage(path === "/admin/workspaces" ? [CAFE_WORKSPACE_ITEM] : []));
  client.adminFeed.mockImplementation(async () => feedPage([CHARGE, WITHDRAWAL_MOVEMENT, LEDGER_MOVEMENT]));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Movimentações: linhas", () => {
  it("mostra data (São Paulo), tipo, situação, valor exato com sinal e tipo do número, workspace, origem e descrição", async () => {
    const { table } = await openMovements();
    const [charge] = dataRows(table);

    // 22:30 em UTC é 19:30 em São Paulo
    expect(within(charge).getByText("30/10/2026")).toBeInTheDocument();
    expect(within(charge).getByText("19:30")).toBeInTheDocument();
    expect(within(charge).getByText("Aporte")).toBeInTheDocument();
    expect(within(charge).getByText("Pago")).toBeInTheDocument();
    expect(within(charge).getByText("Aporte via PIX confirmado")).toBeInTheDocument();

    expect(within(charge).getByText("+ R$ 1.000,00")).toBeInTheDocument();
    expect(within(charge).getByLabelText("Entrada: R$ 1.000,00")).toBeInTheDocument();
    expect(charge.querySelector(".adm-kind")).toHaveTextContent("Realizado");
    expect(charge.querySelector(".adm-kind")).toHaveAttribute("data-kind", "realized");

    expect(within(charge).getByRole("link", { name: "Café Serra Verde" })).toHaveAttribute("href", `/admin/workspaces/${CAFE_ID}`);
    expect(within(charge).getByText("Cobrança Asaas")).toBeInTheDocument();
  });

  it("o tipo do valor é um texto visível ao lado do número (não só dica de mouse) e o 'i' da coluna explica cada tipo", async () => {
    const { table } = await openMovements();
    const [charge] = dataRows(table);
    const kind = charge.querySelector(".adm-kind")!;
    expect(kind).toHaveTextContent("Realizado");
    expect(kind).not.toHaveAttribute("title");

    const info = within(table).getByRole("button", { name: "Como é calculado: Valor" });
    for (const text of ["Realizado:", "Comprometido:", "Posição atual:", "Calculado:", "Aproximado:", "Não apurado:", "Fato consolidado"]) {
      expect(info).toHaveAccessibleDescription(expect.stringContaining(text));
    }
  });

  it("a data não depende de dica de mouse: o fuso está no resumo do período", async () => {
    const { table } = await openMovements();
    const [charge] = dataRows(table);
    expect(charge.querySelector("time")).toHaveAttribute("datetime", CHARGE.occurred_at);
    expect(charge.querySelector("[title]")).toBeNull();
    expect(screen.getByText(/horário de São Paulo/)).toBeInTheDocument();
  });

  it("saque: sinal de saída, sem workspace é 'Não atribuído', e o criador linka para o usuário", async () => {
    const { table } = await openMovements();
    const withdrawal = dataRows(table)[1];

    expect(within(withdrawal).getByText("Saque")).toBeInTheDocument();
    expect(within(withdrawal).getByText("Saque solicitado")).toBeInTheDocument();
    expect(within(withdrawal).getByText("− R$ 450,50")).toBeInTheDocument();
    expect(within(withdrawal).getByLabelText("Saída: R$ 450,50")).toBeInTheDocument();
    expect(withdrawal.querySelector(".adm-kind")).toHaveTextContent("Posição atual");
    expect(within(withdrawal).getByText("Não atribuído")).toBeInTheDocument();
    expect(within(withdrawal).getByRole("link", { name: "Vanessa Mendes" })).toHaveAttribute("href", "/admin/users/1002");
    expect(within(withdrawal).getByText("Saque do criador")).toBeInTheDocument();
  });

  it("lançamento interno vai sem sinal e mostra campanha e criador", async () => {
    const { table } = await openMovements();
    const ledger = dataRows(table)[2];

    expect(within(ledger).getByText("Lançamento")).toBeInTheDocument();
    expect(within(ledger).getByText("R$ 300,00")).toBeInTheDocument();
    expect(within(ledger).getByLabelText("Movimento interno: R$ 300,00")).toBeInTheDocument();
    expect(ledger.querySelector(".adm-kind")).toHaveTextContent("Comprometido");
    expect(within(ledger).getByRole("link", { name: "Festival Café Serra Verde" })).toHaveAttribute(
      "href",
      "/admin/campaigns/ca3b0000-0000-4000-8000-000000000006",
    );
    expect(within(ledger).getByRole("link", { name: "Bruno Carvalho" })).toHaveAttribute("href", "/admin/users/1003");
  });

  it("cada tipo de número aparece com o rótulo do vocabulário (realizado, comprometido, posição atual, calculado)", async () => {
    client.adminFeed.mockResolvedValue(
      feedPage([
        makeMovement({ id: "charge:a", kind: "derived", status: "expired", status_label: "Expirada" }),
        makeMovement({ id: "charge:b", kind: "stock", status: "pending", status_label: "Aguardando pagamento" }),
      ]),
    );
    const { table } = await openMovements();
    const kinds = dataRows(table).map((row) => row.querySelector(".adm-kind")?.textContent);
    expect(kinds).toEqual(["Calculado", "Posição atual"]);
  });

  it("os ids de origem ficam na linha aberta (não ocupam a linha fechada) e se copiam com um clique", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const { table } = await openMovements();
    expect(within(table).queryByRole("button", { name: /^Copiar/ })).not.toBeInTheDocument();

    const expand = within(table).getByRole("button", { name: "Ids de origem: Aporte de 30/10/2026 19:30" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "true");

    const copyId = within(table).getByRole("button", { name: "Copiar id de origem (Cobrança Asaas)" });
    // o valor aparece inteiro, sem depender de `title`
    expect(copyId).toHaveTextContent("11111111-1111-4111-8111-111111111111");
    expect(copyId).not.toHaveAttribute("title");
    await userEvent.click(copyId);
    expect(writeText).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    await within(table).findByText("Copiado");

    await userEvent.click(within(table).getByRole("button", { name: "Copiar id externo (Cobrança Asaas)" }));
    expect(writeText).toHaveBeenLastCalledWith("pay_8a7b6c5d");

    // saque sem id externo: só um botão de copiar
    await userEvent.click(within(table).getByRole("button", { name: "Ids de origem: Saque de 30/10/2026 10:00" }));
    expect(within(table).getAllByRole("button", { name: /^Copiar id/ })).toHaveLength(3);
    expect(within(table).getAllByRole("button", { name: "Copiar id de origem (Saque do criador)" })).toHaveLength(1);
    expect(within(table).queryByRole("button", { name: "Copiar id externo (Saque do criador)" })).not.toBeInTheDocument();

    // fechar a linha tira os ids
    await userEvent.click(expand);
    expect(within(table).queryByRole("button", { name: "Copiar id de origem (Cobrança Asaas)" })).not.toBeInTheDocument();
  });

  it("se a área de transferência não existir, avisa em vez de fingir que copiou", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    const { table } = await openMovements();
    await userEvent.click(within(table).getByRole("button", { name: /^Ids de origem: Aporte/ }));
    await userEvent.click(within(table).getByRole("button", { name: "Copiar id de origem (Cobrança Asaas)" }));
    await within(table).findByText("Não foi possível copiar");
  });
});

describe("Movimentações: filtros enviados à API", () => {
  it("abre com o período da página e sem tipo nem workspace", async () => {
    await openMovements();
    expect(lastFeedQuery()).toMatchObject({ from: "2026-10-02", to: "2026-10-31", limit: 50 });
    expect(lastFeedQuery().type).toBeUndefined();
    expect(lastFeedQuery().workspace_id).toBeUndefined();
    expect(lastFeedQuery().cursor).toBeUndefined();
  });

  it("o tipo vai para a API e para a URL (Todas é a ausência do filtro)", async () => {
    const { router } = await openMovements();
    const types = screen.getByRole("group", { name: "Tipo de movimentação" });
    expect(within(types).getAllByRole("button").map((b) => b.textContent)).toEqual(["Todas", "Cobranças", "Lançamentos", "Saques", "Transferências"]);
    expect(within(types).getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");

    for (const [label, type] of [
      ["Cobranças", "charge"],
      ["Lançamentos", "ledger_entry"],
      ["Saques", "withdrawal"],
      ["Transferências", "transfer"],
    ] as const) {
      await userEvent.click(within(types).getByRole("button", { name: label }));
      await waitFor(() => expect(lastFeedQuery().type).toBe(type));
      expect(currentSearch(router)).toMatchObject({ tab: "movements", type });
      expect(within(types).getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
    }

    await userEvent.click(within(types).getByRole("button", { name: "Todas" }));
    await waitFor(() => expect(lastFeedQuery().type).toBeUndefined());
    expect(currentSearch(router)).toEqual({ tab: "movements" });
  });

  it("o workspace escolhido vai para a API e para a URL e vira chip; remover o chip volta ao todos", async () => {
    const { router } = await openMovements();
    expect(workspacePill()).toHaveTextContent("Todos");
    await userEvent.click(workspacePill());
    await userEvent.click(await screen.findByRole("option", { name: /Café Serra Verde/ }));
    await waitFor(() => expect(lastFeedQuery().workspace_id).toBe(CAFE_ID));
    expect(currentSearch(router)).toMatchObject({ tab: "movements", workspace_id: CAFE_ID });
    expect(workspacePill()).toHaveTextContent("Café Serra Verde");
    expect(client.adminList).toHaveBeenCalledWith("/admin/workspaces", expect.objectContaining({ kind: "brand" }), expect.anything());

    await userEvent.click(screen.getByRole("button", { name: "Remover filtro Workspace: Café Serra Verde" }));
    await waitFor(() => expect(lastFeedQuery().workspace_id).toBeUndefined());
    expect(currentSearch(router)).toEqual({ tab: "movements" });
  });

  it("o chip do workspace recém-escolhido já traz o nome: não busca o detalhe nem mostra 'Carregando…'", async () => {
    const { router } = await openMovements();
    await userEvent.click(workspacePill());
    await userEvent.click(await screen.findByRole("option", { name: /Café Serra Verde/ }));
    expect(screen.getByRole("button", { name: "Remover filtro Workspace: Café Serra Verde" })).toBeInTheDocument();
    await waitFor(() => expect(currentSearch(router)).toMatchObject({ workspace_id: CAFE_ID }));
    expect(screen.queryByText(/Carregando…/)).not.toBeInTheDocument();
    expect(client.adminGet.mock.calls.some(([path]) => String(path).startsWith("/admin/workspaces/"))).toBe(false);
  });

  it("a coluna Data tem 136px e o kit soma sozinho o botão de expandir (nada alargado à mão)", async () => {
    const { table } = await openMovements();
    const cols = (table.closest(".adm-table") as HTMLElement).style.getPropertyValue("--adm-cols");
    expect(cols).toMatch(/^calc\(136px \+ \(var\(--adm-hit\) - 2px\)\)/);
  });

  it("o 'i' da coluna Valor usa os parágrafos do kit (um por tipo de número)", async () => {
    await openMovements();
    const info = screen.getByRole("button", { name: "Como é calculado: Valor" });
    expect(info).toHaveAccessibleDescription(expect.stringContaining("Realizado:"));
    expect(document.querySelectorAll(".adm-fin-help")).toHaveLength(0);
  });

  it("tipo, workspace e período juntos; 'Limpar filtros' (o do kit) zera tipo e workspace de uma vez e mantém o período", async () => {
    const { router } = await openMovements("/admin/financial?tab=movements&type=transfer&workspace_id=" + CAFE_ID + "&from=2026-09-01&to=2026-09-30");
    expect(lastFeedQuery()).toMatchObject({ type: "transfer", workspace_id: CAFE_ID, from: "2026-09-01", to: "2026-09-30" });
    expect(screen.getByRole("button", { name: "Transferências" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(workspacePill()).toHaveTextContent("Café Serra Verde"));
    // o filtro entra em "Filtros (n)" e vira chip
    expect(screen.getByRole("button", { name: "Remover filtro Workspace: Café Serra Verde" })).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    await waitFor(() => expect(lastFeedQuery().type).toBeUndefined());
    expect(lastFeedQuery().workspace_id).toBeUndefined();
    expect(lastFeedQuery()).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(currentSearch(router)).toEqual({ tab: "movements", from: "2026-09-01", to: "2026-09-30" });
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a barra é uma só (segmento de tipo + workspace + atualizar) e não há 'Limpar filtros' próprio fora dela", async () => {
    const { container } = await openMovements("/admin/financial?tab=movements&workspace_id=" + CAFE_ID);
    expect(container.querySelectorAll(".adm-filters")).toHaveLength(1);
    expect(container.querySelector(".adm-fin-bar")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Limpar filtros" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Limpar filtros" })[0]).toHaveClass("adm-textbtn");
  });

  it("valor solto na URL (tipo desconhecido, workspace que não é uuid) nunca chega à API", async () => {
    await openMovements("/admin/financial?tab=movements&type=boleto&workspace_id=abc");
    expect(lastFeedQuery().type).toBeUndefined();
    expect(lastFeedQuery().workspace_id).toBeUndefined();
  });

  it("trocar o período refaz o feed com as novas datas", async () => {
    await openMovements();
    const period = screen.getByRole("group", { name: "Período" });
    await userEvent.click(within(period).getByRole("button", { name: "7 dias" }));
    await waitFor(() => expect(lastFeedQuery()).toMatchObject({ from: "2026-10-25", to: "2026-10-31" }));
  });
});

describe("Movimentações: carregar mais (cursor)", () => {
  const A = makeMovement({ id: "charge:a", occurred_at: "2026-10-30T12:00:00.000Z" });
  const B = makeMovement({ id: "charge:b", occurred_at: "2026-10-29T12:00:00.000Z" });
  const C = makeMovement({ id: "charge:c", occurred_at: "2026-10-28T12:00:00.000Z" });
  const D = makeMovement({ id: "charge:d", occurred_at: "2026-10-27T12:00:00.000Z" });

  function paginate(pages: Record<string, ReturnType<typeof feedPage<AdminFinancialMovement>>>) {
    client.adminFeed.mockImplementation(async (_path: string, query: { cursor?: string }) => {
      const page = pages[query.cursor ?? "first"];
      if (!page) throw new AdminApiError({ status: 400, code: "BAD_REQUEST", message: "cursor inválido." });
      return page;
    });
  }

  it("a próxima página usa o cursor da anterior, sem repetir linhas, e termina quando acaba", async () => {
    paginate({
      first: feedPage([A, B], "cursor-1"),
      "cursor-1": feedPage([B, C], "cursor-2"), // B repetido: não pode aparecer duas vezes
      "cursor-2": feedPage([D], null),
    });
    const { table } = await openMovements();
    expect(dataRows(table)).toHaveLength(2);
    expect(screen.getByText("2 movimentações carregadas")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await waitFor(() => expect(dataRows(table)).toHaveLength(3));
    expect(feedCalls().at(-1)?.[1]).toMatchObject({ cursor: "cursor-1", limit: 50, from: "2026-10-02", to: "2026-10-31" });
    expect(screen.getByText("3 movimentações carregadas")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await waitFor(() => expect(dataRows(table)).toHaveLength(4));
    expect(feedCalls().at(-1)?.[1]).toMatchObject({ cursor: "cursor-2" });

    // fim da lista: sem botão
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
    expect(screen.getByText("4 movimentações carregadas · fim da lista")).toBeInTheDocument();
    // B veio nas duas páginas e aparece uma vez só: 4 linhas para A, B, C, D
    expect(dataRows(table)).toHaveLength(4);
  });

  it("uma única página sem 'has_more' não oferece carregar mais", async () => {
    client.adminFeed.mockResolvedValue(feedPage([A]));
    await openMovements();
    expect(screen.getByText("1 movimentação carregada · fim da lista")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("enquanto a próxima página chega, o botão avisa e não aceita outro clique", async () => {
    let resolve!: (value: ReturnType<typeof feedPage<AdminFinancialMovement>>) => void;
    client.adminFeed
      .mockResolvedValueOnce(feedPage([A], "cursor-1"))
      .mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { table } = await openMovements();

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    const loading = await screen.findByRole("button", { name: "Carregando…" });
    // `aria-disabled` (e não `disabled`): o foco fica no botão enquanto carrega
    expect(loading).toHaveAttribute("aria-disabled", "true");
    expect(dataRows(table)).toHaveLength(1);

    resolve(feedPage([B]));
    await waitFor(() => expect(dataRows(table)).toHaveLength(2));
  });

  it("trocar um filtro recomeça do início (o cursor só vale para os mesmos filtros)", async () => {
    paginate({ first: feedPage([A], "cursor-1"), "cursor-1": feedPage([B]) });
    await openMovements();
    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await waitFor(() => expect(feedCalls().at(-1)?.[1]).toMatchObject({ cursor: "cursor-1" }));

    await userEvent.click(screen.getByRole("button", { name: "Saques" }));
    await waitFor(() => expect(lastFeedQuery().type).toBe("withdrawal"));
    expect(lastFeedQuery().cursor).toBeUndefined();
  });

  it("falha ao carregar mais: as linhas ficam, o aviso aparece e 'Tentar de novo' repete a mesma página", async () => {
    client.adminFeed
      .mockResolvedValueOnce(feedPage([A, B], "cursor-1"))
      .mockRejectedValueOnce(new AdminApiError({ status: 400, code: "BAD_REQUEST", message: "cursor inválido para estes filtros: recomece a listagem." }))
      .mockResolvedValueOnce(feedPage([C]));
    const { table } = await openMovements();

    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("cursor inválido para estes filtros: recomece a listagem.")).toBeInTheDocument();
    expect(dataRows(table)).toHaveLength(2);

    await userEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(dataRows(table)).toHaveLength(3));
    expect(feedCalls().at(-1)?.[1]).toMatchObject({ cursor: "cursor-1" });
  });
});

describe("Movimentações: estados", () => {
  it("carregando: esqueleto na tabela e nenhuma linha", async () => {
    let resolve!: (value: ReturnType<typeof feedPage<AdminFinancialMovement>>) => void;
    client.adminFeed.mockReturnValue(new Promise((r) => (resolve = r)));
    const { container } = renderFinancial("/admin/financial?tab=movements");
    await screen.findByRole("tab", { name: "Movimentações", selected: true });
    await waitFor(() => expect(container.querySelectorAll(".adm-row .adm-sk").length).toBeGreaterThan(0));
    expect(screen.getByRole("table", { name: "Movimentações financeiras" })).toHaveAttribute("aria-busy", "true");

    resolve(feedPage([CHARGE]));
    await screen.findByText("Aporte via PIX confirmado");
    expect(container.querySelector(".adm-row .adm-sk")).toBeNull();
  });

  it("vazio sem filtro: explica o período", async () => {
    client.adminFeed.mockResolvedValue(feedPage([]));
    await openMovements();
    expect(await screen.findByText("Nenhuma movimentação no período")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("vazio com filtro: diz que é o filtro e oferece limpar", async () => {
    client.adminFeed.mockResolvedValue(feedPage([]));
    const { router } = await openMovements("/admin/financial?tab=movements&type=transfer");
    expect(await screen.findByText("Nenhuma movimentação com estes filtros")).toBeInTheDocument();
    // o tipo fora do padrão conta como filtro (segmentDefault): vira chip e a barra também oferece "Limpar filtros"
    expect(screen.getByRole("button", { name: "Remover filtro Tipo de movimentação: Transferências" })).toBeInTheDocument();
    const clearButtons = screen.getAllByRole("button", { name: "Limpar filtros" });
    expect(clearButtons).toHaveLength(2);
    await userEvent.click(clearButtons[0]);
    await waitFor(() => expect(currentSearch(router)).toEqual({ tab: "movements" }));
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("recurso ainda não disponível no servidor", async () => {
    client.adminFeed.mockRejectedValueOnce(
      new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }),
    );
    await openMovements();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Recurso indisponível")).toBeInTheDocument();
    expect(within(alert).getByText("Este recurso ainda não está disponível no servidor.")).toBeInTheDocument();

    client.adminFeed.mockResolvedValue(feedPage([CHARGE]));
    await userEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    await screen.findByText("Aporte via PIX confirmado");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("erro do servidor: mensagem em português e tentar de novo", async () => {
    client.adminFeed.mockRejectedValue(new AdminApiError({ status: 500, code: "SERVER_ERROR", message: "O servidor teve um problema. Tente novamente em instantes." }));
    await openMovements();
    const alert = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(within(alert).getByText("O servidor teve um problema. Tente novamente em instantes.")).toBeInTheDocument();
  });

  it("no celular a mesma tabela vira cartões 'rótulo / valor' (cada célula leva o rótulo)", async () => {
    const { table } = await openMovements();
    const [charge] = dataRows(table);
    const labels = Array.from(charge.querySelectorAll(".adm-cell")).map((cell) => cell.getAttribute("data-label"));
    expect(labels).toEqual(["Data", "Movimentação", "Valor", "Workspace e criador", "Origem"]);
    fireEvent.click(within(charge).getByRole("link", { name: "Café Serra Verde" }));
  });
});

import { cleanup, screen, waitFor, within } from "@testing-library/react";
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

import {
  AURORA_ID,
  AURORA_ROW,
  BY_WORKSPACE_DEFINITIONS,
  CAFE_ID,
  CAFE_ROW,
  UNASSIGNED_ROW,
  feedPage,
  listPage,
  makeSummary,
} from "./financial-fixtures";
import { renderFinancial } from "./financial-test-support";

const NOW = new Date("2026-10-31T15:00:00.000Z");

function listCalls() {
  return client.adminList.mock.calls.filter(([path]) => path === "/admin/financial/by-workspace");
}

function lastQuery(): Record<string, unknown> {
  return listCalls().at(-1)?.[1] as Record<string, unknown>;
}

async function openByWorkspace(url = "/admin/financial?tab=by-workspace") {
  const view = renderFinancial(url);
  const table = await screen.findByRole("table", { name: "Financeiro por workspace" });
  // a tabela existe já no esqueleto: as linhas só depois da primeira resposta
  await waitFor(() => expect(table).not.toHaveAttribute("aria-busy", "true"));
  return { ...view, table };
}

function dataRows(table: HTMLElement) {
  return within(table).getAllByRole("row").slice(1);
}

function pageResponse(rows = [CAFE_ROW, AURORA_ROW, UNASSIGNED_ROW]) {
  return listPage(rows, { definitions: BY_WORKSPACE_DEFINITIONS });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  client.adminGet.mockReset();
  client.adminList.mockReset();
  client.adminFeed.mockReset();
  client.adminGet.mockImplementation(async () => makeSummary());
  client.adminFeed.mockImplementation(async () => feedPage([]));
  client.adminList.mockImplementation(async () => pageResponse());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Por workspace: dados", () => {
  it("mostra aportes, custódia, comprometido, liberado e pago via PIX por workspace, em dinheiro exato", async () => {
    const { table } = await openByWorkspace();
    const [cafe, aurora] = dataRows(table);

    expect(within(cafe).getByText("Café Serra Verde")).toBeInTheDocument();
    expect(within(cafe).getByText("R$ 25.000,00")).toBeInTheDocument(); // aportes
    expect(within(cafe).getByText("R$ 12.345,67")).toBeInTheDocument(); // custódia
    expect(within(cafe).getByText("R$ 5.000,00")).toBeInTheDocument(); // comprometido
    expect(within(cafe).getByText("R$ 7.500,00")).toBeInTheDocument(); // liberado
    expect(within(cafe).getByText("R$ 0,00")).toBeInTheDocument(); // pago via PIX: zero real

    expect(within(aurora).getByText("R$ 2.500,00")).toBeInTheDocument(); // pago via PIX
  });

  it("os cabeçalhos dizem o que é cada coluna e levam a definição que a API mandou", async () => {
    const { table } = await openByWorkspace();
    const headers = within(table).getAllByRole("columnheader");
    const names = ["Workspace", "Aportes", "Custódia", "Comprometido", "Liberado", "Pago via PIX"];
    expect(headers).toHaveLength(names.length);
    names.forEach((name, index) => expect(headers[index]).toHaveTextContent(new RegExp(`^${name}`)));

    const info = within(table).getByRole("button", { name: "Como é calculado: Custódia" });
    expect(info).toHaveAccessibleDescription("Saldo em custódia agora (não depende do período).");
    expect(within(table).getByRole("button", { name: "Como é calculado: Pago via PIX" })).toHaveAccessibleDescription("PIX concluído no período.");
  });

  it("a nota de escopo (período × posição de agora) fica sob a tabela, não ao lado da busca", async () => {
    const { table } = await openByWorkspace();
    const note = screen.getByText(/Aportes, liberado e pago via PIX são do período escolhido/);
    expect(note).toHaveTextContent("Custódia e comprometido são a posição de agora.");
    expect(note.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(note.closest(".adm-filters")).toBeNull();
  });

  it("a barra tem a busca (com nome) e o 'Atualizar' só com o ícone no fim", async () => {
    const { container } = await openByWorkspace();
    expect(container.querySelectorAll(".adm-filters")).toHaveLength(1);
    const refresh = screen.getByRole("button", { name: "Atualizar" });
    expect(refresh).toHaveAttribute("data-icon-only", "true");
    expect(refresh.closest(".adm-filters")).not.toBeNull();
    await userEvent.click(refresh);
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(1));
  });

  it("a linha do workspace abre a aba Financeiro do detalhe (/admin/workspaces/:id?tab=financial)", async () => {
    const { table } = await openByWorkspace();
    const [cafe, aurora] = dataRows(table);
    const link = within(cafe).getByRole("link");
    expect(link).toHaveAttribute("href", `/admin/workspaces/${CAFE_ID}?tab=financial`);
    expect(within(aurora).getByRole("link")).toHaveAttribute("href", `/admin/workspaces/${AURORA_ID}?tab=financial`);
  });

  it("a linha 'Não atribuído' mostra os valores sem workspace e não tem para onde ir", async () => {
    const { table } = await openByWorkspace();
    const unassigned = dataRows(table)[2];
    expect(within(unassigned).getByText("Não atribuído")).toBeInTheDocument();
    expect(within(unassigned).getByText("Valores sem workspace")).toBeInTheDocument();
    expect(within(unassigned).getByText("R$ 123,45")).toBeInTheDocument();
    expect(within(unassigned).queryByRole("link")).not.toBeInTheDocument();
    expect(unassigned).not.toHaveAttribute("data-link");
  });

  it("zero aparece apagado (é um valor real, não ausência)", async () => {
    const { table } = await openByWorkspace();
    const zero = within(dataRows(table)[0]).getByText("R$ 0,00");
    expect(zero).toHaveClass("adm-muted");
  });
});

describe("Por workspace: consulta, período, ordenação, busca e página", () => {
  it("abre ordenado por aportes (decrescente), 25 por página, com o período da página", async () => {
    await openByWorkspace();
    expect(lastQuery()).toEqual({ page: 1, per_page: 25, sort_by: "funded", order: "desc", from: "2026-10-02", to: "2026-10-31" });
  });

  it("o cabeçalho ordenável mostra o sentido e clicar alterna (dinheiro começa do maior; nome, do A ao Z)", async () => {
    const { table, router } = await openByWorkspace();
    const funded = within(table).getByRole("columnheader", { name: /Aportes/ });
    expect(funded).toHaveAttribute("aria-sort", "descending");

    await userEvent.click(within(table).getByRole("button", { name: "Custódia" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ sort_by: "custody", order: "desc", page: 1 }));
    expect(within(table).getByRole("columnheader", { name: /Custódia/ })).toHaveAttribute("aria-sort", "descending");
    expect(currentSearch(router)).toMatchObject({ tab: "by-workspace", sort_by: "custody" });

    await userEvent.click(within(table).getByRole("button", { name: "Custódia" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ sort_by: "custody", order: "asc" }));

    await userEvent.click(within(table).getByRole("button", { name: "Workspace" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ sort_by: "name", order: "asc" }));
  });

  it("Pago via PIX não é ordenável (o contrato não tem essa chave)", async () => {
    const { table } = await openByWorkspace();
    const pix = within(table).getByRole("columnheader", { name: /Pago via PIX/ });
    expect(pix).not.toHaveAttribute("aria-sort");
    expect(within(pix).queryByRole("button", { name: "Pago via PIX" })).not.toBeInTheDocument();
  });

  it("busca por nome vai para a API e volta para a página 1", async () => {
    client.adminList.mockImplementation(async () => listPage([CAFE_ROW], { total: 60, total_pages: 3, definitions: BY_WORKSPACE_DEFINITIONS }));
    const { router } = await openByWorkspace("/admin/financial?tab=by-workspace&page=2");
    await waitFor(() => expect(lastQuery().page).toBe(2));

    const search = screen.getByRole("searchbox", { name: "Buscar workspaces" });
    await userEvent.type(search, "café{Enter}");
    await waitFor(() => expect(lastQuery()).toMatchObject({ search: "café", page: 1 }));
    expect(currentSearch(router)).toMatchObject({ tab: "by-workspace", search: "café" });
    expect(currentSearch(router)).not.toHaveProperty("page");
  });

  it("paginação: próxima página e itens por página vão para a API", async () => {
    client.adminList.mockImplementation(async () => listPage([CAFE_ROW, AURORA_ROW], { total: 120, total_pages: 5, definitions: BY_WORKSPACE_DEFINITIONS }));
    const { router } = await openByWorkspace();
    expect(await screen.findByText(/de 120/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(lastQuery().page).toBe(2));
    expect(currentSearch(router)).toMatchObject({ tab: "by-workspace", page: 2 });

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Itens por página" }), "50");
    await waitFor(() => expect(lastQuery()).toMatchObject({ per_page: 50, page: 1 }));
  });

  it("trocar o período volta para a página 1 e manda as novas datas", async () => {
    client.adminList.mockImplementation(async () => listPage([CAFE_ROW], { total: 60, total_pages: 3, definitions: BY_WORKSPACE_DEFINITIONS }));
    const { router } = await openByWorkspace("/admin/financial?tab=by-workspace&page=3");
    await waitFor(() => expect(lastQuery().page).toBe(3));

    const period = screen.getByRole("group", { name: "Período" });
    await userEvent.click(within(period).getByRole("button", { name: "Mês passado" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 1, from: "2026-09-01", to: "2026-09-30" }));
    expect(currentSearch(router)).toEqual({ tab: "by-workspace", from: "2026-09-01", to: "2026-09-30" });
  });

  it("página além do fim (o filtro encolheu a lista) volta para a última", async () => {
    client.adminList.mockImplementation(async (_path: string, query: { page: number }) =>
      listPage(query.page > 2 ? [] : [CAFE_ROW], { page: query.page, total: 40, total_pages: 2, definitions: BY_WORKSPACE_DEFINITIONS }),
    );
    const { router } = await openByWorkspace("/admin/financial?tab=by-workspace&page=9");
    await waitFor(() => expect(currentSearch(router)).toMatchObject({ page: 2 }));
  });
});

describe("Por workspace: estados", () => {
  it("carregando: esqueleto na tabela", async () => {
    let resolve!: (value: ReturnType<typeof pageResponse>) => void;
    client.adminList.mockReturnValue(new Promise((r) => (resolve = r)));
    const { container } = renderFinancial("/admin/financial?tab=by-workspace");
    await screen.findByRole("tab", { name: "Por workspace", selected: true });
    await waitFor(() => expect(container.querySelectorAll(".adm-row .adm-sk").length).toBeGreaterThan(0));

    resolve(pageResponse());
    await screen.findByText("Café Serra Verde");
    expect(container.querySelector(".adm-row .adm-sk")).toBeNull();
  });

  it("vazio: diz que não há workspace com valores no período", async () => {
    client.adminList.mockResolvedValue(listPage([]));
    await openByWorkspace();
    expect(await screen.findByText("Nenhum workspace com valores neste período")).toBeInTheDocument();
  });

  it("vazio com busca: oferece limpar a busca", async () => {
    client.adminList.mockResolvedValue(listPage([]));
    const { router } = await openByWorkspace("/admin/financial?tab=by-workspace&search=zzz");
    expect(await screen.findByText("Nenhum workspace encontrado")).toBeInTheDocument();
    // Há dois "Limpar busca": o x do campo e o botão do estado vazio; este é o segundo.
    await userEvent.click(screen.getAllByRole("button", { name: "Limpar busca" }).at(-1)!);
    await waitFor(() => expect(currentSearch(router)).toEqual({ tab: "by-workspace" }));
  });

  it("recurso ainda não disponível no servidor, com tentar de novo", async () => {
    client.adminList.mockRejectedValueOnce(
      new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }),
    );
    await openByWorkspace();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Recurso indisponível")).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    await screen.findByText("Café Serra Verde");
  });
});

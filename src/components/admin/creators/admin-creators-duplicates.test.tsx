import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  adminList: vi.fn(),
  adminGet: vi.fn(),
  adminGetEnvelope: vi.fn(),
  adminPost: vi.fn(),
  adminPatch: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return {
    ...actual,
    adminList: client.adminList,
    adminGet: client.adminGet,
    adminGetEnvelope: client.adminGetEnvelope,
    adminPost: client.adminPost,
    adminPatch: client.adminPatch,
  };
});

import { AdminApiError } from "@/lib/admin/admin-client";
import { currentSearch } from "@/test/render-admin-route";

import { DUPLICATES_READ_ONLY_NOTE } from "./admin-creators-duplicates";
import { DUPLICATE_GROUP, POSSIBLE_DUPLICATE_GROUP, pageOf } from "./creator-fixtures";
import { renderCreators } from "./creator-test-utils";

/** Parâmetros da última consulta à lista de duplicados. */
function lastParams(): Record<string, unknown> {
  const calls = client.adminList.mock.calls.filter(([path]) => path === "/admin/creators/duplicates");
  return calls.at(-1)?.[1] as Record<string, unknown>;
}

async function renderLoaded(url = "/admin/creators?tab=duplicates") {
  const view = renderCreators(url);
  await screen.findByRole("article", { name: /E-mail: j\*\*\*@outlook\.test/ });
  return view;
}

beforeEach(() => {
  for (const mock of Object.values(client)) mock.mockReset();
  client.adminList.mockImplementation(async () => pageOf([DUPLICATE_GROUP, POSSIBLE_DUPLICATE_GROUP]));
});

afterEach(() => {
  cleanup();
});

describe("Duplicados: grupos", () => {
  it("abre direto na aba e consulta só os duplicados (a lista de criadores e as inconsistências não carregam)", async () => {
    await renderLoaded();
    expect(screen.getByRole("tab", { name: "Duplicados" })).toHaveAttribute("aria-selected", "true");
    expect(client.adminList.mock.calls.every(([path]) => path === "/admin/creators/duplicates")).toBe(true);
    expect(client.adminGetEnvelope).not.toHaveBeenCalled();
  });

  it("a nota 'Somente leitura: nada é fundido ou alterado automaticamente' está sempre à vista", async () => {
    await renderLoaded();
    expect(DUPLICATES_READ_ONLY_NOTE).toBe("Somente leitura: nada é fundido ou alterado automaticamente.");
    expect(screen.getByRole("note")).toHaveTextContent("Somente leitura: nada é fundido ou alterado automaticamente.");
  });

  it("cada grupo mostra o motivo, a confiança, o valor em comum (mascarado) e as contas envolvidas", async () => {
    await renderLoaded();
    const card = screen.getByRole("article", { name: /E-mail: j\*\*\*@outlook\.test/ });

    expect(within(card).getByText("E-mail", { selector: ".adm-badge" })).toBeInTheDocument();
    const confidence = within(card).getByText("Confiança alta");
    expect(confidence).toHaveAttribute("title", expect.stringContaining("idêntico depois de normalizado"));
    expect(within(card).getByText("j***@outlook.test", { selector: "code" })).toBeInTheDocument();
    expect(within(card).getByText("2 contas")).toBeInTheDocument();

    const table = within(card).getByRole("table");
    const [, julio, camila] = within(table).getAllByRole("row");
    expect(julio).toHaveTextContent("Júlio Borges Mendes");
    expect(julio).toHaveTextContent("#1031");
    expect(julio).toHaveTextContent("j***@outlook.test");
    expect(julio).toHaveTextContent("17/12/2024");
    expect(within(julio).queryByText("Conta externa")).not.toBeInTheDocument();
    // redes e campanhas, nesta ordem
    expect(within(julio).getAllByRole("cell").slice(-2).map((cell) => cell.textContent)).toEqual(["1", "6"]);

    expect(camila).toHaveTextContent("Camila Prado");
    expect(within(camila).getByText("Conta externa")).toBeInTheDocument();
    expect(within(camila).getAllByRole("cell").slice(-2).map((cell) => cell.textContent)).toEqual(["0", "2"]);
  });

  it("confiança 'possível' tem o próprio rótulo e o motivo 'Rede social'", async () => {
    await renderLoaded();
    const card = screen.getByRole("article", { name: /Rede social/ });
    expect(within(card).getByText("Rede social")).toBeInTheDocument();
    expect(within(card).getByText("Confiança possível")).toHaveAttribute("title", expect.stringContaining("parecido"));
    expect(within(card).queryByText("Confiança alta")).not.toBeInTheDocument();
  });

  it("cada motivo do contrato tem o seu nome em português", async () => {
    const groups = (["email", "phone", "document", "social_handle", "identity_conflict"] as const).map((reason, index) => ({
      ...DUPLICATE_GROUP,
      key: `${reason}:${index}`,
      reason,
      match_masked: `valor ${index}`,
    }));
    client.adminList.mockImplementation(async () => pageOf(groups));
    renderCreators("/admin/creators?tab=duplicates");
    await screen.findByRole("article", { name: /valor 4/ });
    const names = screen.getAllByRole("article").map((card) => card.getAttribute("aria-label"));
    expect(names).toEqual([
      "E-mail: valor 0",
      "Telefone: valor 1",
      "Documento: valor 2",
      "Rede social: valor 3",
      "Conflito de identidade: valor 4",
    ]);
  });
});

describe("Duplicados: somente leitura", () => {
  it("não há botão de fundir, mesclar, apagar ou editar: só leitura", async () => {
    await renderLoaded();
    const panel = screen.getByRole("tabpanel");
    expect(
      within(panel).queryByRole("button", { name: /fundir|mesclar|unir|merge|excluir|apagar|remover|editar|manter|descartar/i }),
    ).not.toBeInTheDocument();
    expect(client.adminPost).not.toHaveBeenCalled();
    expect(client.adminPatch).not.toHaveBeenCalled();
  });
});

describe("Duplicados: filtros e paginação", () => {
  it("consulta padrão: 10 por página e nenhum filtro (sem ordenação: a lista não ordena)", async () => {
    await renderLoaded();
    expect(lastParams()).toEqual({ page: 1, per_page: 10 });
  });

  it("motivo e confiança vão para a API e para a URL (a aba continua na URL)", async () => {
    const { router } = await renderLoaded();

    await userEvent.selectOptions(screen.getByLabelText("Motivo"), "phone");
    await waitFor(() => expect(lastParams()).toEqual({ page: 1, per_page: 10, reason: "phone" }));
    expect(currentSearch(router)).toEqual({ tab: "duplicates", reason: "phone" });

    await userEvent.click(screen.getByRole("button", { name: "Alta" }));
    await waitFor(() => expect(lastParams()).toEqual({ page: 1, per_page: 10, reason: "phone", confidence: "high" }));
    expect(currentSearch(router)).toEqual({ tab: "duplicates", reason: "phone", confidence: "high" });
    expect(screen.getByRole("button", { name: "Alta" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Possível" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ confidence: "possible" }));

    await userEvent.click(screen.getByRole("button", { name: "Todas" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("confidence"));
  });

  it("os motivos oferecidos são os do contrato", async () => {
    await renderLoaded();
    const select = screen.getByLabelText("Motivo") as HTMLSelectElement;
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Todos",
      "E-mail",
      "Telefone",
      "Documento",
      "Rede social",
      "Conflito de identidade",
    ]);
  });

  it("o que está na URL vale: motivo, confiança e página; valores fora do contrato saem", async () => {
    client.adminList.mockImplementation(async (_path: string, params: Record<string, unknown>) =>
      pageOf([DUPLICATE_GROUP], { page: Number(params.page), per_page: Number(params.per_page), total: 40, total_pages: 4 }),
    );
    renderCreators("/admin/creators?tab=duplicates&reason=document&confidence=possible&page=2");
    await screen.findByRole("article");
    expect(lastParams()).toEqual({ page: 2, per_page: 10, reason: "document", confidence: "possible" });
    expect(screen.getByLabelText("Motivo")).toHaveValue("document");
    expect(screen.getByRole("button", { name: "Possível" })).toHaveAttribute("aria-pressed", "true");
    cleanup();

    renderCreators("/admin/creators?tab=duplicates&reason=nome&confidence=baixa&sort_by=name");
    await screen.findByRole("article");
    expect(lastParams()).toEqual({ page: 1, per_page: 10 });
  });

  it("filtro de outra aba na URL não vaza para esta (rede, cadastro, ordenação)", async () => {
    renderCreators("/admin/creators?tab=duplicates&network=tiktok&registration=stub&sort_by=followers");
    await screen.findByRole("article", { name: /E-mail/ });
    expect(lastParams()).toEqual({ page: 1, per_page: 10 });
  });

  it("pager: 10 por página (opções 10, 25 e 50), avança de página e troca o tamanho", async () => {
    client.adminList.mockImplementation(async (_path: string, params: Record<string, unknown>) =>
      pageOf([DUPLICATE_GROUP], { page: Number(params.page), per_page: Number(params.per_page), total: 45, total_pages: Math.ceil(45 / Number(params.per_page)) }),
    );
    const { router } = await renderLoaded();
    expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("1–10 de 45");
    const size = screen.getByRole("combobox", { name: "Itens por página" });
    expect(within(size).getAllByRole("option").map((o) => o.textContent)).toEqual(["10 por página", "25 por página", "50 por página"]);

    await userEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2, per_page: 10 }));
    expect(currentSearch(router)).toEqual({ tab: "duplicates", page: 2 });

    await userEvent.selectOptions(size, "25");
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 1, per_page: 25 }));
    expect(currentSearch(router)).toEqual({ tab: "duplicates", per_page: 25 });
  });
});

describe("Duplicados: estados", () => {
  it("primeira carga: esqueleto, aviso para leitor de tela e a nota de somente leitura já à vista", async () => {
    client.adminList.mockImplementation(() => new Promise(() => {}));
    renderCreators("/admin/creators?tab=duplicates");
    expect(await screen.findByRole("status")).toHaveTextContent("Carregando…");
    expect(screen.getByRole("note")).toHaveTextContent("Somente leitura");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("erro: mostra o motivo e 'Tentar de novo' consulta outra vez; a nota continua à vista", async () => {
    client.adminList.mockRejectedValue(new AdminApiError({ status: 500, code: "SERVER_ERROR", message: "O servidor teve um problema. Tente novamente em instantes." }));
    renderCreators("/admin/creators?tab=duplicates");
    expect(await screen.findByRole("alert")).toHaveTextContent("O servidor teve um problema");
    expect(screen.getByRole("note")).toBeInTheDocument();

    client.adminList.mockImplementation(async () => pageOf([DUPLICATE_GROUP]));
    await userEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByRole("article", { name: /E-mail/ })).toBeInTheDocument();
  });

  it("o servidor ainda não tem a rota: diz isso", async () => {
    client.adminList.mockRejectedValue(new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }));
    renderCreators("/admin/creators?tab=duplicates");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Recurso indisponível");
    expect(alert).toHaveTextContent("Este recurso ainda não está disponível no servidor.");
  });

  it("nenhum duplicado: diz isso; com filtro, oferece 'Mostrar todos os grupos'", async () => {
    client.adminList.mockImplementation(async () => pageOf([]));
    const first = renderCreators("/admin/creators?tab=duplicates");
    expect(await screen.findByText("Nenhum duplicado encontrado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mostrar todos os grupos" })).not.toBeInTheDocument();
    first.unmount();

    client.adminList.mockImplementation(async (_path: string, params: Record<string, unknown>) =>
      params.reason ? pageOf([]) : pageOf([DUPLICATE_GROUP]),
    );
    const { router } = renderCreators("/admin/creators?tab=duplicates&reason=phone");
    expect(await screen.findByText("Nenhum grupo com estes filtros")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mostrar todos os grupos" }));
    expect(await screen.findByRole("article", { name: /E-mail/ })).toBeInTheDocument();
    expect(currentSearch(router)).toEqual({ tab: "duplicates" });
  });
});

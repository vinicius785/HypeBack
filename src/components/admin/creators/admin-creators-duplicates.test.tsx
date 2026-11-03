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

import { CREATORS_READ_ONLY_NOTE } from "./creator-labels";
import { DUPLICATE_GROUP, POSSIBLE_DUPLICATE_GROUP, pageOf } from "./creator-fixtures";
import { renderCreators } from "./creator-test-utils";

/** Parâmetros da última consulta à lista de duplicados. */
function lastParams(): Record<string, unknown> {
  const calls = client.adminList.mock.calls.filter(([path]) => path === "/admin/creators/duplicates");
  return calls.at(-1)?.[1] as Record<string, unknown>;
}

/** As linhas de dados da tabela (um grupo por linha), sem o cabeçalho. */
function groupRows(): HTMLElement[] {
  return within(screen.getByRole("table", { name: "Duplicados" })).getAllByRole("row").slice(1);
}

async function renderLoaded(url = "/admin/creators?tab=duplicates") {
  const view = renderCreators(url);
  await screen.findByText("Júlio Borges Mendes");
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

  it("o aviso 'Somente leitura: nada é fundido ou alterado automaticamente' está sempre à vista (no subtítulo da página, como nas outras abas)", async () => {
    await renderLoaded();
    expect(CREATORS_READ_ONLY_NOTE).toBe("Somente leitura: nada é fundido ou alterado automaticamente.");
    expect(screen.getByText(/Somente leitura: nada é fundido ou alterado automaticamente\./)).toBeInTheDocument();
  });

  it("é uma AdminTable (papéis ARIA do kit) com um grupo por linha e as colunas Grupo, Confiança e Contas", async () => {
    await renderLoaded();
    const table = screen.getByRole("table", { name: "Duplicados" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    for (const name of ["Grupo", "Confiança", "Contas"]) {
      expect(within(table).getByRole("columnheader", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    expect(groupRows()).toHaveLength(2);
    // nada de tabela feita à mão dentro do cartão: só a do kit
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("cada grupo mostra o motivo, o valor em comum (mascarado), a confiança e as contas envolvidas", async () => {
    await renderLoaded();
    const [email] = groupRows();

    expect(within(email).getByText("E-mail", { selector: ".adm-badge" })).toBeInTheDocument();
    expect(within(email).getByText("j***@outlook.test", { selector: "code" })).toBeInTheDocument();
    expect(within(email).getByText("2 contas")).toBeInTheDocument();
    expect(within(email).getByText("Alta", { selector: ".adm-badge" })).toBeInTheDocument();

    const accounts = within(email).getByRole("list", { name: /Contas do grupo E-mail: j\*\*\*@outlook\.test/ });
    const [julio, camila] = within(accounts).getAllByRole("listitem");
    expect(julio).toHaveTextContent("Júlio Borges Mendes");
    expect(julio).toHaveTextContent("#1031");
    expect(julio).toHaveTextContent("j***@outlook.test");
    expect(julio).toHaveTextContent("Cadastrado em 17/12/2024");
    expect(julio).toHaveTextContent("1 rede");
    expect(julio).not.toHaveTextContent("1 redes");
    expect(julio).toHaveTextContent("6 campanhas");
    expect(within(julio).queryByText("Conta externa")).not.toBeInTheDocument();

    expect(camila).toHaveTextContent("Camila Prado");
    expect(within(camila).getByText("Conta externa")).toBeInTheDocument();
    expect(camila).toHaveTextContent("0 redes");
    expect(camila).toHaveTextContent("2 campanhas");
  });

  it("o nome de cada conta leva ao usuário (/admin/users/:id) e é o link de texto do kit", async () => {
    await renderLoaded();
    const [email] = groupRows();
    expect(within(email).getByRole("link", { name: "Júlio Borges Mendes" })).toHaveAttribute("href", "/admin/users/1031");
    expect(within(email).getByRole("link", { name: "Camila Prado" })).toHaveAttribute("href", "/admin/users/1071");
    expect(within(email).getByRole("link", { name: "Camila Prado" })).toHaveClass("adm-textlink");
  });

  it("cada dado da conta (id, e-mail, cadastro, redes, campanhas) é um trecho próprio separado por '·', para a linha quebrar entre eles no celular", async () => {
    await renderLoaded();
    const [email] = groupRows();
    const [julio] = within(within(email).getByRole("list", { name: /Contas do grupo/ })).getAllByRole("listitem");
    const facts = [...julio.querySelectorAll("[data-fact]")];
    expect(facts.map((fact) => fact.getAttribute("data-fact"))).toEqual(["id", "email", "created", "networks", "campaigns"]);
    expect(facts.map((fact) => fact.textContent)).toEqual([
      "#1031",
      "j***@outlook.test",
      "Cadastrado em 17/12/2024",
      "1 rede",
      "6 campanhas",
    ]);
    expect(julio.querySelector("small")?.textContent).toBe(
      "#1031 · j***@outlook.test · Cadastrado em 17/12/2024 · 1 rede · 6 campanhas",
    );
  });

  it("o 'i' do cabeçalho 'Confiança' explica Alta e Possível em parágrafos do kit (nada de <p> dentro do balão)", async () => {
    await renderLoaded();
    const info = screen.getByRole("button", { name: "Como é calculado: Confiança" });
    const description = document.getElementById(info.getAttribute("aria-describedby") ?? "");
    expect(description?.querySelectorAll(".adm-info-p")).toHaveLength(2);
    expect(description?.querySelector("p")).toBeNull();
    expect(description).toHaveTextContent("Alta: o valor em comum é idêntico depois de normalizado.");
    expect(description).toHaveTextContent("Possível: valor parecido ou sinal indireto, a confirmar.");
  });

  it("a confiança fora de 'Todas' conta como filtro: vira chip e 'Limpar filtros' devolve a 'Todas'", async () => {
    const { router } = await renderLoaded();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Alta" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ confidence: "high" }));
    expect(screen.getByRole("button", { name: "Remover filtro Confiança: Alta" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("confidence"));
    expect(currentSearch(router)).toEqual({ tab: "duplicates" });
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a confiança é explicada num 'i' do cabeçalho (nunca só em dica de mouse): alta e possível", async () => {
    await renderLoaded();
    const info = screen.getByRole("button", { name: "Como é calculado: Confiança" });
    expect(info).toHaveAccessibleDescription(expect.stringContaining("idêntico depois de normalizado"));
    expect(info).toHaveAccessibleDescription(expect.stringContaining("parecido"));
    expect(screen.getByRole("button", { name: "Como é calculado: Contas" })).toHaveAccessibleDescription(
      "Conta criada por convite e nunca assumida pela pessoa.",
    );
  });

  it("confiança 'possível' tem o próprio rótulo e o motivo 'Rede social'", async () => {
    await renderLoaded();
    const social = groupRows()[1];
    expect(within(social).getByText("Rede social", { selector: ".adm-badge" })).toBeInTheDocument();
    expect(within(social).getByText("Possível", { selector: ".adm-badge" })).toBeInTheDocument();
    expect(within(social).queryByText("Alta", { selector: ".adm-badge" })).not.toBeInTheDocument();
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
    await screen.findByText("valor 4");
    const names = within(screen.getByRole("table", { name: "Duplicados" }))
      .getAllByRole("list")
      .map((list) => list.getAttribute("aria-label"));
    expect(names).toEqual([
      "Contas do grupo E-mail: valor 0",
      "Contas do grupo Telefone: valor 1",
      "Contas do grupo Documento: valor 2",
      "Contas do grupo Rede social: valor 3",
      "Contas do grupo Conflito de identidade: valor 4",
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
    // o único botão de ação é o de atualizar (refaz a leitura)
    expect(within(panel).getByRole("button", { name: "Atualizar" })).toHaveAttribute("data-icon-only", "true");
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

  it("o motivo fica na linha da barra, à vista (não escondido em 'Filtros'), e 'Filtros' nem existe nesta aba", async () => {
    await renderLoaded();
    expect(screen.getByLabelText("Motivo").closest(".adm-filters-inline")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /^Filtros/ })).not.toBeInTheDocument();
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
    await screen.findByText("Júlio Borges Mendes");
    expect(lastParams()).toEqual({ page: 2, per_page: 10, reason: "document", confidence: "possible" });
    expect(screen.getByLabelText("Motivo")).toHaveValue("document");
    expect(screen.getByRole("button", { name: "Possível" })).toHaveAttribute("aria-pressed", "true");
    cleanup();

    renderCreators("/admin/creators?tab=duplicates&reason=nome&confidence=baixa&sort_by=name");
    await screen.findByText("Júlio Borges Mendes");
    expect(lastParams()).toEqual({ page: 1, per_page: 10 });
  });

  it("filtro de outra aba na URL não vaza para esta (rede, cadastro, ordenação)", async () => {
    renderCreators("/admin/creators?tab=duplicates&network=tiktok&registration=stub&sort_by=followers");
    await screen.findByText("Júlio Borges Mendes");
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
  it("primeira carga: esqueleto, aviso para leitor de tela e o aviso de somente leitura já à vista; sem paginador", async () => {
    client.adminList.mockImplementation(() => new Promise(() => {}));
    const { container } = renderCreators("/admin/creators?tab=duplicates");
    expect(await screen.findByText("Carregando…")).toBeInTheDocument();
    expect(screen.getByText(/Somente leitura/)).toBeInTheDocument();
    expect(container.querySelectorAll(".adm-row .adm-sk").length).toBeGreaterThan(0);
    expect(screen.queryByText("Júlio Borges Mendes")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Paginação" })).not.toBeInTheDocument();
  });

  it("erro: mostra o motivo e 'Tentar de novo' consulta outra vez; o aviso continua à vista", async () => {
    client.adminList.mockRejectedValue(new AdminApiError({ status: 500, code: "SERVER_ERROR", message: "O servidor teve um problema. Tente novamente em instantes." }));
    renderCreators("/admin/creators?tab=duplicates");
    expect(await screen.findByRole("alert")).toHaveTextContent("O servidor teve um problema");
    expect(screen.getByText(/Somente leitura/)).toBeInTheDocument();

    client.adminList.mockImplementation(async () => pageOf([DUPLICATE_GROUP]));
    await userEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByText("Júlio Borges Mendes")).toBeInTheDocument();
  });

  it("o servidor ainda não tem a rota: diz isso", async () => {
    client.adminList.mockRejectedValue(new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }));
    renderCreators("/admin/creators?tab=duplicates");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Recurso indisponível");
    expect(alert).toHaveTextContent("Este recurso ainda não está disponível no servidor.");
  });

  it("nenhum duplicado: diz isso; com filtro, oferece 'Limpar filtros'", async () => {
    client.adminList.mockImplementation(async () => pageOf([]));
    const first = renderCreators("/admin/creators?tab=duplicates");
    expect(await screen.findByText("Nenhum duplicado encontrado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    first.unmount();

    client.adminList.mockImplementation(async (_path: string, params: Record<string, unknown>) =>
      params.reason ? pageOf([]) : pageOf([DUPLICATE_GROUP]),
    );
    const { router } = renderCreators("/admin/creators?tab=duplicates&reason=phone");
    expect(await screen.findByText("Nenhum grupo com estes filtros")).toBeInTheDocument();
    // a barra tem o seu "Limpar filtros" e o estado vazio, o dele: os dois fazem o mesmo
    expect(screen.getAllByRole("button", { name: "Limpar filtros" })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" }).at(-1)!);
    expect(await screen.findByText("Júlio Borges Mendes")).toBeInTheDocument();
    expect(currentSearch(router)).toEqual({ tab: "duplicates" });
  });
});

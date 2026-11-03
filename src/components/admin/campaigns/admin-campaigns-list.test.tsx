import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  adminList: vi.fn(),
  adminGet: vi.fn(),
  adminPost: vi.fn(),
  adminPatch: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return {
    ...actual,
    adminList: client.adminList,
    adminGet: client.adminGet,
    adminPost: client.adminPost,
    adminPatch: client.adminPatch,
  };
});

import { AdminApiError } from "@/lib/admin/admin-client";
import { validateAdminCampaignsSearch } from "@/hooks/admin/use-admin-campaigns";
import { currentSearch, renderAdminRoute, stubRoute } from "@/test/render-admin-route";

import { AdminCampaignsList } from "./admin-campaigns-list";
import {
  CAMPAIGN_DEFINITIONS,
  SECOND_CAMPAIGN,
  makeCampaign,
  pageOf,
} from "./campaign-fixtures";

// O seletor de workspace é o de verdade (ele tem testes próprios): a busca dele e a consulta do nome pelo id passam pelo cliente simulado.
const WS_CAFE = "7a1e0000-0000-4000-8000-000000000002";
const WS_AURORA = "7a1e0000-0000-4000-8000-000000000004";
const WORKSPACES = [
  { id: WS_CAFE, name: "Café Serra Verde", status: "active", owner: null },
  { id: WS_AURORA, name: "Aurora Beauty Studio", status: "suspended", owner: null },
] as never[];
const workspaceName = (id: string) => (WORKSPACES as { id: string; name: string }[]).find((w) => w.id === id)?.name;

const ROUTES = [
  { path: "/admin/campaigns", component: AdminCampaignsList, validateSearch: validateAdminCampaignsSearch },
  stubRoute("/admin/campaigns/$campaignId"),
  stubRoute("/admin/workspaces/$workspaceId"),
];

function renderList(url = "/admin/campaigns") {
  return renderAdminRoute(ROUTES, url);
}

/** Monta a lista e espera a primeira linha (antes disso a tabela é só o esqueleto). */
async function renderLoaded(url = "/admin/campaigns") {
  const view = renderList(url);
  await screen.findByText("Festival Café Serra Verde");
  return view;
}

/** Parâmetros da última consulta à lista de campanhas. */
function lastParams(): Record<string, unknown> {
  const calls = client.adminList.mock.calls.filter(([path]) => path === "/admin/campaigns");
  return calls.at(-1)?.[1] as Record<string, unknown>;
}

const FIRST_CAMPAIGN = makeCampaign();

/** A resposta da lista de campanhas; a busca de workspaces do seletor é respondida à parte. */
function serve(campaigns: (params: Record<string, unknown>) => unknown) {
  client.adminList.mockImplementation(async (path: string, params: Record<string, unknown>) =>
    path === "/admin/workspaces" ? pageOf(WORKSPACES) : campaigns(params),
  );
}

beforeEach(() => {
  client.adminList.mockReset();
  client.adminGet.mockReset();
  client.adminPost.mockReset();
  client.adminPatch.mockReset();
  serve(() => ({
    ...pageOf([FIRST_CAMPAIGN, SECOND_CAMPAIGN]),
    meta: { ...pageOf([]).meta, total: 2, total_pages: 1, definitions: CAMPAIGN_DEFINITIONS },
  }));
  client.adminGet.mockImplementation(async (path: string) => {
    const id = path.replace("/admin/workspaces/", "");
    return { id, name: workspaceName(id) ?? "Outro workspace" };
  });
});

afterEach(() => {
  cleanup();
});

describe("Lista de campanhas: dados", () => {
  it("mostra título, pagamento, workspace, responsável, status e números, com dinheiro exato", async () => {
    await renderLoaded();
    const table = screen.getByRole("table", { name: "Campanhas" });
    const [, first, second] = within(table).getAllByRole("row");

    expect(within(first).getByText("Festival Café Serra Verde")).toBeInTheDocument();
    expect(within(first).getByText("Valor fixo por conteúdo")).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "Café Serra Verde" })).toHaveAttribute(
      "href",
      "/admin/workspaces/7a1e0000-0000-4000-8000-000000000002",
    );
    // só o nome do responsável: "Proprietário:" não se repete em toda linha (a coluna explica, uma vez)
    expect(within(first).getByText("Ana Santana")).toBeInTheDocument();
    expect(within(first).queryByText(/Proprietário/)).not.toBeInTheDocument();
    expect(within(first).getByText("Publicada")).toBeInTheDocument();
    expect(within(first).getByText("8")).toBeInTheDocument(); // em andamento
    expect(within(first).getByText("/ 12")).toBeInTheDocument(); // total de participações
    // entregas: publicadas e pendentes na mesma coluna, cada número com a sua palavra
    expect(first).toHaveTextContent("3 publicadas");
    expect(first).toHaveTextContent("2 pendentes");
    expect(within(first).getByText("R$ 65.000,12")).toBeInTheDocument();
    expect(within(first).getByText("R$ 1.200,50")).toBeInTheDocument();
    expect(within(first).getByText("12/10/2026")).toBeInTheDocument();

    expect(within(second).getByText("Permuta")).toBeInTheDocument();
    expect(within(second).getByText("Finalizada")).toBeInTheDocument();
  });

  it("a linha inteira abre o detalhe da campanha (link de verdade)", async () => {
    await renderLoaded();
    const table = screen.getByRole("table", { name: "Campanhas" });
    const links = within(table)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(links).toContain("/admin/campaigns/ca3b0000-0000-4000-8000-000000000006");
    expect(links).toContain("/admin/campaigns/ca3b0000-0000-4000-8000-000000000003");
  });

  it("o nome do workspace é o link de texto do kit (`adm-textlink`) e leva ao workspace", async () => {
    await renderLoaded();
    const link = within(screen.getByRole("table", { name: "Campanhas" })).getByRole("link", { name: "Café Serra Verde" });
    expect(link).toHaveClass("adm-textlink");
    expect(link).toHaveAttribute("href", "/admin/workspaces/7a1e0000-0000-4000-8000-000000000002");
  });

  it("as definições das colunas usam os parágrafos do kit (um <p> dentro do balão do 'i' quebraria o HTML)", async () => {
    await renderLoaded();
    const info = screen.getByRole("button", { name: "Como é calculado: Entregas" });
    const description = document.getElementById(info.getAttribute("aria-describedby") ?? "");
    expect(description?.querySelectorAll(".adm-info-p")).toHaveLength(2);
    expect(description?.querySelector("p")).toBeNull();
  });

  it("'Criada em' é a última coluna e o '↓' da ordenação padrão (criação) continua nela", async () => {
    await renderLoaded();
    const table = screen.getByRole("table", { name: "Campanhas" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.at(-1)).toHaveTextContent("Criada em");
    expect(headers.at(-1)).toHaveAttribute("aria-sort", "descending");
  });

  it("workspace que não está ativo leva a etiqueta do estado; sem proprietário diz isso", async () => {
    await renderLoaded();
    const table = screen.getByRole("table", { name: "Campanhas" });
    const [, first, second] = within(table).getAllByRole("row");
    expect(within(second).getByText("Suspenso")).toBeInTheDocument();
    expect(within(second).getByText("Workspace sem proprietário")).toBeInTheDocument();
    // workspace ativo: sem etiqueta
    expect(within(first).queryByText("Ativo")).not.toBeInTheDocument();
    expect(within(first).queryByText("Suspenso")).not.toBeInTheDocument();
  });

  it("o responsável é o do workspace, e a coluna explica isso uma vez (a campanha não tem dono)", async () => {
    await renderLoaded();
    const info = screen.getByRole("button", { name: "Como é calculado: Workspace" });
    expect(info).toHaveAccessibleDescription(expect.stringContaining("responsável dele, que é o proprietário do workspace"));
    expect(info).toHaveAccessibleDescription(expect.stringContaining(CAMPAIGN_DEFINITIONS.workspace_owner));
  });

  it("Orçamento não aparece: a API devolve sempre 'não apurado', então a lista não tem coluna que só diria isso", async () => {
    await renderLoaded();
    expect(screen.queryByRole("columnheader", { name: /Orçamento/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Como é calculado: Orçamento" })).not.toBeInTheDocument();
    expect(screen.queryByText("Não apurado")).not.toBeInTheDocument();
  });

  it("não há mais colunas separadas de 'Entregas publicadas' e 'Pendências': é uma só, 'Entregas'", async () => {
    await renderLoaded();
    expect(screen.getByRole("columnheader", { name: /^Entregas/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Pendências/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Entregas publicadas/ })).not.toBeInTheDocument();
  });

  it("pendência acima de zero ganha destaque; zero fica apagado (e singular com 1)", async () => {
    serve(() =>
      pageOf([
        makeCampaign({ deliveries_published: 1, pending_actions: 1 }),
        makeCampaign({ id: "ca3b0000-0000-4000-8000-000000000009", title: "Sem pendência", deliveries_published: 0, pending_actions: 0 }),
      ]),
    );
    await renderLoaded();
    const [, withPending, none] = within(screen.getByRole("table", { name: "Campanhas" })).getAllByRole("row");
    expect(withPending).toHaveTextContent("1 publicada");
    expect(withPending).toHaveTextContent("1 pendente");
    expect(withPending.querySelector("[data-pending='true']")).not.toBeNull();
    expect(none).toHaveTextContent("0 publicadas");
    expect(none).toHaveTextContent("0 pendentes");
    expect(none.querySelector("[data-pending='true']")).toBeNull();
  });

  it("cada coluna derivada tem o seu 'como é calculado' (do servidor, ou o do contrato quando ele não manda)", async () => {
    await renderLoaded();
    const creators = screen.getByRole("button", { name: "Como é calculado: Criadores" });
    // a legenda do "x / y" e a regra do servidor
    expect(creators).toHaveAccessibleDescription(expect.stringContaining("em andamento / total"));
    expect(creators).toHaveAccessibleDescription(expect.stringContaining(CAMPAIGN_DEFINITIONS.participants));
    // entregas: o que é publicada e o que é pendência, no mesmo "i"
    const deliveries = screen.getByRole("button", { name: "Como é calculado: Entregas" });
    expect(deliveries).toHaveAccessibleDescription(expect.stringContaining(CAMPAIGN_DEFINITIONS.deliveries_published));
    expect(deliveries).toHaveAccessibleDescription(expect.stringContaining(CAMPAIGN_DEFINITIONS.pending_actions));
    // comprometido: a regra + o que "comprometido" significa
    const committed = screen.getByRole("button", { name: "Como é calculado: Comprometido" });
    expect(committed).toHaveAccessibleDescription(expect.stringContaining(CAMPAIGN_DEFINITIONS.committed_cents));
    expect(committed).toHaveAccessibleDescription(expect.stringContaining("ainda não é pagamento"));
  });

  it("sem `meta.definitions` do servidor, usa os textos do contrato", async () => {
    serve(() => pageOf([FIRST_CAMPAIGN]));
    await renderLoaded();
    expect(screen.getByRole("button", { name: "Como é calculado: Workspace" })).toHaveAccessibleDescription(
      expect.stringContaining("proprietário do workspace"),
    );
    expect(screen.getByRole("button", { name: "Como é calculado: Liberado" })).toHaveAccessibleDescription(
      expect.stringContaining("Não é"),
    );
  });

  it("a coluna Liberado diz que liberado não é 'pago via PIX'", async () => {
    await renderLoaded();
    expect(screen.getByRole("button", { name: "Como é calculado: Liberado" })).toHaveAccessibleDescription(
      expect.stringContaining("pago via PIX"),
    );
  });

  it("zero é apagado (nada a fazer), mas continua sendo 0: não vira traço nem 'Não apurado'", async () => {
    await renderLoaded();
    const table = screen.getByRole("table", { name: "Campanhas" });
    const second = within(table).getAllByRole("row")[2];
    expect(within(second).getAllByText("R$ 0,00")).toHaveLength(2); // comprometido e liberado
    expect(second).toHaveTextContent("0 publicadas"); // entregas
    expect(second).toHaveTextContent("0 pendentes");
  });
});

describe("Lista de campanhas: estados", () => {
  it("primeira carga: esqueleto e aviso para leitor de tela, sem linhas", async () => {
    client.adminList.mockImplementation(() => new Promise(() => {}));
    const { container } = renderList();
    expect(await screen.findByText("Carregando…")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Campanhas" })).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll(".adm-row .adm-sk").length).toBeGreaterThan(0);
    expect(screen.queryByText("Festival Café Serra Verde")).not.toBeInTheDocument();
  });

  it("erro: mostra o motivo e 'Tentar de novo' consulta outra vez", async () => {
    client.adminList.mockRejectedValue(new AdminApiError({ status: 500, code: "SERVER_ERROR", message: "O servidor teve um problema. Tente novamente em instantes." }));
    renderList();
    expect(await screen.findByRole("alert")).toHaveTextContent("O servidor teve um problema");

    serve(() => pageOf([FIRST_CAMPAIGN]));
    await userEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByText("Festival Café Serra Verde")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("o servidor ainda não tem a rota: diz isso e não repete a consulta à toa", async () => {
    client.adminList.mockRejectedValue(
      new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }),
    );
    renderList();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Recurso indisponível");
    expect(alert).toHaveTextContent("Este recurso ainda não está disponível no servidor.");
    expect(client.adminList).toHaveBeenCalledTimes(1);
  });

  it("sem campanhas e sem filtro: vazio simples, sem 'Limpar'", async () => {
    serve(() => pageOf([]));
    renderList();
    expect(await screen.findByText("Nenhuma campanha ainda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Limpar busca e filtros/ })).not.toBeInTheDocument();
  });

  it("sem resultado com filtro: explica e 'Limpar busca e filtros' volta a tudo", async () => {
    serve((params) =>
      params.status === "draft" || params.search ? pageOf([]) : pageOf([FIRST_CAMPAIGN]),
    );
    const { router } = renderList("/admin/campaigns?status=draft&search=zzz");
    expect(await screen.findByText("Nenhuma campanha encontrada")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Limpar busca e filtros" }));
    expect(await screen.findByText("Festival Café Serra Verde")).toBeInTheDocument();
    expect(currentSearch(router)).toEqual({});
    expect(lastParams()).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" });
  });
});

describe("Lista de campanhas: URL ⇄ filtros ⇄ API", () => {
  it("abre com a consulta padrão: 25 por página, criação decrescente, nenhum filtro", async () => {
    await renderLoaded();
    expect(lastParams()).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" });
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("tudo o que está na URL vai para a API, e os controles mostram o que está valendo", async () => {
    const wsId = WS_CAFE;
    // há mais de uma página: a página 2 existe e não é recolhida para a última
    serve((params) =>
      pageOf([FIRST_CAMPAIGN], { page: Number(params.page), per_page: Number(params.per_page), total: 300, total_pages: 6 }),
    );
    await renderLoaded(
      `/admin/campaigns?status=draft&payment_method=cpm&workspace_id=${wsId}&created_from=2026-10-01&created_to=2026-10-31&search=caf%C3%A9&page=2&per_page=50&sort_by=title&order=asc`,
    );

    expect(lastParams()).toEqual({
      page: 2,
      per_page: 50,
      search: "café",
      sort_by: "title",
      order: "asc",
      status: "draft",
      payment_method: "cpm",
      workspace_id: wsId,
      created_from: "2026-10-01",
      created_to: "2026-10-31",
    });
    expect(screen.getByRole("button", { name: "Rascunho" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("searchbox", { name: "Buscar campanhas" })).toHaveValue("café");
    expect(screen.getByLabelText("Pagamento")).toHaveValue("cpm");
    expect(screen.getByLabelText("Criada em: a partir de")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Criada em: até")).toHaveValue("2026-10-31");
    // o workspace da URL vira o nome (a pílula e o chip); o nome vem do detalhe do workspace, buscado uma vez
    await waitFor(() => expect(screen.getByRole("button", { name: /^Workspace:/ })).toHaveTextContent("Café Serra Verde"));
    expect(screen.getByRole("button", { name: "Remover filtro Workspace: Café Serra Verde" })).toBeInTheDocument();
    expect(client.adminGet).toHaveBeenCalledWith(`/admin/workspaces/${wsId}`, undefined, expect.anything());
    const header = screen.getByRole("columnheader", { name: /Campanha/ });
    expect(header).toHaveAttribute("aria-sort", "ascending");
  });

  it("valores inválidos na URL são ignorados: nada de filtro escondido nem consulta recusada", async () => {
    await renderLoaded("/admin/campaigns?status=archived&workspace_id=xx&created_from=2026-02-31&sort_by=budget");
    expect(lastParams()).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" });
  });

  it("um código de pagamento que o app não conhece, vindo da URL, aparece no filtro (a pílula não mente)", async () => {
    await renderLoaded("/admin/campaigns?payment_method=to_be_agreed");
    const select = screen.getByLabelText("Pagamento") as HTMLSelectElement;
    expect(select.value).toBe("to_be_agreed");
    expect(within(select).getByRole("option", { name: "to_be_agreed" })).toBeInTheDocument();
    expect(lastParams()).toMatchObject({ payment_method: "to_be_agreed" });
  });

  it("status segmentado: troca na URL, volta para a página 1 e consulta com o status", async () => {
    const { router } = await renderLoaded("/admin/campaigns?page=3");

    await userEvent.click(screen.getByRole("button", { name: "Publicadas" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ status: "published", page: 1 }));
    expect(currentSearch(router)).toEqual({ status: "published" });
    expect(screen.getByRole("button", { name: "Publicadas" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Todas" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("status"));
    expect(currentSearch(router)).toEqual({});
  });

  it("o status fora de 'Todas' conta como filtro: vira chip e 'Limpar filtros' devolve a 'Todas'", async () => {
    const { router } = await renderLoaded();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Finalizadas" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ status: "finished" }));
    expect(screen.getByRole("button", { name: "Remover filtro Status da campanha: Finalizadas" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("status"));
    expect(currentSearch(router)).toEqual({});
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("busca: Enter busca na hora e a busca vai para a API e para a URL", async () => {
    const { router } = await renderLoaded();

    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar campanhas" }), "serra verde{Enter}");
    await waitFor(() => expect(lastParams()).toMatchObject({ search: "serra verde", page: 1 }));
    expect(currentSearch(router)).toEqual({ search: "serra verde" });
  });

  it("modalidade de pagamento: o filtro é enviado", async () => {
    const { router } = await renderLoaded();

    await userEvent.selectOptions(screen.getByLabelText("Pagamento"), "swap");
    await waitFor(() => expect(lastParams()).toMatchObject({ payment_method: "swap" }));
    expect(currentSearch(router)).toEqual({ payment_method: "swap" });
    // chip do filtro ativo, que também o desfaz
    await userEvent.click(screen.getByRole("button", { name: /Remover filtro Pagamento: Permuta/ }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("payment_method"));
  });

  it("período de criação: as duas datas vão para a API (dias de São Paulo, YYYY-MM-DD)", async () => {
    const { router } = await renderLoaded();

    fireEvent.change(screen.getByLabelText("Criada em: a partir de"), { target: { value: "2026-10-01" } });
    await waitFor(() => expect(lastParams()).toMatchObject({ created_from: "2026-10-01" }));
    fireEvent.change(screen.getByLabelText("Criada em: até"), { target: { value: "2026-10-31" } });
    await waitFor(() => expect(lastParams()).toMatchObject({ created_from: "2026-10-01", created_to: "2026-10-31" }));
    expect(currentSearch(router)).toEqual({ created_from: "2026-10-01", created_to: "2026-10-31" });
  });

  it("workspace: o seletor é um filtro da barra (conta, vira chip) e liga `workspace_id` à URL e à consulta", async () => {
    const { router } = await renderLoaded();
    // sem filtro nenhum: nada de "Filtros (n)" nem chip
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Workspace:/ }));
    await userEvent.click(await screen.findByRole("option", { name: /Café Serra Verde/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ workspace_id: WS_CAFE, page: 1 }));
    expect(currentSearch(router)).toEqual({ workspace_id: WS_CAFE });
    expect(screen.getByRole("button", { name: /^Workspace:/ })).toHaveTextContent("Café Serra Verde");
    // o nome acabou de ser escolhido: o chip o usa sem consultar o detalhe do workspace
    expect(screen.getByRole("button", { name: "Remover filtro Workspace: Café Serra Verde" })).toBeInTheDocument();
    expect(client.adminGet).not.toHaveBeenCalled();
    // a busca do seletor só traz clientes
    expect(client.adminList).toHaveBeenCalledWith("/admin/workspaces", expect.objectContaining({ kind: "brand" }), expect.anything());
  });

  it("workspace: o × do chip tira só o workspace; a opção 'Todos' do seletor também", async () => {
    const { router } = await renderLoaded(`/admin/campaigns?workspace_id=${WS_CAFE}&payment_method=cpa`);
    await userEvent.click(await screen.findByRole("button", { name: "Remover filtro Workspace: Café Serra Verde" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("workspace_id"));
    expect(lastParams()).toMatchObject({ payment_method: "cpa" });
    expect(currentSearch(router)).toEqual({ payment_method: "cpa" });

    cleanup();
    const second = await renderLoaded(`/admin/campaigns?workspace_id=${WS_AURORA}`);
    await userEvent.click(screen.getByRole("button", { name: /^Workspace:/ }));
    await userEvent.click(within(await screen.findByRole("listbox")).getByRole("option", { name: "Todos" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("workspace_id"));
    expect(currentSearch(second.router)).toEqual({});
  });

  it("'Limpar filtros' desfaz os filtros (inclusive o workspace), mas mantém a busca digitada", async () => {
    const { router } = await renderLoaded(`/admin/campaigns?payment_method=cpa&search=loja&status=draft&workspace_id=${WS_CAFE}`);
    await screen.findByRole("button", { name: "Remover filtro Workspace: Café Serra Verde" });

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("payment_method"));
    expect(lastParams()).toMatchObject({ search: "loja" });
    expect(lastParams()).not.toHaveProperty("status");
    expect(lastParams()).not.toHaveProperty("workspace_id");
    // um reset só: a URL termina com a busca e mais nada
    await waitFor(() => expect(currentSearch(router)).toEqual({ search: "loja" }));
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();
  });

  it("'Atualizar' é um ícone no fim da barra e refaz a consulta (não está no cabeçalho)", async () => {
    await renderLoaded();
    const refresh = screen.getByRole("button", { name: "Atualizar" });
    expect(within(screen.getByRole("banner")).queryByRole("button", { name: "Atualizar" })).not.toBeInTheDocument();
    expect(refresh).toHaveAttribute("data-icon-only", "true");
    const before = client.adminList.mock.calls.filter(([path]) => path === "/admin/campaigns").length;
    await userEvent.click(refresh);
    await waitFor(() => expect(client.adminList.mock.calls.filter(([path]) => path === "/admin/campaigns").length).toBe(before + 1));
  });
});

describe("Lista de campanhas: ordenação e paginação", () => {
  it("clicar no cabeçalho ordena pela chave do contrato: números e datas começam do maior; título do A ao Z", async () => {
    const { router } = await renderLoaded();

    await userEvent.click(screen.getByRole("button", { name: /^Comprometido/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "committed", order: "desc" }));
    expect(currentSearch(router)).toEqual({ sort_by: "committed" });

    await userEvent.click(screen.getByRole("button", { name: /^Comprometido/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "committed", order: "asc" }));
    expect(currentSearch(router)).toEqual({ sort_by: "committed", order: "asc" });

    await userEvent.click(screen.getByRole("button", { name: /^Campanha/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "title", order: "asc" }));

    await userEvent.click(screen.getByRole("button", { name: /^Criadores/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "creators", order: "desc" }));
    await userEvent.click(screen.getByRole("button", { name: /^Liberado/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "released", order: "desc" }));
    await userEvent.click(screen.getByRole("button", { name: /^Criada em/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "created_at", order: "desc" }));
  });

  it("só as colunas do contrato ordenam (Entregas, Workspace e Status não são botões)", async () => {
    await renderLoaded();
    for (const name of ["Entregas", "Workspace", "Status"]) {
      // ("Workspace:" também é o seletor da barra: só o cabeçalho da coluna interessa)
      const header = screen.getByRole("columnheader", { name: new RegExp(`^${name}`) });
      expect(within(header).queryByRole("button", { name: new RegExp(`^${name}`) })).not.toBeInTheDocument();
    }
  });

  it("pager: avança e volta de página (na URL e na consulta) e mostra 'X–Y de Z'", async () => {
    serve((params) => ({
      ...pageOf([FIRST_CAMPAIGN], { page: Number(params.page), per_page: Number(params.per_page), total: 60, total_pages: 3 }),
    }));
    const { router } = await renderLoaded();
    expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("1–25 de 60");

    await userEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));
    expect(currentSearch(router)).toEqual({ page: 2 });
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("26–50 de 60"));

    await userEvent.click(screen.getByRole("button", { name: "Página anterior" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 1 }));
    expect(currentSearch(router)).toEqual({});
  });

  it("itens por página: troca o tamanho e volta para a primeira página", async () => {
    serve((params) =>
      pageOf([FIRST_CAMPAIGN], { page: Number(params.page), per_page: Number(params.per_page), total: 120, total_pages: Math.ceil(120 / Number(params.per_page)) }),
    );
    const { router } = await renderLoaded("/admin/campaigns?page=2");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Itens por página" }), "50");
    await waitFor(() => expect(lastParams()).toMatchObject({ per_page: 50, page: 1 }));
    expect(currentSearch(router)).toEqual({ per_page: 50 });
  });

  it("página além do fim (o filtro encolheu a lista): volta para a última que existe", async () => {
    serve((params) =>
      Number(params.page) > 2
        ? pageOf([FIRST_CAMPAIGN], { page: 9, total: 30, total_pages: 2 })
        : pageOf([FIRST_CAMPAIGN], { page: Number(params.page), total: 30, total_pages: 2 }),
    );
    const { router } = renderList("/admin/campaigns?page=9");
    await waitFor(() => expect(currentSearch(router)).toEqual({ page: 2 }));
  });
});

describe("Lista de campanhas: somente leitura", () => {
  it("só lê: nenhuma escrita é chamada ao usar a lista, e não há botão que altere campanha", async () => {
    await renderLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Publicadas" }));
    await userEvent.selectOptions(screen.getByLabelText("Pagamento"), "fixed");
    await waitFor(() => expect(lastParams()).toMatchObject({ payment_method: "fixed", status: "published" }));

    expect(client.adminPost).not.toHaveBeenCalled();
    expect(client.adminPatch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /publicar|despublicar|excluir|editar|arquivar|suspender/i })).not.toBeInTheDocument();
  });
});

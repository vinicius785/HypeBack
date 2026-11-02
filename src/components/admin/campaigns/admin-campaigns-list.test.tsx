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

// O seletor de workspace é de outra tela (e tem testes próprios): aqui só importa como a lista o liga à URL.
const PICKED = { id: "7a1e0000-0000-4000-8000-000000000002", name: "Café Serra Verde" };
vi.mock("@/components/admin/users/admin-workspace-picker", () => ({
  AdminWorkspacePicker: ({
    value,
    onChange,
  }: {
    value?: string | null;
    onChange: (workspace: { id: string; name: string } | null) => void;
  }) => (
    <div data-testid="workspace-picker" data-value={value ?? ""}>
      <button type="button" onClick={() => onChange(PICKED)}>
        Escolher workspace
      </button>
      <button type="button" onClick={() => onChange(null)}>
        Limpar workspace
      </button>
    </div>
  ),
}));

import { AdminApiError } from "@/lib/admin/admin-client";
import { validateAdminCampaignsSearch } from "@/hooks/admin/use-admin-campaigns";
import { currentSearch, renderAdminRoute, stubRoute } from "@/test/render-admin-route";

import { AdminCampaignsList } from "./admin-campaigns-list";
import {
  BUDGET_DEFINITION,
  CAMPAIGN_DEFINITIONS,
  SECOND_CAMPAIGN,
  makeCampaign,
  pageOf,
} from "./campaign-fixtures";

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

beforeEach(() => {
  client.adminList.mockReset();
  client.adminGet.mockReset();
  client.adminPost.mockReset();
  client.adminPatch.mockReset();
  client.adminList.mockImplementation(async () => ({
    ...pageOf([FIRST_CAMPAIGN, SECOND_CAMPAIGN]),
    meta: { ...pageOf([]).meta, total: 2, total_pages: 1, definitions: CAMPAIGN_DEFINITIONS },
  }));
});

afterEach(() => {
  cleanup();
});

describe("Lista de campanhas: dados", () => {
  it("mostra título, pagamento, workspace, proprietário, status e números, com dinheiro exato", async () => {
    await renderLoaded();
    const table = screen.getByRole("table", { name: "Campanhas" });
    const [, first, second] = within(table).getAllByRole("row");

    expect(within(first).getByText("Festival Café Serra Verde")).toBeInTheDocument();
    expect(within(first).getByText("Valor fixo por conteúdo")).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "Café Serra Verde" })).toHaveAttribute(
      "href",
      "/admin/workspaces/7a1e0000-0000-4000-8000-000000000002",
    );
    expect(within(first).getByText("Proprietário: Ana Santana")).toBeInTheDocument();
    expect(within(first).getByText("Publicada")).toBeInTheDocument();
    expect(within(first).getByText("8")).toBeInTheDocument(); // em andamento
    expect(within(first).getByText("/ 12")).toBeInTheDocument(); // total de participações
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

  it("o responsável é o proprietário do workspace, e a coluna explica isso (a campanha não tem dono)", async () => {
    await renderLoaded();
    const info = screen.getByRole("button", { name: "Como é calculado: Workspace" });
    expect(info).toHaveAccessibleDescription(CAMPAIGN_DEFINITIONS.workspace_owner);
  });

  it("Orçamento: 'Não apurado' (nunca 0), com a definição de que o banco não guarda orçamento", async () => {
    await renderLoaded();
    const table = screen.getByRole("table", { name: "Campanhas" });
    const rows = within(table).getAllByRole("row").slice(1);
    for (const row of rows) {
      expect(within(row).getByText("Não apurado")).toBeInTheDocument();
    }
    expect(within(table).queryByText("R$ 0,00", { selector: "[title*='orçamento']" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Como é calculado: Orçamento" })).toHaveAccessibleDescription(BUDGET_DEFINITION);
  });

  it("cada coluna derivada tem o seu 'como é calculado' (do servidor, ou o do contrato quando ele não manda)", async () => {
    await renderLoaded();
    expect(screen.getByRole("button", { name: "Como é calculado: Criadores" })).toHaveAccessibleDescription(CAMPAIGN_DEFINITIONS.participants);
    expect(screen.getByRole("button", { name: "Como é calculado: Pendências" })).toHaveAccessibleDescription(CAMPAIGN_DEFINITIONS.pending_actions);
    // comprometido: a regra + o que "comprometido" significa
    const committed = screen.getByRole("button", { name: "Como é calculado: Comprometido" });
    expect(committed).toHaveAccessibleDescription(expect.stringContaining(CAMPAIGN_DEFINITIONS.committed_cents));
    expect(committed).toHaveAccessibleDescription(expect.stringContaining("ainda não é pagamento"));
  });

  it("sem `meta.definitions` do servidor, usa os textos do contrato", async () => {
    client.adminList.mockImplementation(async () => pageOf([FIRST_CAMPAIGN]));
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
    expect(within(second).getAllByText("0").length).toBeGreaterThanOrEqual(2); // entregas e pendências
  });
});

describe("Lista de campanhas: estados", () => {
  it("primeira carga: esqueleto e aviso para leitor de tela, sem linhas", async () => {
    client.adminList.mockImplementation(() => new Promise(() => {}));
    const { container } = renderList();
    expect(await screen.findByRole("status")).toHaveTextContent("Carregando…");
    expect(screen.getByRole("table", { name: "Campanhas" })).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll(".adm-row .adm-sk").length).toBeGreaterThan(0);
    expect(screen.queryByText("Festival Café Serra Verde")).not.toBeInTheDocument();
  });

  it("erro: mostra o motivo e 'Tentar de novo' consulta outra vez", async () => {
    client.adminList.mockRejectedValue(new AdminApiError({ status: 500, code: "SERVER_ERROR", message: "O servidor teve um problema. Tente novamente em instantes." }));
    renderList();
    expect(await screen.findByRole("alert")).toHaveTextContent("O servidor teve um problema");

    client.adminList.mockImplementation(async () => pageOf([FIRST_CAMPAIGN]));
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
    client.adminList.mockImplementation(async () => pageOf([]));
    renderList();
    expect(await screen.findByText("Nenhuma campanha ainda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Limpar busca e filtros/ })).not.toBeInTheDocument();
  });

  it("sem resultado com filtro: explica e 'Limpar busca e filtros' volta a tudo", async () => {
    client.adminList.mockImplementation(async (_path: string, params: Record<string, unknown>) =>
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
    const wsId = PICKED.id;
    // há mais de uma página: a página 2 existe e não é recolhida para a última
    client.adminList.mockImplementation(async (_path: string, params: Record<string, unknown>) =>
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
    expect(screen.getByRole("searchbox", { name: "Buscar campanhas por título ou workspace" })).toHaveValue("café");
    expect(screen.getByLabelText("Pagamento")).toHaveValue("cpm");
    expect(screen.getByLabelText("Criada em: a partir de")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Criada em: até")).toHaveValue("2026-10-31");
    expect(screen.getByTestId("workspace-picker")).toHaveAttribute("data-value", wsId);
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

  it("busca: Enter busca na hora e a busca vai para a API e para a URL", async () => {
    const { router } = await renderLoaded();

    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar campanhas por título ou workspace" }), "serra verde{Enter}");
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

  it("workspace: o seletor liga `workspace_id` à URL e à consulta, e limpar tira o filtro", async () => {
    const { router } = await renderLoaded();

    await userEvent.click(screen.getByRole("button", { name: "Escolher workspace" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ workspace_id: PICKED.id }));
    expect(currentSearch(router)).toEqual({ workspace_id: PICKED.id });
    expect(screen.getByTestId("workspace-picker")).toHaveAttribute("data-value", PICKED.id);

    await userEvent.click(screen.getByRole("button", { name: "Limpar workspace" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("workspace_id"));
    expect(currentSearch(router)).toEqual({});
  });

  it("'Limpar filtros' desfaz os filtros, mas mantém a busca digitada", async () => {
    const { router } = await renderLoaded("/admin/campaigns?payment_method=cpa&search=loja&status=draft");

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("payment_method"));
    expect(lastParams()).toMatchObject({ search: "loja" });
    expect(lastParams()).not.toHaveProperty("status");
    expect(currentSearch(router)).toEqual({ search: "loja" });
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

  it("só as colunas do contrato ordenam (Orçamento, Entregas, Pendências e Workspace não são botões)", async () => {
    await renderLoaded();
    for (const name of ["Orçamento", "Entregas publicadas", "Pendências", "Workspace", "Status"]) {
      expect(screen.queryByRole("button", { name: new RegExp(`^${name}`) })).not.toBeInTheDocument();
    }
  });

  it("pager: avança e volta de página (na URL e na consulta) e mostra 'X–Y de Z'", async () => {
    client.adminList.mockImplementation(async (_path: string, params: Record<string, unknown>) => ({
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
    client.adminList.mockImplementation(async (_path: string, params: Record<string, unknown>) =>
      pageOf([FIRST_CAMPAIGN], { page: Number(params.page), per_page: Number(params.per_page), total: 120, total_pages: Math.ceil(120 / Number(params.per_page)) }),
    );
    const { router } = await renderLoaded("/admin/campaigns?page=2");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Itens por página" }), "50");
    await waitFor(() => expect(lastParams()).toMatchObject({ per_page: 50, page: 1 }));
    expect(currentSearch(router)).toEqual({ per_page: 50 });
  });

  it("página além do fim (o filtro encolheu a lista): volta para a última que existe", async () => {
    client.adminList.mockImplementation(async (_path: string, params: Record<string, unknown>) =>
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

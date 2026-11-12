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
// A ilha de Pessoas tem os testes dela (e faz consultas próprias de 1 item): aqui só interessa a lista.
vi.mock("@/components/admin/people/people-island", () => ({ PeopleIsland: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/admin/admin-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/admin-client")>()),
  ...api,
}));
vi.mock("@tanstack/react-router", async () => (await import("./test-support")).routerModuleMock());

import { toAdminApiError } from "@/lib/admin/admin-client";

import {
  apiError,
  deferred,
  fakeRouter,
  listOf,
  makeListItem,
  NOW_ISO,
  renderWithQuery,
  routeReads,
  WS_ID,
} from "./test-support";
import { WorkspacesListPage } from "./workspaces-list";

const DEFINITIONS = {
  activity: "Atividade real: o mais recente entre campanha criada, aporte pago e criadores movimentados.",
  owner: "Primeiro dono: o proprietário mais antigo.",
  funded_cents: "Aportes pagos, todo o histórico.",
  custody_cents: "Saldo em custódia agora.",
};

const CAFE = makeListItem();
const STUDIO = makeListItem({
  id: "7a1e0000-0000-4000-8000-000000000003",
  name: "Studio Lume Fotografia",
  tax_id: null,
  status: "suspended",
  owner: null,
  owners_count: 0,
  activity: { state: "never", last_activity_at: null, window_days: 30 },
  members_count: 0,
  campaigns_count: 0,
  published_campaigns_count: 0,
  creators_count: 0,
  funded_cents: 0,
  custody_cents: 0,
});
const CLINICA = makeListItem({
  id: "7a1e0000-0000-4000-8000-000000000012",
  name: "Clínica Vida Plena",
  owners_count: 2,
  activity: { state: "inactive", last_activity_at: "2026-08-01T15:00:00.000Z", window_days: 30 },
});

const lastParams = () => api.adminList.mock.calls.at(-1)?.[1] as Record<string, unknown>;
const rowOf = (text: string) => screen.getByText(text).closest('[role="row"]') as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
  Object.values(api).forEach((mock) => mock.mockReset());
  fakeRouter.set({});
  routeReads(api.adminList, {
    "/admin/workspaces": (query) => listOf([CAFE, STUDIO, CLINICA], 60, Number(query?.page ?? 1), 25, DEFINITIONS),
  });
});
afterEach(() => vi.useRealTimers());

describe("WorkspacesListPage · Nova conta", () => {
  it("o botão 'Nova conta' fica no topo e abre o diálogo de criação (fecha com Cancelar)", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await userEvent.click(screen.getByRole("button", { name: "Nova conta" }));
    expect(screen.getByRole("dialog", { name: "Nova conta" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("WorkspacesListPage · dados", () => {
  it("título, subtítulo e uma linha por workspace com as seis colunas (Workspace, Responsável, Status, Campanhas, Aportes, Criado em)", async () => {
    renderWithQuery(<WorkspacesListPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Pessoas" })).toBeInTheDocument();
    expect(screen.getByText(/usuários, criadores e os workspaces dos clientes/)).toBeInTheDocument();

    const row = await waitFor(() => rowOf("Café Serra Verde"));
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(6);
    ["Workspace", "Responsável", "Status", "Campanhas", "Aportes", "Criado em"].forEach((name, index) => {
      expect(headers[index]).toHaveTextContent(new RegExp(`^${name}`));
    });
    expect(within(row).getByText(/11\.222\.333\/0001-81 · #00000002/)).toBeInTheDocument();
    expect(within(row).getByText("Helena Prado")).toBeInTheDocument();
    expect(within(row).getByText("helena@serraverde.com.br")).toBeInTheDocument();
    // o estado é só o selo; a atividade é um texto cinza sem repetir a palavra "Ativo"
    expect(within(row).getByText("Ativo", { selector: ".adm-badge" })).toBeInTheDocument();
    expect(within(row).getByText("há 3 dias")).toBeInTheDocument();
    expect(within(row).queryByText(/Ativo ·/)).not.toBeInTheDocument();
    expect(within(row).getByText("2", { selector: "b" })).toBeInTheDocument(); // publicadas
    expect(within(row).getByText(/de 8/)).toBeInTheDocument(); // total de campanhas
    expect(within(row).getByText("publicadas")).toBeInTheDocument(); // a dica é texto visível, não só `title`
    expect(within(row).getByText("R$ 1.234.567,89")).toBeInTheDocument(); // aportes, exato
    expect(within(row).getByText("12/03/2025")).toBeInTheDocument();
  });

  it("membros, criadores e em custódia saem da lista (continuam no detalhe)", async () => {
    renderWithQuery(<WorkspacesListPage />);
    const row = await waitFor(() => rowOf("Café Serra Verde"));
    expect(within(row).queryByText("41")).not.toBeInTheDocument(); // criadores
    expect(within(row).queryByText("R$ 45.000,50")).not.toBeInTheDocument(); // custódia
    expect(within(row).queryByText("6")).not.toBeInTheDocument(); // membros
    for (const header of ["Membros", "Criadores", "Em custódia"]) {
      expect(screen.queryByRole("columnheader", { name: new RegExp(header) })).not.toBeInTheDocument();
    }
  });

  it("a atividade de quem nunca usou diz 'Sem atividade'; quem parou mostra a data, sempre em cinza e sem a palavra do estado", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Studio Lume Fotografia");
    expect(within(rowOf("Studio Lume Fotografia")).getByText("Sem atividade")).toBeInTheDocument();
    expect(within(rowOf("Clínica Vida Plena")).getByText("01/08/2026")).toBeInTheDocument();
    expect(within(rowOf("Clínica Vida Plena")).queryByText(/Inativo/)).not.toBeInTheDocument();
  });

  it("sem responsável aparece como aviso claro; mais de um dono mostra '+N'", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Studio Lume Fotografia");

    const studio = rowOf("Studio Lume Fotografia");
    expect(within(studio).getByText("Sem responsável", { selector: ".adm-badge" })).toHaveAttribute("data-tone", "warn");
    expect(within(studio).getByText(/inconsistência a investigar/)).toBeVisible();
    expect(within(studio).getByText("Suspenso", { selector: ".adm-badge" })).toBeInTheDocument();
    expect(within(rowOf("Clínica Vida Plena")).getByText("+1")).toHaveAttribute("title", "2 proprietários");
    expect(within(rowOf("Clínica Vida Plena")).getByText("proprietário a mais")).toBeInTheDocument();
    // o "+N" é o selo da célula do kit (ao lado do nome), não uma caixa própria de Workspaces
    expect(within(rowOf("Clínica Vida Plena")).getByText("+1").closest(".adm-entity-badge")).not.toBeNull();
    expect(within(rowOf("Café Serra Verde")).queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it("a linha inteira abre o detalhe do workspace", async () => {
    renderWithQuery(<WorkspacesListPage />);
    const link = await screen.findByRole("link", { name: /Café Serra Verde/ });
    expect(link).toHaveAttribute("href", `/admin/workspaces/${WS_ID}`);
  });

  it("os 'i' dos cabeçalhos usam o meta.definitions da coluna (pela chave do contrato ou pelo nome do campo)", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");

    expect(screen.getByRole("button", { name: "Como é calculado: Aportes" })).toHaveAccessibleDescription(DEFINITIONS.funded_cents);
    expect(screen.getByRole("button", { name: "Como é calculado: Responsável" })).toHaveAccessibleDescription(DEFINITIONS.owner);
    expect(screen.getByRole("button", { name: "Como é calculado: Status" })).toHaveAccessibleDescription(
      new RegExp(DEFINITIONS.activity.slice(0, 20)),
    );
    // coluna sem definição do servidor não ganha um "i" inventado
    expect(screen.queryByRole("button", { name: "Como é calculado: Criado em" })).not.toBeInTheDocument();
  });

  it("aceita a chave de exemplo do contrato (`funded`) além do nome do campo", async () => {
    routeReads(api.adminList, { "/admin/workspaces": listOf([CAFE], 1, 1, 25, { funded: "Texto do contrato para aportes." }) });
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");
    expect(screen.getByRole("button", { name: "Como é calculado: Aportes" })).toHaveAccessibleDescription("Texto do contrato para aportes.");
  });
});

describe("WorkspacesListPage · estados", () => {
  it("primeira carga: esqueleto, sem linhas inventadas", async () => {
    const pending = deferred<never>();
    api.adminList.mockReturnValue(pending.promise);
    const { container } = renderWithQuery(<WorkspacesListPage />);

    expect(screen.getAllByRole("status").some((region) => region.textContent === "Carregando…")).toBe(true);
    expect(container.querySelectorAll(".adm-row .adm-sk").length).toBeGreaterThan(0);
    expect(screen.queryByText("Café Serra Verde")).not.toBeInTheDocument();
  });

  it("recurso ainda não disponível no servidor", async () => {
    // Como o servidor responde a uma rota que ainda não existe: o cliente lê isso como "recurso indisponível".
    api.adminList.mockRejectedValue(toAdminApiError(404, { statusCode: 404, message: "Cannot GET /api/backoffice/admin/workspaces" }));
    renderWithQuery(<WorkspacesListPage />);

    expect(await screen.findByText("Recurso indisponível")).toBeInTheDocument();
    expect(screen.getByText("Este recurso ainda não está disponível no servidor.")).toBeInTheDocument();
  });

  it("erro do servidor: mensagem em pt-BR e 'Tentar de novo' que recarrega a lista", async () => {
    api.adminList.mockRejectedValue(apiError(500, "SERVER_ERROR", "boom"));
    renderWithQuery(<WorkspacesListPage />);

    const retry = await screen.findByRole("button", { name: /Tentar de novo/ }, { timeout: 3000 });
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();

    routeReads(api.adminList, { "/admin/workspaces": listOf([CAFE], 1) });
    await userEvent.click(retry);
    expect(await screen.findByText("Café Serra Verde")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar")).not.toBeInTheDocument();
  });

  it("lista vazia sem filtros: texto de vazio, sem botão de limpar", async () => {
    routeReads(api.adminList, { "/admin/workspaces": listOf([]) });
    renderWithQuery(<WorkspacesListPage />);

    expect(await screen.findByText("Nenhum workspace ainda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar busca e filtros" })).not.toBeInTheDocument();
  });

  it("lista vazia com filtro: diz que nada bateu e 'Limpar busca e filtros' zera a URL", async () => {
    fakeRouter.set({ search: "zzz", status: "archived" });
    routeReads(api.adminList, { "/admin/workspaces": listOf([]) });
    renderWithQuery(<WorkspacesListPage />);

    expect(await screen.findByText("Nenhum workspace encontrado")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpar busca e filtros" }));
    expect(fakeRouter.search).toEqual({});
  });
});

describe("WorkspacesListPage · filtros (URL e API)", () => {
  it("sem nada na URL, vale o padrão do servidor: nenhum filtro sai para a API; só a ordem explícita", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");
    expect(lastParams()).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" });
    expect(screen.getByRole("combobox", { name: "Status do workspace" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveValue("brand");
  });

  it("o estado é um filtro do painel (Todos, Ativos, Suspensos, Arquivados e Excluídos), junto dos outros filtros", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");
    const panel = document.querySelector(".adm-filters-panel") as HTMLElement;
    const status = within(panel).getByRole("combobox", { name: "Status do workspace" });
    expect(within(status).getAllByRole("option").map((o) => o.textContent)).toEqual(["Todos", "Ativos", "Suspensos", "Arquivados", "Excluídos"]);
    expect(within(panel).getByRole("combobox", { name: "Uso recente" })).toBeInTheDocument();
    expect(within(panel).getByRole("combobox", { name: "Tipo" })).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: "Criado em" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Status do workspace" })).not.toBeInTheDocument();
  });

  it("'Excluídos' entra na contagem de 'Filtros (n)' e 'Limpar filtros' o desfaz uma vez só (o chip e o botão não se duplicam)", async () => {
    fakeRouter.set({ status: "deleted" });
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");
    expect(screen.getByRole("button", { name: "Filtros, 1 ativo" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remover filtro Status do workspace: Excluídos" })).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(fakeRouter.search).toEqual({}));
    expect(screen.getByRole("combobox", { name: "Status do workspace" })).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("a URL manda: estado, atividade, tipo e página chegam à API e ao controle", async () => {
    fakeRouter.set({ status: "archived", activity: "inactive", kind: "orphan", page: 2 });
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");

    expect(lastParams()).toMatchObject({ status: "archived", activity: "inactive", kind: "orphan", page: 2 });
    expect(screen.getByRole("combobox", { name: "Status do workspace" })).toHaveValue("archived");
    expect(screen.getByRole("combobox", { name: "Uso recente" })).toHaveValue("inactive");
    expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveValue("orphan");
  });

  it.each([
    ["Ativos", "active"],
    ["Suspensos", "suspended"],
    ["Arquivados", "archived"],
  ])("estado %s manda status=%s e volta à página 1; 'Todos' devolve o padrão", async (label, value) => {
    fakeRouter.set({ page: 3 });
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");

    const status = screen.getByRole("combobox", { name: "Status do workspace" });
    await userEvent.selectOptions(status, label);
    await waitFor(() => expect(lastParams()).toMatchObject({ status: value, page: 1 }));
    expect(fakeRouter.search).toEqual({ status: value });

    await userEvent.selectOptions(status, "Todos");
    await waitFor(() => expect(lastParams()).not.toHaveProperty("status"));
    expect(fakeRouter.search).toEqual({});
  });

  it("'Excluídos' manda status=deleted (o mesmo valor de antes) e vira chip; o chip volta ao padrão", async () => {
    fakeRouter.set({ page: 3 });
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status do workspace" }), "Excluídos");
    await waitFor(() => expect(lastParams()).toMatchObject({ status: "deleted", page: 1 }));
    expect(fakeRouter.search).toEqual({ status: "deleted" });

    await userEvent.click(screen.getByRole("button", { name: "Remover filtro Status do workspace: Excluídos" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("status"));
    expect(fakeRouter.search).toEqual({});
  });

  it("link do Dashboard com status=deleted abre a lista de excluídos, com o chip ativo", async () => {
    fakeRouter.set({ status: "deleted" });
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");
    expect(lastParams()).toMatchObject({ status: "deleted" });
    expect(screen.getByRole("button", { name: "Remover filtro Status do workspace: Excluídos" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status do workspace" })).toHaveValue("deleted");
  });

  it("busca (nome, responsável, identificador) vai como `search` e fica na URL", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");

    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar workspaces" }), "serra{Enter}");
    await waitFor(() => expect(lastParams()).toMatchObject({ search: "serra", page: 1 }));
    expect(fakeRouter.search).toEqual({ search: "serra" });
  });

  it("atividade, tipo e período de criação são enviados à API; cada chip desfaz o seu", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Uso recente" }), "never");
    await waitFor(() => expect(lastParams()).toMatchObject({ activity: "never" }));

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "all");
    await waitFor(() => expect(lastParams()).toMatchObject({ activity: "never", kind: "all" }));

    fireEvent.change(screen.getByLabelText("Criado em: a partir de"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Criado em: até"), { target: { value: "2026-10-31" } });
    await waitFor(() => expect(lastParams()).toMatchObject({ created_from: "2026-10-01", created_to: "2026-10-31" }));

    expect(fakeRouter.search).toEqual({ activity: "never", kind: "all", created_from: "2026-10-01", created_to: "2026-10-31" });

    await userEvent.click(screen.getByRole("button", { name: "Remover filtro Uso recente: Nunca usaram" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("activity"));
    expect(lastParams()).toMatchObject({ kind: "all", created_from: "2026-10-01" });
  });

  it("'Limpar filtros' também desfaz 'Excluídos', sem um reset sobrescrever o outro", async () => {
    fakeRouter.set({ status: "deleted", activity: "never", search: "serra" });
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("status"));
    expect(lastParams()).not.toHaveProperty("activity");
    expect(fakeRouter.search).toEqual({ search: "serra" });
  });

  it("o botão de atualizar fica no fim da barra (só ícone) e consulta a lista de novo", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");
    expect(within(document.querySelector(".adm-head") as HTMLElement).queryByRole("button", { name: "Atualizar" })).not.toBeInTheDocument();

    const calls = api.adminList.mock.calls.length;
    await userEvent.click(within(document.querySelector(".adm-filters") as HTMLElement).getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(api.adminList.mock.calls.length).toBeGreaterThan(calls));
  });

  it("'Limpar filtros' devolve tudo ao padrão (menos a busca digitada)", async () => {
    fakeRouter.set({ search: "serra", activity: "never", kind: "all" });
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(lastParams()).not.toHaveProperty("activity"));
    expect(lastParams()).toMatchObject({ search: "serra" });
    expect(lastParams()).not.toHaveProperty("kind");
  });
});

describe("WorkspacesListPage · ordenação", () => {
  it("o padrão é Criado em, decrescente (a ordem do servidor), e o cabeçalho mostra isso", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");
    expect(screen.getByRole("columnheader", { name: /Criado em/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: /Aportes/ })).toHaveAttribute("aria-sort", "none");
  });

  it("clicar no cabeçalho ordena pela chave do contrato e inverte no segundo clique", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");
    const table = screen.getByRole("table", { name: "Workspaces" });

    await userEvent.click(within(table).getByRole("button", { name: /^Aportes/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "volume", order: "desc", page: 1 }));
    expect(screen.getByRole("columnheader", { name: /Aportes/ })).toHaveAttribute("aria-sort", "descending");

    await userEvent.click(within(table).getByRole("button", { name: /^Aportes/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "volume", order: "asc" }));
    expect(screen.getByRole("columnheader", { name: /Aportes/ })).toHaveAttribute("aria-sort", "ascending");
    expect(fakeRouter.search).toEqual({ sort_by: "volume", order: "asc" });
  });

  it.each([
    ["Workspace", "name", "asc"],
    ["Status", "last_activity", "desc"],
    ["Campanhas", "campaigns", "desc"],
  ])("cabeçalho %s ordena por %s, começando em %s", async (header, sortBy, order) => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");
    await userEvent.click(within(screen.getByRole("table", { name: "Workspaces" })).getByRole("button", { name: new RegExp(`^${header}`) }));
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: sortBy, order }));
  });

  it("coluna sem ordenação no contrato (Responsável) não vira botão", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");
    const table = screen.getByRole("table", { name: "Workspaces" });
    expect(within(table).queryByRole("button", { name: /^Responsável/ })).not.toBeInTheDocument();
  });

  it("um link com sort_by=members (coluna que saiu da lista) continua valendo na consulta", async () => {
    fakeRouter.set({ sort_by: "members", order: "desc" });
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");
    expect(lastParams()).toMatchObject({ sort_by: "members", order: "desc" });
  });

  it("com sort_by=members na URL, o 'Ordenar por' do celular fica neutro (nenhuma coluna marcada) e continua usável", async () => {
    fakeRouter.set({ sort_by: "members", order: "desc" });
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");

    const select = screen.getByRole("combobox", { name: "Ordenar por" });
    expect(select).toHaveValue("");
    expect(screen.queryByRole("button", { name: /Ordem (de|c)crescente/ })).not.toBeInTheDocument();
    // nenhuma coluna aparece como ordenada
    for (const header of screen.getAllByRole("columnheader")) expect(header).not.toHaveAttribute("aria-sort", "ascending");
    for (const header of screen.getAllByRole("columnheader")) expect(header).not.toHaveAttribute("aria-sort", "descending");

    await userEvent.selectOptions(select, "volume");
    await waitFor(() => expect(lastParams()).toMatchObject({ sort_by: "volume", order: "desc", page: 1 }));
    expect(fakeRouter.search).toEqual({ sort_by: "volume" }); // `desc` é o padrão da lista e não vai para a URL
  });
});

describe("WorkspacesListPage · paginação", () => {
  it("mostra 'X–Y de Z' com o total do servidor e troca de página pela URL", async () => {
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");
    expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("1–25 de 60");

    await userEvent.click(screen.getByRole("button", { name: "Página 2" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));
    expect(fakeRouter.search).toEqual({ page: 2 });
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("26–50 de 60"));
  });

  it("trocar itens por página volta à página 1 e manda per_page", async () => {
    fakeRouter.set({ page: 2 });
    renderWithQuery(<WorkspacesListPage />);
    await screen.findByText("Café Serra Verde");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Itens por página" }), "50");
    await waitFor(() => expect(lastParams()).toMatchObject({ per_page: 50, page: 1 }));
  });

  it("página além do fim (filtro encolheu a lista) volta para a última", async () => {
    fakeRouter.set({ page: 9 });
    routeReads(api.adminList, { "/admin/workspaces": () => listOf([CAFE], 30, 1, 25) });
    renderWithQuery(<WorkspacesListPage />);

    await waitFor(() => expect(fakeRouter.search).toEqual({ page: 2 }));
  });
});

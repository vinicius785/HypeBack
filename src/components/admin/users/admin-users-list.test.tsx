import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ adminList: vi.fn(), adminGet: vi.fn() }));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminList: client.adminList, adminGet: client.adminGet };
});

import { toAdminApiError } from "@/lib/admin/admin-client";
import { createAdminListSearchValidator } from "@/lib/admin/list-query";

import { ADMIN_USERS_LIST_CONFIG } from "./admin-users-config";
import { AdminUsersList } from "./admin-users-list";
import {
  DAY,
  HOUR,
  NOW_ISO,
  WS_AURORA,
  WS_BELA,
  WS_CAFE,
  WS_LUME,
  ago,
  listResult,
  makeLink,
  makeUserListItem,
  makeWorkspaceItem,
  pageMeta,
} from "./admin-users-test-data";
import { currentSearch, renderRoutes, stubRoute, type TestRoute } from "./admin-users-test-utils";

const ROUTES: TestRoute[] = [
  { path: "/admin/users", component: AdminUsersList, validateSearch: createAdminListSearchValidator(ADMIN_USERS_LIST_CONFIG) },
  stubRoute("/admin/users/$userId"),
  stubRoute("/admin/workspaces/$workspaceId"),
];

const BERNARDO = makeUserListItem({
  id: 9,
  name: "Bernardo Medeiros Moraes",
  email: "bernardo@cafeserraverde.com.br",
  workspaces_count: 5,
  workspaces: [
    makeLink({ workspace: { id: WS_CAFE, name: "Café Serra Verde" }, role: "owner" }),
    makeLink({ workspace: { id: WS_LUME, name: "Studio Lume Fotografia" }, role: "admin" }),
    makeLink({ workspace: { id: WS_AURORA, name: "Aurora Beauty Studio" }, role: "member" }),
  ],
  created_at: "2025-03-10T12:00:00.000Z",
  last_session_at: ago(3 * HOUR),
});
const LARISSA = makeUserListItem({
  id: 3,
  name: "Larissa Ribeiro",
  email: "larissa@hype.com",
  kind: "agency",
  status: "suspended",
  workspaces_count: 1,
  workspaces: [makeLink({ workspace: { id: WS_BELA, name: "Boutique Bela Moda" }, role: "observador" })],
  created_at: "2024-08-01T12:00:00.000Z",
  last_session_at: null,
});
const RAFAEL = makeUserListItem({
  id: 2,
  name: "Rafael Teixeira",
  email: "rafael@hype.com",
  kind: "admin",
  is_platform_admin: true,
  workspaces_count: 0,
  workspaces: [],
  created_at: "2024-01-15T12:00:00.000Z",
  last_session_at: ago(5 * DAY),
});
const USERS = [BERNARDO, LARISSA, RAFAEL];

function usersCalls() {
  return client.adminList.mock.calls.filter((call) => call[0] === "/admin/users");
}
function lastUsersParams() {
  return usersCalls().at(-1)?.[1] as Record<string, unknown>;
}

/** Servidor de mentira: devolve os usuários de teste com a paginação pedida (ou o que o teste fixar em `total`). */
function serve(options: { rows?: typeof USERS; total?: number; definitions?: Record<string, string> } = {}) {
  const rows = options.rows ?? USERS;
  client.adminList.mockImplementation(async (path: string, params?: Record<string, unknown>) => {
    if (path === "/admin/users") {
      const perPage = Number(params?.per_page ?? 25);
      const page = Number(params?.page ?? 1);
      const result = listResult(rows, options.total ?? rows.length, { page, per_page: perPage });
      return options.definitions ? { ...result, meta: { ...result.meta, definitions: options.definitions } } : result;
    }
    if (path === "/admin/workspaces") {
      const term = String(params?.search ?? "").toLowerCase();
      const all = [
        makeWorkspaceItem({ id: WS_CAFE, name: "Café Serra Verde" }),
        makeWorkspaceItem({ id: WS_LUME, name: "Studio Lume Fotografia" }),
      ].filter((w) => w.name.toLowerCase().includes(term));
      return listResult(all, all.length, { per_page: 10 });
    }
    throw new Error(`rota inesperada: ${path}`);
  });
}

function table() {
  return screen.getByRole("table", { name: "Usuários" });
}
function dataRows() {
  return within(table())
    .getAllByRole("row")
    .filter((row) => !row.querySelector('[role="columnheader"]'));
}
function cellsOf(row: HTMLElement) {
  return within(row).getAllByRole("cell");
}

async function renderList(url = "/admin/users") {
  const view = renderRoutes(ROUTES, url);
  await screen.findByRole("heading", { name: "Usuários", level: 1 });
  return { ...view, user: userEvent.setup() };
}

beforeEach(() => {
  // Só a data é falsa: as esperas dos testes e o atraso da busca seguem reais.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
  client.adminList.mockReset();
  client.adminGet.mockReset();
  // O seletor busca o nome do workspace quando só há o id (URL): por padrão, não existe.
  client.adminGet.mockRejectedValue(toAdminApiError(404, { message: "Workspace não encontrado." }));
  serve();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("lista de usuários: conteúdo", () => {
  it("cabeçalho da página e a primeira consulta, sem filtro nenhum enviado (o padrão é o da API)", async () => {
    await renderList();
    expect(screen.getByText("Quem acessa a plataforma, em todos os workspaces.")).toBeInTheDocument();
    await screen.findByText("Bernardo Medeiros Moraes");
    expect(usersCalls()).toHaveLength(1);
    expect(lastUsersParams()).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" });
  });

  it("as colunas: usuário, workspaces, status, cadastro e última sessão (sem 'Tipo' enquanto o filtro é um tipo só)", async () => {
    await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    const headers = within(table()).getAllByRole("columnheader").map((h) => h.textContent ?? "");
    expect(headers.slice(0, 4)).toEqual(["Usuário", "Workspaces", "Status", "Cadastrado em"]);
    // a última leva o "i" da definição junto
    expect(headers[4]).toMatch(/^Última sessão/);
    expect(headers).toHaveLength(5);
  });

  it("com 'Todos' os tipos, a coluna 'Tipo' volta (é onde os tipos diferem)", async () => {
    await renderList("/admin/users?kind=all");
    await screen.findByText("Bernardo Medeiros Moraes");
    const headers = within(table()).getAllByRole("columnheader").map((h) => h.textContent ?? "");
    expect(headers.slice(0, 5)).toEqual(["Usuário", "Tipo", "Workspaces", "Status", "Cadastrado em"]);
    const [, kind] = cellsOf(dataRows()[1]);
    expect(kind).toHaveTextContent("Agência");
    // sem a etiqueta de tipo junto do nome: o tipo já está na coluna
    expect(within(cellsOf(dataRows()[1])[0]).queryByText("Agência")).not.toBeInTheDocument();
  });

  it("linha de uma conta de marca ativa com sessão", async () => {
    await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    const [user, workspaces, status, created, session] = cellsOf(dataRows()[0]);

    expect(user).toHaveTextContent("Bernardo Medeiros Moraes");
    expect(user).toHaveTextContent("bernardo@cafeserraverde.com.br");
    // conta de marca no filtro "Marca": nenhuma etiqueta de tipo junto do nome
    expect(user).not.toHaveTextContent("Marca");
    expect(status).toHaveTextContent("Ativo");
    expect(created).toHaveTextContent("10/03/2025");

    // os dois primeiros vínculos, com o papel, e "+N" para o resto
    expect(within(workspaces).getByRole("link", { name: "Café Serra Verde" })).toHaveAttribute("href", `/admin/workspaces/${WS_CAFE}`);
    expect(workspaces).toHaveTextContent("Proprietário");
    expect(within(workspaces).getByRole("link", { name: "Studio Lume Fotografia" })).toHaveAttribute("href", `/admin/workspaces/${WS_LUME}`);
    expect(workspaces).toHaveTextContent("Administrador");
    expect(within(workspaces).queryByText("Aurora Beauty Studio")).not.toBeInTheDocument();
    // "+3" é texto visível; o "i" ao lado (teclado e toque) traz os outros, com o papel de cada um
    expect(within(workspaces).getByText("+3")).toBeInTheDocument();
    const more = within(workspaces).getByRole("button", { name: "Outros workspaces de Bernardo Medeiros Moraes" });
    expect(more).toHaveAccessibleDescription("Aurora Beauty Studio (Membro) e mais 2 no detalhe");

    // "aprox.", com a hora exata à vista (a explicação da aproximação está no "i" da coluna)
    expect(within(session).getByText("aprox. há 3 horas")).toBeInTheDocument();
    expect(within(session).getByText("31/10/2026 09:00")).toBeInTheDocument();
  });

  it("conta suspensa de agência sem sessão: status, a etiqueta do tipo junto do nome e o texto visível sem sessão", async () => {
    await renderList();
    await screen.findByText("Larissa Ribeiro");
    const [user, workspaces, status, , session] = cellsOf(dataRows()[1]);
    // o filtro é "Marca": agência destoa e ganha etiqueta junto do nome
    expect(within(user).getByText("Agência")).toBeInTheDocument();
    // o selo é o `badge` do AdminEntityCell: fica na linha do nome, não numa caixa solta ao lado da célula
    expect(within(user).getByText("Agência").closest(".adm-entity-badge")).not.toBeNull();
    expect(workspaces).toHaveTextContent("Boutique Bela Moda");
    expect(workspaces).toHaveTextContent("Observador");
    expect(workspaces).not.toHaveTextContent("+");
    expect(status).toHaveTextContent("Suspenso");
    expect(session).toHaveTextContent("Sem sessão aberta");
    expect(session).not.toHaveTextContent("aprox.");
  });

  it("administrador da plataforma leva a etiqueta junto do nome; sem vínculo, '—' em Workspaces", async () => {
    await renderList();
    await screen.findByText("Rafael Teixeira");
    const [user, workspaces, , , session] = cellsOf(dataRows()[2]);
    expect(within(user).getByText("Administrador")).toBeInTheDocument();
    expect(within(user).getByText("Admin da plataforma")).toBeInTheDocument();
    expect(workspaces).toHaveTextContent("—");
    expect(session).toHaveTextContent("aprox. há 5 dias");
    // quem não é administrador da plataforma não leva a etiqueta
    expect(cellsOf(dataRows()[0])[0]).not.toHaveTextContent("Admin da plataforma");
  });

  it("a linha inteira abre o detalhe do usuário", async () => {
    const { router, user } = await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    const link = screen.getByRole("link", { name: /Bernardo Medeiros Moraes/ });
    expect(link).toHaveAttribute("href", "/admin/users/9");
    await user.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/users/9"));
  });

  it("'Atualizar' é um ícone no fim da barra de filtros (e não um botão do cabeçalho) e busca a lista de novo", async () => {
    const { user } = await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    const refresh = screen.getByRole("button", { name: "Atualizar" });
    expect(within(screen.getAllByRole("banner")[0]).queryByRole("button", { name: /Atualizar/ })).not.toBeInTheDocument();
    const before = usersCalls().length;
    await user.click(refresh);
    await waitFor(() => expect(usersCalls().length).toBe(before + 1));
  });

  it("a última sessão mostra o instante exato à vista, sem depender de dica de mouse", async () => {
    await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    // nem a última sessão nem o "+N" dos workspaces dependem de `title` (o nome da pessoa tem o seu, que é do kit)
    const [, workspaces, , , session] = cellsOf(dataRows()[0]);
    expect(session.querySelector("[title]")).toBeNull();
    expect(workspaces.querySelector("[title]")).toBeNull();
  });

  it("a coluna de última sessão explica que é aproximação (definição do servidor quando vem)", async () => {
    serve({ definitions: { last_session_at: "Texto do servidor sobre a sessão." } });
    await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    expect(screen.getByRole("button", { name: "Como é calculado: Última sessão" })).toHaveAccessibleDescription("Texto do servidor sobre a sessão.");
  });

  it("sem definição do servidor, o texto local explica a aproximação", async () => {
    await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    const description = screen.getByRole("button", { name: "Como é calculado: Última sessão" });
    expect(description).toHaveAccessibleDescription(/±5 minutos/);
    expect(description).toHaveAccessibleDescription(/Quando a pessoa sai do app, a sessão é apagada/);
  });
});

describe("lista de usuários: estados", () => {
  it("primeira carga: esqueleto e aviso para leitor de tela", async () => {
    client.adminList.mockReturnValue(new Promise(() => undefined));
    const { container } = await renderList();
    expect(screen.getAllByRole("status").some((status) => status.textContent === "Carregando…")).toBe(true);
    expect(container.querySelectorAll(".adm-row .adm-sk").length).toBeGreaterThan(0);
    expect(screen.queryByText("Bernardo Medeiros Moraes")).not.toBeInTheDocument();
  });

  it("sem usuário e sem filtro: diz que não há ninguém", async () => {
    serve({ rows: [] });
    await renderList();
    expect(await screen.findByText("Nenhum usuário ainda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar busca e filtros" })).not.toBeInTheDocument();
  });

  it("sem resultado para a busca: explica e 'Limpar busca e filtros' volta ao começo", async () => {
    serve({ rows: [] });
    const { router, user } = await renderList("/admin/users?search=zzz&status=suspended&sort_by=name");
    expect(await screen.findByText("Nenhum usuário encontrado")).toBeInTheDocument();
    expect(screen.getByText("Nenhum usuário corresponde à busca e aos filtros atuais.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar busca e filtros" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({}));
    await waitFor(() => expect(lastUsersParams()).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("erro de servidor: motivo em português e 'Tentar de novo' busca outra vez", async () => {
    client.adminList.mockRejectedValue(toAdminApiError(500, { message: "Internal server error" }));
    const { user } = await renderList();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("O servidor teve um problema. Tente novamente em instantes.");

    serve();
    await user.click(within(alert).getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByText("Bernardo Medeiros Moraes")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("rota que o servidor ainda não tem: 'recurso indisponível'", async () => {
    client.adminList.mockRejectedValue(toAdminApiError(404, { message: "Cannot GET /api/backoffice/admin/users" }));
    await renderList();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Recurso indisponível");
    expect(alert).toHaveTextContent("Este recurso ainda não está disponível no servidor.");
  });

  it("filtro inválido na URL (o servidor responde 400): mostra a mensagem do servidor", async () => {
    client.adminList.mockRejectedValue(toAdminApiError(400, { message: ["workspace_id deve ser um UUID"] }));
    await renderList("/admin/users?workspace_id=abc");
    expect(await screen.findByRole("alert")).toHaveTextContent("workspace_id deve ser um UUID");
  });
});

describe("lista de usuários: filtros na URL e na API", () => {
  it("estado da conta: cada opção vai para a URL e para a consulta; o padrão sai de ambos", async () => {
    const { router, user } = await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    const group = screen.getByRole("group", { name: "Status da conta" });
    expect(within(group).getByRole("button", { name: "Ativos e suspensos" })).toHaveAttribute("aria-pressed", "true");

    for (const [label, value] of [
      ["Suspensos", "suspended"],
      ["Ativos", "active"],
      ["Excluídos", "deleted"],
      ["Todos", "all"],
    ] as const) {
      await user.click(within(group).getByRole("button", { name: label }));
      await waitFor(() => expect(currentSearch(router)).toEqual({ status: value }));
      await waitFor(() => expect(lastUsersParams()).toMatchObject({ status: value, page: 1 }));
      expect(within(group).getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
    }

    await user.click(within(group).getByRole("button", { name: "Ativos e suspensos" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({}));
    await waitFor(() => expect(lastUsersParams()).not.toHaveProperty("status"));
  });

  it("estado fora do padrão conta como filtro: vira chip e 'Limpar filtros' o devolve a 'Ativos e suspensos'", async () => {
    const { router, user } = await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();

    await user.click(within(screen.getByRole("group", { name: "Status da conta" })).getByRole("button", { name: "Suspensos" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ status: "suspended" }));
    expect(screen.getByRole("button", { name: "Remover filtro Status da conta: Suspensos" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({}));
    expect(
      within(screen.getByRole("group", { name: "Status da conta" })).getByRole("button", { name: "Ativos e suspensos" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("tipo: Criadores e Todos mudam a URL, a consulta e viram chip; 'Marca' é o padrão", async () => {
    const { router, user } = await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    const select = screen.getByRole("combobox", { name: "Tipo" });
    expect(select).toHaveValue("brand");

    await user.selectOptions(select, "creator");
    await waitFor(() => expect(currentSearch(router)).toEqual({ kind: "creator" }));
    await waitFor(() => expect(lastUsersParams()).toMatchObject({ kind: "creator" }));
    expect(screen.getByRole("button", { name: "Remover filtro Tipo: Criadores" })).toBeInTheDocument();

    await user.selectOptions(select, "all");
    await waitFor(() => expect(lastUsersParams()).toMatchObject({ kind: "all" }));

    await user.click(screen.getByRole("button", { name: "Remover filtro Tipo: Todos" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({}));
    await waitFor(() => expect(lastUsersParams()).not.toHaveProperty("kind"));
  });

  it("busca por nome ou e-mail: Enter busca na hora, vai para a URL e volta à página 1", async () => {
    const { router, user } = await renderList("/admin/users?page=2");
    await screen.findByText("Bernardo Medeiros Moraes");
    await user.type(screen.getByRole("searchbox", { name: "Buscar usuários" }), "bernardo@{Enter}");
    await waitFor(() => expect(currentSearch(router)).toEqual({ search: "bernardo@" }));
    await waitFor(() => expect(lastUsersParams()).toMatchObject({ search: "bernardo@", page: 1 }));
  });

  it("período de cadastro: as duas datas vão para a URL e para a consulta", async () => {
    const { router } = await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    fireEvent.change(screen.getByLabelText("Cadastrado em: a partir de"), { target: { value: "2026-10-01" } });
    await waitFor(() => expect(currentSearch(router)).toEqual({ created_from: "2026-10-01" }));
    fireEvent.change(screen.getByLabelText("Cadastrado em: até"), { target: { value: "2026-10-31" } });
    await waitFor(() => expect(currentSearch(router)).toEqual({ created_from: "2026-10-01", created_to: "2026-10-31" }));
    await waitFor(() => expect(lastUsersParams()).toMatchObject({ created_from: "2026-10-01", created_to: "2026-10-31" }));
    expect(screen.getByRole("button", { name: /Remover filtro Cadastrado em: 01\/10\/2026 – 31\/10\/2026/ })).toBeInTheDocument();
  });

  it("workspace: escolher no seletor filtra a lista, conta em 'Filtros', vira chip e o chip tira o filtro", async () => {
    const { router, user } = await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    await user.click(screen.getByRole("button", { name: /^Workspace:/ }));
    await user.click(await screen.findByRole("option", { name: /Studio Lume Fotografia/ }));

    await waitFor(() => expect(currentSearch(router)).toEqual({ workspace_id: WS_LUME }));
    await waitFor(() => expect(lastUsersParams()).toMatchObject({ workspace_id: WS_LUME, page: 1 }));
    expect(screen.getByRole("button", { name: /^Workspace:/ })).toHaveTextContent("Studio Lume Fotografia");
    // a busca do seletor só traz clientes
    expect(client.adminList).toHaveBeenCalledWith("/admin/workspaces", expect.objectContaining({ kind: "brand" }), expect.anything());
    // o nome escolhido já é o do chip, sem buscar o detalhe do workspace
    expect(client.adminGet).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remover filtro Workspace: Studio Lume Fotografia" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({}));
    await waitFor(() => expect(lastUsersParams()).not.toHaveProperty("workspace_id"));
    expect(screen.queryByRole("button", { name: /^Remover filtro Workspace/ })).not.toBeInTheDocument();
  });

  it("o seletor de workspace é um filtro da barra: 'Limpar filtros' o limpa junto com o tipo", async () => {
    const { router, user } = await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "creator");
    await user.click(screen.getByRole("button", { name: /^Workspace:/ }));
    await user.click(await screen.findByRole("option", { name: /Studio Lume Fotografia/ }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ kind: "creator", workspace_id: WS_LUME }));
    expect(screen.getByRole("button", { name: /^Filtros/ })).toHaveTextContent("2");

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({}));
    await waitFor(() => expect(lastUsersParams()).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" }));
  });

  it("'Limpar filtros' volta tipo, período, estado e workspace ao padrão, mas mantém a busca", async () => {
    client.adminGet.mockResolvedValue(makeWorkspaceItem({ id: WS_LUME, name: "Studio Lume Fotografia" }));
    const { router, user } = await renderList(
      `/admin/users?status=suspended&kind=creator&workspace_id=${WS_LUME}&created_from=2026-10-01&search=ana`,
    );
    await screen.findByText("Bernardo Medeiros Moraes");
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ search: "ana" }));
    await waitFor(() => expect(lastUsersParams()).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc", search: "ana" }));
  });

  it("todo o estado vem da URL: recarregar a página (ou abrir um link) reproduz a tela e a consulta", async () => {
    client.adminGet.mockResolvedValue(makeWorkspaceItem({ id: WS_CAFE, name: "Café Serra Verde" }));
    serve({ total: 400 });
    await renderList(
      `/admin/users?status=suspended&kind=all&search=ana&sort_by=name&order=asc&page=2&per_page=50&workspace_id=${WS_CAFE}&created_from=2026-10-01&created_to=2026-10-31`,
    );
    await screen.findByText("Bernardo Medeiros Moraes");

    expect(lastUsersParams()).toEqual({
      page: 2,
      per_page: 50,
      search: "ana",
      sort_by: "name",
      order: "asc",
      status: "suspended",
      kind: "all",
      workspace_id: WS_CAFE,
      created_from: "2026-10-01",
      created_to: "2026-10-31",
    });
    expect(within(screen.getByRole("group", { name: "Status da conta" })).getByRole("button", { name: "Suspensos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveValue("all");
    expect(screen.getByRole("searchbox")).toHaveValue("ana");
    expect(screen.getByLabelText("Cadastrado em: a partir de")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Cadastrado em: até")).toHaveValue("2026-10-31");
    await waitFor(() => expect(screen.getByRole("button", { name: /^Workspace:/ })).toHaveTextContent("Café Serra Verde"));
    expect(client.adminGet).toHaveBeenCalledWith(`/admin/workspaces/${WS_CAFE}`, undefined, expect.anything());
  });

  it("valores inválidos na URL caem no padrão (a barra de endereço é entrada de usuário)", async () => {
    await renderList("/admin/users?page=abc&per_page=7&sort_by=password&order=sideways");
    await screen.findByText("Bernardo Medeiros Moraes");
    expect(lastUsersParams()).toEqual({ page: 1, per_page: 25, sort_by: "created_at", order: "desc" });
  });
});

describe("lista de usuários: ordenação", () => {
  it("o padrão é cadastro, do mais novo para o mais velho", async () => {
    await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    const headers = within(table()).getAllByRole("columnheader");
    expect(headers[3]).toHaveAttribute("aria-sort", "descending");
    expect(headers[0]).toHaveAttribute("aria-sort", "none");
    expect(headers[4]).toHaveAttribute("aria-sort", "none");
    // as outras colunas não são ordenáveis
    expect(headers[1]).not.toHaveAttribute("aria-sort");
    expect(headers[2]).not.toHaveAttribute("aria-sort");
  });

  it("nome começa de A a Z e alterna; cadastro e última sessão começam do mais recente", async () => {
    const { router, user } = await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    const header = (name: string) => within(table()).getByRole("button", { name });

    await user.click(header("Usuário"));
    await waitFor(() => expect(currentSearch(router)).toEqual({ sort_by: "name", order: "asc" }));
    await waitFor(() => expect(lastUsersParams()).toMatchObject({ sort_by: "name", order: "asc", page: 1 }));
    expect(within(table()).getAllByRole("columnheader")[0]).toHaveAttribute("aria-sort", "ascending");

    await user.click(header("Usuário"));
    await waitFor(() => expect(lastUsersParams()).toMatchObject({ sort_by: "name", order: "desc" }));

    await user.click(header("Última sessão"));
    await waitFor(() => expect(currentSearch(router)).toEqual({ sort_by: "last_session" }));
    await waitFor(() => expect(lastUsersParams()).toMatchObject({ sort_by: "last_session", order: "desc" }));

    await user.click(header("Cadastrado em"));
    await waitFor(() => expect(currentSearch(router)).toEqual({}));
    await waitFor(() => expect(lastUsersParams()).toMatchObject({ sort_by: "created_at", order: "desc" }));

    // a mesma coluna do padrão inverte
    await user.click(header("Cadastrado em"));
    await waitFor(() => expect(currentSearch(router)).toEqual({ order: "asc" }));
    await waitFor(() => expect(lastUsersParams()).toMatchObject({ sort_by: "created_at", order: "asc" }));
  });
});

describe("lista de usuários: paginação", () => {
  it("mostra 'X–Y de Z' e troca de página (na URL e na consulta)", async () => {
    serve({ total: 60 });
    const { router, user } = await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    const pager = screen.getByRole("navigation", { name: "Paginação" });
    expect(pager).toHaveTextContent("1–25 de 60");

    await user.click(within(pager).getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ page: 2 }));
    await waitFor(() => expect(lastUsersParams()).toMatchObject({ page: 2 }));
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("26–50 de 60"));

    await user.click(within(screen.getByRole("navigation", { name: "Paginação" })).getByRole("button", { name: "Página 3" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ page: 3 }));
  });

  it("itens por página: troca o tamanho e volta à página 1", async () => {
    serve({ total: 120 });
    const { router, user } = await renderList("/admin/users?page=3");
    await screen.findByText("Bernardo Medeiros Moraes");
    await user.selectOptions(screen.getByRole("combobox", { name: "Itens por página" }), "50");
    await waitFor(() => expect(currentSearch(router)).toEqual({ per_page: 50 }));
    await waitFor(() => expect(lastUsersParams()).toMatchObject({ per_page: 50, page: 1 }));
  });

  it("página além do fim (filtro encolheu a lista): volta para a última", async () => {
    client.adminList.mockImplementation(async (path: string, params?: Record<string, unknown>) => {
      if (path !== "/admin/users") throw new Error(path);
      return { data: [], meta: pageMeta(30, { page: Number(params?.page ?? 1), per_page: 25 }) };
    });
    const { router } = await renderList("/admin/users?page=9");
    await waitFor(() => expect(currentSearch(router)).toEqual({ page: 2 }));
  });

  it("lista que cabe numa página: só o resumo, sem botões de página", async () => {
    await renderList();
    await screen.findByText("Bernardo Medeiros Moraes");
    const pager = screen.getByRole("navigation", { name: "Paginação" });
    expect(pager).toHaveTextContent("1–3 de 3");
    expect(within(pager).queryByRole("button", { name: "Próxima página" })).not.toBeInTheDocument();
  });
});

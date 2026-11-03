import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminList: vi.fn(),
  adminGet: vi.fn(),
  adminPost: vi.fn(),
  toastSuccess: vi.fn(),
  auth: { user: { id: 1, name: "Marina Albuquerque", is_platform_admin: true, platform_role: "admin" } as { id: number; name: string; is_platform_admin?: boolean; platform_role?: string } | null },
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminList: mocks.adminList, adminGet: mocks.adminGet, adminPost: mocks.adminPost };
});
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: mocks.auth.user, setUser: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));

import { AdminApiError, toAdminApiError } from "@/lib/admin/admin-client";
import type { AdminAuditLogEntry, AdminUserDetail } from "@/shared/admin-platform.types";

import { AdminUserDetailScreen, validateAdminUserSearch } from "./admin-user-detail";
import {
  HOUR,
  NOW_ISO,
  WS_AURORA,
  WS_CAFE,
  WS_LUME,
  ago,
  listResult,
  makeAuditEntry,
  makeLink,
  makeSuspendedDetail,
  makeUserDetail,
} from "./admin-users-test-data";
import { currentSearch, renderRoutes, stubRoute, type TestRoute } from "./admin-users-test-utils";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function DetailPage() {
  const { userId } = useParams({ strict: false }) as { userId: string };
  return <AdminUserDetailScreen userId={userId} />;
}

const ROUTES: TestRoute[] = [
  { path: "/admin/users/$userId", component: DetailPage, validateSearch: validateAdminUserSearch },
  stubRoute("/admin/users"),
  stubRoute("/admin/workspaces/$workspaceId"),
];

/** O "servidor" de mentira: o detalhe que a tela vai buscar e as duas visões da auditoria. */
const server = {
  detail: makeUserDetail() as AdminUserDetail,
  target: [makeAuditEntry()] as AdminAuditLogEntry[],
  actor: [] as AdminAuditLogEntry[],
};

function serve() {
  mocks.adminGet.mockImplementation(async (path: string) => {
    if (path === `/admin/users/${server.detail.id}`) return server.detail;
    throw toAdminApiError(404, { message: "Usuário não encontrado." });
  });
  mocks.adminList.mockImplementation(async (path: string, params?: Record<string, unknown>) => {
    if (path !== "/admin/audit-log") throw new Error(`rota inesperada: ${path}`);
    const rows = params?.actor_user_id !== undefined ? server.actor : server.target;
    return listResult(rows, rows.length, { page: Number(params?.page ?? 1), per_page: Number(params?.per_page ?? 10) });
  });
}

async function renderDetail(url = "/admin/users/9") {
  const view = renderRoutes(ROUTES, url);
  await screen.findByRole("heading", { level: 1, name: server.detail.name });
  return { ...view, user: userEvent.setup() };
}

/** O valor (dd) de uma linha rótulo/valor (dt/dd) dentro de um bloco. */
function valueOf(scope: HTMLElement, label: string): HTMLElement {
  return within(scope).getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;
}

const dataBlock = () => screen.getByRole("region", { name: "Dados da conta" });
/** O cabeçalho da página: com um diálogo aberto, o `<header>` do diálogo também é um "banner" para a consulta por papel. */
const pageHeader = () => screen.getAllByRole("banner")[0];
const actionButtons = () =>
  ["Encerrar sessões", "Suspender", "Reativar"].filter((name) => screen.queryByRole("button", { name, hidden: false }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
  for (const mock of [mocks.adminList, mocks.adminGet, mocks.adminPost, mocks.toastSuccess]) mock.mockReset();
  mocks.auth.user = { id: 1, name: "Marina Albuquerque", is_platform_admin: true, platform_role: "admin" };
  server.detail = makeUserDetail();
  server.target = [makeAuditEntry()];
  server.actor = [];
  serve();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("detalhe do usuário: cabeçalho e dados", () => {
  it("foto/iniciais, nome, e-mail, estado e tipo; as migalhas voltam para a lista", async () => {
    await renderDetail();
    expect(mocks.adminGet).toHaveBeenCalledWith("/admin/users/9", undefined, expect.anything());

    const header = pageHeader();
    expect(within(header).getByRole("heading", { level: 1 })).toHaveTextContent("Bernardo Medeiros Moraes");
    expect(within(header).getByText("bernardo@cafeserraverde.com.br")).toBeInTheDocument();
    expect(within(header).getByText("Ativo")).toBeInTheDocument();
    expect(within(header).getByText("Marca")).toBeInTheDocument();
    expect(within(header).queryByText("Admin da plataforma")).not.toBeInTheDocument();

    const crumbs = screen.getByRole("navigation", { name: "Navegação" });
    expect(within(crumbs).getByRole("link", { name: "Usuários" })).toHaveAttribute("href", "/admin/users");
    expect(within(crumbs).getByText("Bernardo Medeiros Moraes")).toHaveAttribute("aria-current", "page");
  });

  it("administrador da plataforma leva a etiqueta no cabeçalho", async () => {
    server.detail = makeUserDetail({ kind: "admin", is_platform_admin: true });
    await renderDetail();
    const header = pageHeader();
    expect(within(header).getByText("Admin da plataforma")).toBeInTheDocument();
    expect(within(header).getByText("Administrador")).toBeInTheDocument();
  });

  it("dados da conta (aba Resumo, a padrão): telefone, e-mail verificado, documento mascarado, cadastro e identificador; o e-mail só no cabeçalho", async () => {
    await renderDetail();
    const block = dataBlock();
    expect(screen.getByRole("tab", { name: "Resumo" })).toHaveAttribute("aria-selected", "true");
    // o e-mail é o subtítulo do cabeçalho e não se repete nos dados
    expect(within(block).queryByText("E-mail", { selector: "dt" })).not.toBeInTheDocument();
    expect(within(block).queryByText("bernardo@cafeserraverde.com.br")).not.toBeInTheDocument();
    expect(valueOf(block, "Telefone")).toHaveTextContent("(11) 98765-4321");
    expect(valueOf(block, "E-mail verificado")).toHaveTextContent("Sim");
    expect(valueOf(block, "Documento")).toHaveTextContent("***.***.***-45");
    expect(valueOf(block, "Documento")).toHaveTextContent("Mascarado: só os 2 últimos dígitos.");
    expect(valueOf(block, "Cadastrado em")).toHaveTextContent("10/03/2025 09:00");
    expect(valueOf(block, "Identificador")).toHaveTextContent("9");
    expect(within(block).queryByText("Excluída em")).not.toBeInTheDocument();
  });

  it("e-mail não verificado de conta de marca: explica que não indica problema", async () => {
    server.detail = makeUserDetail({ email_verified: false });
    await renderDetail();
    expect(valueOf(dataBlock(), "E-mail verificado")).toHaveTextContent("Não");
    expect(valueOf(dataBlock(), "E-mail verificado")).toHaveTextContent("só é feita no cadastro de criadores");
  });

  it("e-mail não verificado de criador: só 'Não', sem a explicação", async () => {
    server.detail = makeUserDetail({ kind: "creator", email_verified: false });
    await renderDetail();
    expect(valueOf(dataBlock(), "E-mail verificado")).toHaveTextContent("Não");
    expect(valueOf(dataBlock(), "E-mail verificado")).not.toHaveTextContent("cadastro de criadores");
  });

  it("sem telefone nem documento: '—'", async () => {
    server.detail = makeUserDetail({ phone: null, document_masked: null });
    await renderDetail();
    expect(valueOf(dataBlock(), "Telefone")).toHaveTextContent("—");
    expect(valueOf(dataBlock(), "Documento")).toHaveTextContent("—");
  });

  it("conta excluída: estado, e a data da exclusão nos dados", async () => {
    server.detail = makeUserDetail({ status: "deleted", deleted_at: "2026-09-01T15:00:00.000Z" });
    await renderDetail();
    expect(within(pageHeader()).getByText("Excluído")).toBeInTheDocument();
    expect(valueOf(dataBlock(), "Excluída em")).toHaveTextContent("01/09/2026 12:00");
  });

  it("conta ativa não tem o bloco de suspensão", async () => {
    await renderDetail();
    expect(screen.queryByRole("region", { name: "Conta suspensa" })).not.toBeInTheDocument();
  });

  it("conta suspensa: desde quando, motivo e quem suspendeu (com link para essa pessoa)", async () => {
    server.detail = makeSuspendedDetail();
    await renderDetail();
    const block = screen.getByRole("region", { name: "Conta suspensa" });
    expect(valueOf(block, "Desde")).toHaveTextContent("30/10/2026 10:30");
    expect(valueOf(block, "Motivo")).toHaveTextContent("Suspeita de acesso indevido à conta");
    expect(within(valueOf(block, "Suspensa por")).getByRole("link", { name: "Marina Albuquerque" })).toHaveAttribute("href", "/admin/users/1");
    expect(within(pageHeader()).getByText("Suspenso")).toBeInTheDocument();
  });

  it("suspensa sem detalhes registrados: 'Não informado', sem inventar", async () => {
    server.detail = makeSuspendedDetail({ suspension: { suspended_at: "2026-10-30T13:30:00.000Z", reason: null, suspended_by: null } });
    await renderDetail();
    const block = screen.getByRole("region", { name: "Conta suspensa" });
    expect(valueOf(block, "Suspensa por")).toHaveTextContent("Não informado");
    expect(valueOf(block, "Motivo")).toHaveTextContent("Não informado");
  });
});

describe("detalhe do usuário: estados da página", () => {
  it("carregando: esqueleto e aviso para leitor de tela", async () => {
    mocks.adminGet.mockReturnValue(new Promise(() => undefined));
    renderRoutes(ROUTES, "/admin/users/9");
    expect(await screen.findByText("Carregando usuário…")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegação" })).toBeInTheDocument();
  });

  it("usuário que não existe: 'não encontrado' com a saída para a lista, sem botão de tentar de novo (repetir não muda nada)", async () => {
    mocks.adminGet.mockRejectedValue(toAdminApiError(404, { message: "Usuário não encontrado." }));
    renderRoutes(ROUTES, "/admin/users/9");
    expect(await screen.findByText("Não encontramos este usuário")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tentar de novo/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para a lista" })).toHaveAttribute("href", "/admin/users");
    expect(screen.getByRole("link", { name: "Usuários" })).toHaveAttribute("href", "/admin/users");
  });

  it("rota que o servidor ainda não tem: 'recurso indisponível' e dá para tentar de novo", async () => {
    mocks.adminGet.mockRejectedValueOnce(toAdminApiError(404, { message: "Cannot GET /api/backoffice/admin/users/9" }));
    const view = renderRoutes(ROUTES, "/admin/users/9");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Recurso indisponível");
    expect(alert).toHaveTextContent("Este recurso ainda não está disponível no servidor.");

    serve();
    await userEvent.setup().click(within(alert).getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Bernardo Medeiros Moraes" })).toBeInTheDocument();
    view.unmount();
  });

  it("erro de servidor: 'Não foi possível carregar' com o motivo", async () => {
    mocks.adminGet.mockRejectedValue(toAdminApiError(500, { message: "Internal server error" }));
    renderRoutes(ROUTES, "/admin/users/9");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar");
    expect(alert).toHaveTextContent("O servidor teve um problema. Tente novamente em instantes.");
    expect(within(alert).getByRole("button", { name: /Tentar de novo/ })).toBeInTheDocument();
  });

  it.each(["abc", "0", "-3", "1.5", "9abc", "007x"])("id inválido na URL (%s): 'não encontrado' sem ir ao servidor", async (id) => {
    renderRoutes(ROUTES, `/admin/users/${id}`);
    expect(await screen.findByText("Não encontramos este usuário")).toBeInTheDocument();
    expect(mocks.adminGet).not.toHaveBeenCalled();
  });
});

describe("detalhe do usuário: abas na URL", () => {
  it("validateSearch aceita só uma aba conhecida; a primeira (Resumo) é o padrão e não aparece; os valores antigos seguem valendo", () => {
    expect(validateAdminUserSearch({ tab: "sessions" })).toEqual({ tab: "sessions" });
    expect(validateAdminUserSearch({ tab: "activity" })).toEqual({ tab: "activity" });
    expect(validateAdminUserSearch({ tab: "links" })).toEqual({ tab: "links" });
    expect(validateAdminUserSearch({ tab: "summary" })).toEqual({});
    expect(validateAdminUserSearch({ tab: "financeiro" })).toEqual({});
    expect(validateAdminUserSearch({ tab: 3 })).toEqual({});
    expect(validateAdminUserSearch({ page: 2 })).toEqual({});
  });

  it("abre em Resumo, com a contagem de vínculos e de sessões nas abas", async () => {
    await renderDetail();
    const tabs = screen.getByRole("tablist", { name: "Seções do usuário" });
    expect(within(tabs).getByRole("tab", { name: "Resumo" })).toHaveAttribute("aria-selected", "true");
    expect(within(tabs).getByRole("tab", { name: /Vínculos/ })).toHaveAttribute("aria-selected", "false");
    expect(within(tabs).getByRole("tab", { name: /Vínculos/ })).toHaveTextContent("2");
    expect(within(tabs).getByRole("tab", { name: /Sessões/ })).toHaveTextContent("2");
    expect(within(tabs).getByRole("tab", { name: "Atividade" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Resumo");
  });

  it("trocar de aba muda a URL (só `?tab=`), e voltar para a primeira a tira", async () => {
    const { router, user } = await renderDetail();
    await user.click(screen.getByRole("tab", { name: /Vínculos/ }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ tab: "links" }));
    expect(screen.getByRole("table", { name: "Workspaces vinculados" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Sessões/ }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ tab: "sessions" }));
    expect(screen.getByRole("tab", { name: /Sessões/ })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "Atividade" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ tab: "activity" }));

    await user.click(screen.getByRole("tab", { name: "Resumo" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({}));
    expect(dataBlock()).toBeInTheDocument();
  });

  it("um link com ?tab=sessions (ou ?tab=links) abre direto na aba; aba desconhecida cai em Resumo", async () => {
    const first = await renderDetail("/admin/users/9?tab=sessions");
    expect(screen.getByRole("tab", { name: /Sessões/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Sessões" })).toBeInTheDocument();
    first.unmount();

    const second = await renderDetail("/admin/users/9?tab=links");
    expect(screen.getByRole("tab", { name: /Vínculos/ })).toHaveAttribute("aria-selected", "true");
    second.unmount();

    await renderDetail("/admin/users/9?tab=xyz");
    expect(screen.getByRole("tab", { name: "Resumo" })).toHaveAttribute("aria-selected", "true");
  });

  it("setas do teclado trocam de aba", async () => {
    const { router, user } = await renderDetail();
    screen.getByRole("tab", { name: "Resumo" }).focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(currentSearch(router)).toEqual({ tab: "links" }));
    expect(screen.getByRole("tab", { name: /Vínculos/ })).toHaveFocus();
  });
});

describe("detalhe do usuário: aba Vínculos", () => {
  it("todos os workspaces, com o estado sob o nome, papel, permissões personalizadas e entrada (sem coluna só para o estado)", async () => {
    await renderDetail("/admin/users/9?tab=links");
    const table = screen.getByRole("table", { name: "Workspaces vinculados" });
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Workspace", "Papel", "Entrada"]);

    const rows = within(table)
      .getAllByRole("row")
      .filter((row) => !row.querySelector('[role="columnheader"]'));
    expect(rows).toHaveLength(2);

    const [cafe, lume] = rows.map((row) => within(row).getAllByRole("cell"));
    expect(cafe[0]).toHaveTextContent("Café Serra Verde");
    expect(cafe[0]).toHaveTextContent("Ativo");
    expect(cafe[1]).toHaveTextContent("Proprietário");
    expect(cafe[1]).not.toHaveTextContent("Permissões personalizadas");
    expect(cafe[2]).toHaveTextContent("10/03/2025");

    expect(lume[0]).toHaveTextContent("Studio Lume Fotografia");
    expect(lume[0]).toHaveTextContent("Suspenso");
    expect(lume[1]).toHaveTextContent("Financeiro");
    expect(lume[1]).toHaveTextContent("Permissões personalizadas");
    // a explicação não fica só num `title`: o "i" ao lado a descreve para teclado e leitor de tela
    expect(within(lume[1]).getByRole("button", { name: "Permissões personalizadas de Bernardo Medeiros Moraes em Studio Lume Fotografia" })).toHaveAccessibleDescription(
      "As permissões deste vínculo sobrescrevem o padrão do papel.",
    );
    expect(lume[2]).toHaveTextContent("02/06/2025");
  });

  it("cada linha abre o workspace", async () => {
    const { router, user } = await renderDetail("/admin/users/9?tab=links");
    const link = screen.getByRole("link", { name: /Studio Lume Fotografia/ });
    expect(link).toHaveAttribute("href", `/admin/workspaces/${WS_LUME}`);
    await user.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/workspaces/${WS_LUME}`));
  });

  it("sem nenhum vínculo: diz isso", async () => {
    server.detail = makeUserDetail({ workspaces: [] });
    await renderDetail("/admin/users/9?tab=links");
    expect(screen.getByText("Sem vínculo com workspaces")).toBeInTheDocument();
  });

  it("papel desconhecido do backend aparece como veio", async () => {
    server.detail = makeUserDetail({ workspaces: [makeLink({ role: "estagiario" as never })] });
    await renderDetail("/admin/users/9?tab=links");
    expect(screen.getByText("estagiario")).toBeInTheDocument();
  });
});

describe("detalhe do usuário: aba Sessões", () => {
  it("quantas, a última sessão (aproximada), onde; a explicação do que é aproximação fica no \"i\", sem parágrafo", async () => {
    await renderDetail("/admin/users/9?tab=sessions");
    const block = screen.getByRole("region", { name: "Sessões" });
    expect(valueOf(block, "Sessões ativas")).toHaveTextContent("2");
    expect(valueOf(block, "Última sessão usada")).toHaveTextContent("aprox. 31/10/2026 09:00");
    expect(valueOf(block, "Última sessão usada")).toHaveTextContent("há 3 horas");
    expect(valueOf(block, "Conectada em")).toHaveTextContent("Backoffice (navegador), App (celular)");
    const info = within(block).getByRole("button", { name: "Como é calculado: Última sessão usada" });
    expect(info).toHaveAccessibleDescription(/±5 minutos/);
    expect(info).toHaveAccessibleDescription(/Quando a pessoa sai do app, a sessão é apagada e a data some\./);
    // o texto longo não fica aberto na aba
    expect(block).not.toHaveTextContent("Como é calculado.");
  });

  it("sem sessão aberta: diz isso e não inventa uma data", async () => {
    server.detail = makeUserDetail({ sessions: { active_count: 0, last_used_at: null, clients: [] } });
    await renderDetail("/admin/users/9?tab=sessions");
    const block = screen.getByRole("region", { name: "Sessões" });
    expect(valueOf(block, "Sessões ativas")).toHaveTextContent("0");
    expect(valueOf(block, "Sessões ativas")).toHaveTextContent("Nenhum login válido agora.");
    expect(valueOf(block, "Última sessão usada")).toHaveTextContent("Nenhuma sessão aberta");
    expect(valueOf(block, "Conectada em")).toHaveTextContent("—");
  });
});

/** Os eventos de uma linha do tempo agrupada por dia (os `li` dos grupos também são `listitem`). */
function timelineItems(scope: HTMLElement): HTMLElement[] {
  return within(scope).getAllByRole("listitem").filter((li) => li.classList.contains("adm-tl-item"));
}

describe("detalhe do usuário: aba Atividade", () => {
  it("busca as duas visões da auditoria: sobre a conta (alvo) e feitas por ela (autor)", async () => {
    await renderDetail("/admin/users/9?tab=activity");
    await screen.findByText("Usuário suspenso");
    expect(mocks.adminList).toHaveBeenCalledWith(
      "/admin/audit-log",
      { target_type: "user", target_id: "9", page: 1, per_page: 10 },
      expect.anything(),
    );
    await waitFor(() =>
      expect(mocks.adminList).toHaveBeenCalledWith("/admin/audit-log", { actor_user_id: 9, page: 1, per_page: 10 }, expect.anything()),
    );
  });

  it("cada ação mostra o que foi feito, a hora (o dia vai no cabeçalho), por quem (com link e e-mail visível) e o motivo", async () => {
    await renderDetail("/admin/users/9?tab=activity");
    const list = await screen.findByRole("list", { name: "Histórico de ações" });
    const item = timelineItems(list)[0];
    expect(within(item).getByText("Usuário suspenso")).toBeInTheDocument();
    // o dia (30/10, "Ontem" para o relógio do teste) é o cabeçalho do grupo; no evento fica só a hora, e o instante inteiro no `title`
    expect(within(list).getByRole("heading", { level: 3, name: "Ontem" })).toBeInTheDocument();
    const time = within(item).getByText("10:30");
    expect(time).toHaveAttribute("datetime", "2026-10-30T13:30:00.000Z");
    expect(time).toHaveAttribute("title", expect.stringContaining("30/10/2026 10:30"));
    expect(within(item).queryByText("30/10/2026 10:30")).not.toBeInTheDocument();
    const actor = within(item).getByRole("link", { name: "Marina Albuquerque" });
    expect(actor).toHaveAttribute("href", "/admin/users/1");
    expect(actor).toHaveClass("adm-textlink");
    // o e-mail de quem agiu é texto da linha de apoio, não um `title` do nome
    expect(actor).not.toHaveAttribute("title");
    expect(within(item).getByText("marina@hype.com")).toBeVisible();
    expect(item).toHaveTextContent("Motivo: Suspeita de acesso indevido à conta");
    expect(item).toHaveTextContent("(administrador)");
  });

  it("os eventos são agrupados por dia no fuso de São Paulo, na ordem da API", async () => {
    server.target = [
      makeAuditEntry({ id: 1, created_at: "2026-10-31T13:00:00.000Z", action_label: "Sessões encerradas" }),
      // 01:30 UTC de 31/10 ainda é noite de 30/10 em São Paulo (UTC-3): o mesmo dia do evento seguinte
      makeAuditEntry({ id: 2, created_at: "2026-10-31T01:30:00.000Z", action_label: "Conta reativada" }),
      makeAuditEntry({ id: 3, created_at: "2026-10-30T13:30:00.000Z", action_label: "Usuário suspenso" }),
      makeAuditEntry({ id: 4, created_at: "2026-10-28T13:30:00.000Z", action_label: "Conta criada" }),
    ];
    await renderDetail("/admin/users/9?tab=activity");
    const list = await screen.findByRole("list", { name: "Histórico de ações" });
    const headings = within(list).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Hoje", "Ontem", "Quarta-feira, 28 de outubro"]);
    const yesterday = within(list).getByRole("heading", { name: "Ontem" }).closest("li") as HTMLElement;
    expect(timelineItems(yesterday)).toHaveLength(2);
    expect(within(yesterday).getByText("22:30")).toBeInTheDocument();
  });

  it("o histórico é uma linha do tempo do kit; antes e depois ficam recolhidos e abrem sob demanda", async () => {
    const { user } = await renderDetail("/admin/users/9?tab=activity");
    const toggle = await screen.findByRole("button", { name: "Ver detalhes" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const details = document.getElementById(toggle.getAttribute("aria-controls") as string) as HTMLElement;
    expect(details).toHaveAttribute("hidden");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(details).not.toHaveAttribute("hidden");
    const row = within(details).getByText("Status").closest("div") as HTMLElement;
    expect(row).toHaveAttribute("data-changed", "true");
    expect(within(row).getByText("Ativo")).toBeInTheDocument();
    expect(within(row).getByText("Suspenso")).toBeInTheDocument();
    expect(within(row).getByText("para", { exact: false })).toBeInTheDocument();
    expect(details).toHaveTextContent("IP 203.0.113.10");
  });

  it("estados que não são objeto aparecem como JSON; impacto aparece à parte", async () => {
    server.target = [
      makeAuditEntry({ before_state: "antes cru", after_state: ["depois"], impact: { sessions_revoked: 3 } }),
    ];
    const { user } = await renderDetail("/admin/users/9?tab=activity");
    await user.click(await screen.findByRole("button", { name: "Ver detalhes" }));
    expect(screen.getByText('"antes cru"')).toBeInTheDocument();
    expect(screen.getByText(/"depois"/)).toBeInTheDocument();
    expect(screen.getByText("Impacto")).toBeInTheDocument();
    expect(screen.getByText("sessions_revoked")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("ação com IP mas sem estados gravados também abre 'Ver detalhes'; sem nada disso, sem expansor", async () => {
    server.target = [
      makeAuditEntry({ id: 1, before_state: null, after_state: null, impact: null, ip: "203.0.113.7" }),
      makeAuditEntry({ id: 2, before_state: null, after_state: null, impact: null, ip: null }),
    ];
    await renderDetail("/admin/users/9?tab=activity");
    await screen.findAllByText("Usuário suspenso");
    expect(screen.getAllByRole("button", { name: "Ver detalhes" })).toHaveLength(1);
  });

  it("as contagens das duas visões aparecem no seletor", async () => {
    server.target = [makeAuditEntry({ id: 1 }), makeAuditEntry({ id: 2 })];
    server.actor = [makeAuditEntry({ id: 3 }), makeAuditEntry({ id: 4 }), makeAuditEntry({ id: 5 })];
    await renderDetail("/admin/users/9?tab=activity");
    const group = screen.getByRole("group", { name: "Visão do histórico" });
    await waitFor(() => expect(within(group).getByRole("button", { name: /Sobre esta conta/ })).toHaveTextContent("2"));
    await waitFor(() => expect(within(group).getByRole("button", { name: /Feitas por esta pessoa/ })).toHaveTextContent("3"));
  });

  it("'Feitas por esta pessoa' mostra o alvo de cada ação, com link", async () => {
    server.detail = makeUserDetail({ kind: "admin", is_platform_admin: true });
    server.actor = [
      makeAuditEntry({
        id: 10,
        action: "workspace.suspend",
        action_label: "Workspace suspenso",
        actor: { user_id: 9, name: "Bernardo Medeiros Moraes", email: "b@h.com", role: "admin" },
        target: { type: "workspace", id: WS_CAFE, label: "Café Serra Verde" },
        workspace: { id: WS_CAFE, name: "Café Serra Verde" },
        reason: "Inadimplência",
        before_state: { status: "active" },
        after_state: { status: "suspended" },
      }),
      makeAuditEntry({
        id: 11,
        action: "workspace.member.add",
        action_label: "Membro adicionado",
        actor: { user_id: 9, name: "Bernardo Medeiros Moraes", email: "b@h.com", role: "admin" },
        target: { type: "workspace_member", id: "77", label: "Paula Lume" },
        workspace: { id: WS_AURORA, name: "Aurora Beauty Studio" },
        before_state: null,
        after_state: { role: "financeiro" },
      }),
    ];
    const { user } = await renderDetail("/admin/users/9?tab=activity");
    await user.click(screen.getByRole("button", { name: /Feitas por esta pessoa/ }));

    const list = await screen.findByRole("list", { name: "Histórico de ações" });
    const [suspend, member] = timelineItems(list);
    expect(within(suspend).getByText("Workspace suspenso")).toBeInTheDocument();
    expect(suspend).toHaveTextContent("sobre workspace Café Serra Verde");
    expect(within(suspend).getAllByRole("link", { name: "Café Serra Verde" })[0]).toHaveAttribute("href", `/admin/workspaces/${WS_CAFE}`);
    expect(within(member).getByRole("link", { name: "Paula Lume" })).toHaveAttribute("href", "/admin/users/77");
    expect(within(member).getByRole("link", { name: "Aurora Beauty Studio" })).toHaveAttribute("href", `/admin/workspaces/${WS_AURORA}`);
  });

  it("alvo sem identificador navegável aparece só como texto (id de vínculo no formato do mock)", async () => {
    server.actor = [makeAuditEntry({ id: 12, target: { type: "workspace_member", id: `${WS_CAFE}:77`, label: null } })];
    const { user } = await renderDetail("/admin/users/9?tab=activity");
    await user.click(screen.getByRole("button", { name: /Feitas por esta pessoa/ }));
    const item = timelineItems(await screen.findByRole("list", { name: "Histórico de ações" }))[0];
    expect(item).toHaveTextContent(`sobre vínculo de ${WS_CAFE}:77`);
    expect(within(item).queryByRole("link", { name: new RegExp(WS_CAFE) })).not.toBeInTheDocument();
  });

  it("sem ação registrada: o vazio de cada visão diz o que significa", async () => {
    server.target = [];
    server.actor = [];
    const { user } = await renderDetail("/admin/users/9?tab=activity");
    expect(await screen.findByText("Nenhuma ação registrada sobre esta conta")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Feitas por esta pessoa/ }));
    expect(await screen.findByText("Nenhuma ação feita por esta pessoa")).toBeInTheDocument();
  });

  it("erro: motivo em português e 'Tentar de novo'; rota que o servidor ainda não tem também", async () => {
    mocks.adminList.mockRejectedValue(toAdminApiError(404, { message: "Cannot GET /api/backoffice/admin/audit-log" }));
    const { user } = await renderDetail("/admin/users/9?tab=activity");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Recurso indisponível");

    serve();
    await user.click(within(alert).getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByText("Usuário suspenso")).toBeInTheDocument();
  });

  it("carregando: esqueleto com aviso para leitor de tela", async () => {
    mocks.adminList.mockReturnValue(new Promise(() => undefined));
    await renderDetail("/admin/users/9?tab=activity");
    expect(await screen.findByText("Carregando histórico…")).toBeInTheDocument();
  });

  it("muitas ações: pagina de 10 em 10", async () => {
    mocks.adminList.mockImplementation(async (_path: string, params?: Record<string, unknown>) => {
      const page = Number(params?.page ?? 1);
      if (params?.actor_user_id !== undefined) return listResult([], 0, { page, per_page: 10 });
      const rows = Array.from({ length: page === 3 ? 5 : 10 }, (_, i) => makeAuditEntry({ id: page * 100 + i, action_label: `Ação ${page}-${i + 1}` }));
      return listResult(rows, 25, { page, per_page: 10 });
    });
    const { user } = await renderDetail("/admin/users/9?tab=activity");
    expect(await screen.findByText("Ação 1-1")).toBeInTheDocument();
    const pager = screen.getByRole("navigation", { name: "Paginação" });
    expect(pager).toHaveTextContent("1–10 de 25");

    await user.click(within(pager).getByRole("button", { name: "Próxima página" }));
    expect(await screen.findByText("Ação 2-1")).toBeInTheDocument();
    expect(mocks.adminList).toHaveBeenCalledWith(
      "/admin/audit-log",
      { target_type: "user", target_id: "9", page: 2, per_page: 10 },
      expect.anything(),
    );
    expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("11–20 de 25");
  });

  it("trocar de visão volta à primeira página", async () => {
    mocks.adminList.mockImplementation(async (_path: string, params?: Record<string, unknown>) => {
      const page = Number(params?.page ?? 1);
      const rows = Array.from({ length: 10 }, (_, i) => makeAuditEntry({ id: page * 100 + i, action_label: `Ação ${page}-${i + 1}` }));
      return listResult(rows, 25, { page, per_page: 10 });
    });
    const { user } = await renderDetail("/admin/users/9?tab=activity");
    await screen.findByText("Ação 1-1");
    await user.click(within(screen.getByRole("navigation", { name: "Paginação" })).getByRole("button", { name: "Próxima página" }));
    await screen.findByText("Ação 2-1");
    await user.click(screen.getByRole("button", { name: /Feitas por esta pessoa/ }));
    // a outra visão abre na página 1 (e não na 2 em que a anterior estava), com o pager de volta ao começo
    expect(await screen.findByText("Ação 1-1")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("1–10 de 25");
    expect(mocks.adminList.mock.calls.filter((call) => call[1]?.actor_user_id === 9).every((call) => call[1].page === 1)).toBe(true);
  });
});

describe("detalhe do usuário: quais ações a conta aceita", () => {
  it("conta ativa com sessão: Encerrar sessões e Suspender (não Reativar) à vista, 'Mais' com a exclusão e sem aviso", async () => {
    await renderDetail();
    expect(actionButtons()).toEqual(["Encerrar sessões", "Suspender"]);
    expect(within(pageHeader()).getByRole("button", { name: "Mais" })).toBeInTheDocument();
    expect(screen.queryByText(/Esta é a sua conta/)).not.toBeInTheDocument();
    expect(screen.queryByText(/administradora da plataforma:/)).not.toBeInTheDocument();
  });

  it("conta ativa sem sessão aberta: só Suspender (não há o que encerrar)", async () => {
    server.detail = makeUserDetail({ sessions: { active_count: 0, last_used_at: null, clients: [] } });
    await renderDetail();
    expect(actionButtons()).toEqual(["Suspender"]);
  });

  it("conta suspensa: só Reativar", async () => {
    server.detail = makeSuspendedDetail();
    await renderDetail();
    expect(actionButtons()).toEqual(["Reativar"]);
  });

  it("administrador da plataforma: nenhuma ação, só a explicação", async () => {
    server.detail = makeUserDetail({ kind: "admin", is_platform_admin: true });
    await renderDetail();
    expect(actionButtons()).toEqual([]);
    expect(screen.getByText(/Esta pessoa é administradora da plataforma: o servidor não permite suspender a conta nem encerrar as sessões de outro administrador\./)).toBeInTheDocument();
    // o aviso fica abaixo do cabeçalho, não no meio dos botões
    expect(within(pageHeader()).queryByText(/o servidor não permite suspender/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mais" })).not.toBeInTheDocument();
  });

  it("a própria conta: nenhuma ação, só a explicação (mesmo sendo administrador)", async () => {
    mocks.auth.user = { id: 9, name: "Bernardo Medeiros Moraes", is_platform_admin: true, platform_role: "admin" };
    server.detail = makeUserDetail({ kind: "admin", is_platform_admin: true });
    await renderDetail();
    expect(actionButtons()).toEqual([]);
    expect(screen.getByText(/Esta é a sua conta: por segurança, você não pode suspendê-la nem encerrar as suas sessões por aqui\./)).toBeInTheDocument();
    expect(screen.queryByText(/administradora da plataforma:/)).not.toBeInTheDocument();
  });

  it("a própria conta, sendo de marca: também nenhuma ação", async () => {
    mocks.auth.user = { id: 9, name: "Bernardo Medeiros Moraes", is_platform_admin: true, platform_role: "admin" };
    await renderDetail();
    expect(actionButtons()).toEqual([]);
    expect(screen.getByText(/Esta é a sua conta/)).toBeInTheDocument();
  });

  it("conta excluída: nenhuma ação, só a explicação", async () => {
    server.detail = makeUserDetail({ status: "deleted", deleted_at: "2026-09-01T15:00:00.000Z" });
    await renderDetail();
    expect(actionButtons()).toEqual([]);
    expect(screen.getByText("Conta excluída: não há ações disponíveis.")).toBeInTheDocument();
  });

  it("sem o usuário logado carregado, as ações aparecem e o servidor decide (CANNOT_ACT_ON_SELF é traduzido)", async () => {
    mocks.auth.user = null;
    await renderDetail();
    expect(actionButtons()).toEqual(["Encerrar sessões", "Suspender"]);
  });
});

describe("detalhe do usuário: suspender", () => {
  async function openSuspend() {
    const ctx = await renderDetail();
    await ctx.user.click(screen.getByRole("button", { name: "Suspender" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Suspender Bernardo Medeiros Moraes" });
    return { ...ctx, dialog };
  }
  const confirm = () => screen.getByRole("button", { name: "Suspender conta" });

  it("o diálogo explica o que acontece e pede o motivo (5 a 500 caracteres)", async () => {
    const { dialog } = await openSuspend();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("Usuário · bernardo@cafeserraverde.com.br")).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription(/A conta fica bloqueada até que alguém a reative\./);
    expect(dialog).toHaveTextContent("Bernardo Medeiros Moraes não consegue mais entrar na plataforma, em nenhum workspace.");
    expect(dialog).toHaveTextContent("As 2 sessões abertas deixam de funcionar: na próxima ação a pessoa é desconectada.");
    expect(dialog).toHaveTextContent("Nada é apagado: os dados e os vínculos com workspaces continuam como estão.");
    expect(dialog).toHaveTextContent("Você pode reativar a conta depois.");
    expect(dialog).toHaveTextContent("A ação fica registrada no histórico da conta, com o seu nome e o motivo.");
    expect(within(dialog).getByLabelText(/Motivo/)).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
  });

  it("com uma só sessão aberta o texto concorda no singular; sem sessão diz que não há", async () => {
    server.detail = makeUserDetail({ sessions: { active_count: 1, last_used_at: ago(HOUR), clients: ["backoffice"] } });
    const first = await openSuspend();
    expect(first.dialog).toHaveTextContent("A sessão aberta deixa de funcionar: na próxima ação a pessoa é desconectada.");
    first.unmount();

    server.detail = makeUserDetail({ sessions: { active_count: 0, last_used_at: null, clients: [] } });
    const second = await openSuspend();
    expect(second.dialog).toHaveTextContent("Não há sessão aberta agora.");
  });

  it("o botão só habilita com motivo de 5 a 500 caracteres (espaços nas pontas não contam)", async () => {
    const { user, dialog } = await openSuspend();
    const reason = within(dialog).getByLabelText(/Motivo/);

    await user.type(reason, "abcd");
    expect(confirm()).toBeDisabled();
    await user.clear(reason);
    await user.type(reason, "     ab     ");
    expect(confirm()).toBeDisabled();
    await user.clear(reason);
    await user.type(reason, "  abcde  ");
    expect(confirm()).toBeEnabled();

    // o limite de 500 vale na digitação
    expect(reason).toHaveAttribute("maxlength", "500");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mocks.adminPost).not.toHaveBeenCalled();
  });

  it("confirma: envia o motivo aparado e uma Idempotency-Key, fecha, atualiza a tela e avisa", async () => {
    mocks.adminPost.mockImplementation(async () => {
      server.detail = makeSuspendedDetail();
      return server.detail;
    });
    const { user, dialog } = await openSuspend();
    await user.type(within(dialog).getByLabelText(/Motivo/), "  Suspeita de fraude  ");
    await user.click(confirm());

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.adminPost).toHaveBeenCalledTimes(1);
    const [path, body, options] = mocks.adminPost.mock.calls[0];
    expect(path).toBe("/admin/users/9/suspend");
    expect(body).toEqual({ reason: "Suspeita de fraude" });
    expect(options.idempotencyKey).toMatch(UUID_V4);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Conta suspensa.", expect.anything());

    // a tela já mostra a conta como suspensa, com o bloco da suspensão e a ação de reativar
    expect(within(pageHeader()).getByText("Suspenso")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Conta suspensa" })).toBeInTheDocument();
    expect(actionButtons()).toEqual(["Reativar"]);
  });

  it("enquanto grava: tudo travado e o botão diz 'Suspendendo…'", async () => {
    mocks.adminPost.mockReturnValue(new Promise(() => undefined));
    const { user, dialog } = await openSuspend();
    await user.type(within(dialog).getByLabelText(/Motivo/), "Suspeita de fraude");
    await user.click(confirm());
    expect(await screen.findByRole("button", { name: "Suspendendo…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(mocks.adminPost).toHaveBeenCalledTimes(1);
  });

  it("a mesma ação repetida depois de uma falha de rede usa a MESMA chave; motivo diferente, chave nova", async () => {
    mocks.adminPost
      .mockRejectedValueOnce(new AdminApiError({ status: 0, code: "NETWORK_ERROR", message: "Não foi possível falar com o servidor. Verifique a conexão e tente de novo." }))
      .mockRejectedValueOnce(new AdminApiError({ status: 0, code: "NETWORK_ERROR", message: "Não foi possível falar com o servidor. Verifique a conexão e tente de novo." }))
      .mockResolvedValueOnce(makeSuspendedDetail());
    const { user, dialog } = await openSuspend();
    const reason = within(dialog).getByLabelText(/Motivo/);
    await user.type(reason, "Suspeita de fraude");

    await user.click(confirm());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Não foi possível falar com o servidor");
    await user.click(confirm());
    await waitFor(() => expect(mocks.adminPost).toHaveBeenCalledTimes(2));
    await within(dialog).findByRole("alert");

    await user.type(reason, " e mais um detalhe");
    await user.click(confirm());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    const keys = mocks.adminPost.mock.calls.map((call) => call[2].idempotencyKey as string);
    expect(keys).toHaveLength(3);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("CANNOT_ACT_ON_PLATFORM_ADMIN: o diálogo continua aberto com a explicação em português", async () => {
    mocks.adminPost.mockRejectedValue(toAdminApiError(409, { message: "Cannot act on platform admin", error: "CANNOT_ACT_ON_PLATFORM_ADMIN" }));
    const { user, dialog } = await openSuspend();
    await user.type(within(dialog).getByLabelText(/Motivo/), "Suspeita de fraude");
    await user.click(confirm());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Esta pessoa é administradora da plataforma: não é possível suspender a conta de outro administrador.",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(confirm()).toBeEnabled();
  });

  it("CANNOT_ACT_ON_SELF: explica e busca o detalhe de novo (a tela estava velha)", async () => {
    mocks.adminPost.mockRejectedValue(toAdminApiError(409, { message: "x", error: "CANNOT_ACT_ON_SELF" }));
    const { user, dialog } = await openSuspend();
    await user.type(within(dialog).getByLabelText(/Motivo/), "Suspeita de fraude");
    mocks.adminGet.mockClear();
    await user.click(confirm());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Você não pode suspender a sua própria conta.");
    await waitFor(() => expect(mocks.adminGet).toHaveBeenCalledWith("/admin/users/9", undefined, expect.anything()));
  });

  it("INVALID_STATE_TRANSITION: traduz e mostra por baixo o estado de agora", async () => {
    mocks.adminPost.mockImplementation(async () => {
      // outra pessoa suspendeu antes
      server.detail = makeSuspendedDetail();
      throw toAdminApiError(409, { message: "Só é possível suspender um usuário ativo.", error: "INVALID_STATE_TRANSITION" });
    });
    const { user, dialog } = await openSuspend();
    await user.type(within(dialog).getByLabelText(/Motivo/), "Suspeita de fraude");
    await user.click(confirm());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Só é possível suspender uma conta ativa. O estado desta conta mudou: confira os dados na tela.",
    );
    await waitFor(() => expect(within(pageHeader()).getByText("Suspenso")).toBeInTheDocument());
  });

  it("validação do servidor (lista de mensagens em inglês): vira frases em português", async () => {
    mocks.adminPost.mockRejectedValue(
      toAdminApiError(400, { message: ["reason must be longer than or equal to 5 characters", "reason should not be empty"], error: "Bad Request" }),
    );
    const { user, dialog } = await openSuspend();
    await user.type(within(dialog).getByLabelText(/Motivo/), "Suspeita de fraude");
    await user.click(confirm());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("O motivo precisa ter pelo menos 5 caracteres. Informe o motivo.");
  });

  it("conta que sumiu (NOT_FOUND) e ação que o servidor ainda não tem (ENDPOINT_UNAVAILABLE)", async () => {
    mocks.adminPost.mockRejectedValueOnce(toAdminApiError(404, { message: "Usuário não encontrado." }));
    const { user, dialog } = await openSuspend();
    await user.type(within(dialog).getByLabelText(/Motivo/), "Suspeita de fraude");
    await user.click(confirm());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Não encontramos esta conta. Ela pode ter sido removida.");

    mocks.adminPost.mockRejectedValueOnce(toAdminApiError(404, { message: "Cannot POST /api/backoffice/admin/users/9/suspend" }));
    await user.click(confirm());
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Esta ação ainda não está disponível no servidor."));
  });

  it("ACCOUNT_SUSPENDED (a sessão de quem está agindo): avisa que a própria conta foi suspensa", async () => {
    mocks.adminPost.mockRejectedValue(toAdminApiError(403, { message: "Conta suspensa", error: "ACCOUNT_SUSPENDED" }));
    const { user, dialog } = await openSuspend();
    await user.type(within(dialog).getByLabelText(/Motivo/), "Suspeita de fraude");
    await user.click(confirm());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("A sua conta foi suspensa. Entre novamente para continuar.");
  });

  it("erro de servidor: texto padrão, sem detalhe técnico", async () => {
    mocks.adminPost.mockRejectedValue(toAdminApiError(500, { message: "QueryFailedError: relation users does not exist" }));
    const { user, dialog } = await openSuspend();
    await user.type(within(dialog).getByLabelText(/Motivo/), "Suspeita de fraude");
    await user.click(confirm());
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("O servidor teve um problema. Tente novamente em instantes.");
    expect(alert).not.toHaveTextContent("QueryFailedError");
  });
});

describe("detalhe do usuário: reativar", () => {
  it("diálogo neutro, envia o motivo e atualiza a tela", async () => {
    server.detail = makeSuspendedDetail();
    mocks.adminPost.mockImplementation(async () => {
      server.detail = makeUserDetail({ sessions: { active_count: 0, last_used_at: null, clients: [] } });
      return server.detail;
    });
    const { user } = await renderDetail();
    await user.click(screen.getByRole("button", { name: "Reativar" }));

    const dialog = await screen.findByRole("dialog", { name: "Reativar Bernardo Medeiros Moraes" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent("volta a poder entrar com o e-mail e a senha de sempre.");
    expect(dialog).toHaveTextContent("As sessões encerradas na suspensão não voltam: a pessoa precisa entrar de novo.");
    expect(screen.getByRole("button", { name: "Reativar conta" })).not.toHaveClass("dng");

    await user.type(within(dialog).getByLabelText(/Motivo/), "Acesso regularizado");
    await user.click(screen.getByRole("button", { name: "Reativar conta" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [path, body, options] = mocks.adminPost.mock.calls[0];
    expect(path).toBe("/admin/users/9/reactivate");
    expect(body).toEqual({ reason: "Acesso regularizado" });
    expect(options.idempotencyKey).toMatch(UUID_V4);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Conta reativada.", expect.anything());
    expect(within(pageHeader()).getByText("Ativo")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Conta suspensa" })).not.toBeInTheDocument();
    expect(actionButtons()).toEqual(["Suspender"]);
  });

  it("INVALID_STATE_TRANSITION ao reativar: texto próprio da ação", async () => {
    server.detail = makeSuspendedDetail();
    mocks.adminPost.mockRejectedValue(toAdminApiError(409, { message: "x", error: "INVALID_STATE_TRANSITION" }));
    const { user } = await renderDetail();
    await user.click(screen.getByRole("button", { name: "Reativar" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Motivo/), "Acesso regularizado");
    await user.click(screen.getByRole("button", { name: "Reativar conta" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Só é possível reativar uma conta suspensa. O estado desta conta mudou: confira os dados na tela.",
    );
  });
});

describe("detalhe do usuário: encerrar sessões", () => {
  it("o diálogo diz quantas sessões e onde; confirma com motivo e atualiza a tela", async () => {
    mocks.adminPost.mockImplementation(async () => {
      server.detail = makeUserDetail({ sessions: { active_count: 0, last_used_at: null, clients: [] } });
      return server.detail;
    });
    const { user } = await renderDetail();
    await user.click(screen.getByRole("button", { name: "Encerrar sessões" }));

    const dialog = await screen.findByRole("dialog", { name: "Encerrar sessões de Bernardo Medeiros Moraes" });
    expect(dialog).toHaveTextContent("As 2 sessões abertas — Backoffice (navegador) e App (celular) — serão encerradas agora.");
    expect(dialog).toHaveTextContent("A conta continua ativa: a pessoa pode entrar de novo quando quiser.");

    await user.type(within(dialog).getByLabelText(/Motivo/), "Computador compartilhado");
    await user.click(within(dialog).getByRole("button", { name: "Encerrar todas as sessões" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [path, body, options] = mocks.adminPost.mock.calls[0];
    expect(path).toBe("/admin/users/9/revoke-sessions");
    expect(body).toEqual({ reason: "Computador compartilhado" });
    expect(options.idempotencyKey).toMatch(UUID_V4);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Sessões encerradas.", expect.anything());

    // sem sessão, não há mais o que encerrar: o botão some e a aba mostra zero
    expect(actionButtons()).toEqual(["Suspender"]);
    expect(within(screen.getByRole("tablist")).getByRole("tab", { name: /Sessões/ })).toHaveTextContent("0");
  });

  it("uma sessão só, num só lugar: o texto concorda", async () => {
    server.detail = makeUserDetail({ sessions: { active_count: 1, last_used_at: ago(HOUR), clients: ["mobile-app"] } });
    const { user } = await renderDetail();
    await user.click(screen.getByRole("button", { name: "Encerrar sessões" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("A sessão aberta — App (celular) — será encerrada agora.");
  });

  it("Cancelar e Esc fecham sem enviar nada", async () => {
    const { user } = await renderDetail();
    await user.click(screen.getByRole("button", { name: "Encerrar sessões" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Encerrar sessões" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.adminPost).not.toHaveBeenCalled();
  });
});

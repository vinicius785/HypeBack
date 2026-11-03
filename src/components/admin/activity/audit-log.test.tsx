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

import { CAFE_WORKSPACE_DETAIL, CAFE_WORKSPACE_ITEM, feedPage, listPage } from "@/components/admin/financial/financial-fixtures";
import { AdminApiError } from "@/lib/admin/admin-client";
import { currentSearch } from "@/test/render-admin-route";

import { WORKSPACE_ID, makeAuditEntry } from "./activity-fixtures";
import { renderActivity } from "./activity-test-support";

const NOW = new Date("2026-10-31T15:00:00.000Z");

function auditCalls() {
  return client.adminList.mock.calls.filter(([path]) => path === "/admin/audit-log");
}

function lastQuery(): Record<string, unknown> {
  return auditCalls().at(-1)?.[1] as Record<string, unknown>;
}

async function openChanges(url = "/admin/activity?tab=changes") {
  const view = renderActivity(url);
  const table = await screen.findByRole("table", { name: "Alterações administrativas" });
  // a tabela existe já no esqueleto: as linhas só depois da primeira resposta
  await waitFor(() => expect(table).not.toHaveAttribute("aria-busy", "true"));
  return { ...view, table };
}

function entryRows(table: HTMLElement) {
  return within(table).getAllByRole("row").slice(1);
}

const SUSPEND = makeAuditEntry();
const MEMBER = makeAuditEntry({
  id: 40,
  created_at: "2026-10-28T10:00:00.000Z",
  action: "workspace.member.role_change",
  action_label: "Papel do membro alterado",
  actor: { user_id: null, name: null, email: null, role: "admin" },
  target: { type: "workspace_member", id: `${WORKSPACE_ID}:1002`, label: "Vanessa Mendes" },
  reason: "Pedido do cliente por e-mail",
  before_state: { role: "viewer" },
  after_state: { role: "admin" },
  ip: null,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  client.adminGet.mockReset();
  client.adminList.mockReset();
  client.adminFeed.mockReset();
  // o seletor de workspace e o de autor de verdade: a busca e o nome de um id da URL
  client.adminGet.mockImplementation(async (path: string) => (path.startsWith("/admin/workspaces/") ? CAFE_WORKSPACE_DETAIL : { id: 7, name: "Marina Admin" }));
  client.adminFeed.mockImplementation(async () => feedPage([]));
  client.adminList.mockImplementation(async (path: string) => {
    if (path === "/admin/audit-log") return listPage([SUSPEND, MEMBER]);
    if (path === "/admin/workspaces") return listPage([CAFE_WORKSPACE_ITEM]);
    return listPage([]);
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Alterações administrativas: abas e consulta", () => {
  it("a aba da URL abre o log com página, período e nenhum filtro na consulta", async () => {
    await openChanges();
    expect(await screen.findByRole("tab", { name: "Alterações administrativas", selected: true })).toBeInTheDocument();
    expect(lastQuery()).toEqual({ page: 1, per_page: 25, from: "2026-10-02", to: "2026-10-31" });
  });

  it("trocar de aba leva o período e muda a visão (e a URL)", async () => {
    const { router } = renderActivity("/admin/activity?from=2026-10-20&to=2026-10-25");
    await screen.findByRole("heading", { name: "Linha do tempo" });
    await userEvent.click(screen.getByRole("tab", { name: "Alterações administrativas" }));
    expect(await screen.findByRole("table", { name: "Alterações administrativas" })).toBeInTheDocument();
    await waitFor(() => expect(lastQuery()).toMatchObject({ from: "2026-10-20", to: "2026-10-25" }));
    expect(currentSearch(router)).toMatchObject({ tab: "changes", from: "2026-10-20", to: "2026-10-25" });

    await userEvent.click(screen.getByRole("tab", { name: "Atividade" }));
    await screen.findByRole("heading", { name: "Linha do tempo" });
    expect(currentSearch(router)).not.toHaveProperty("tab");
  });

  it("um filtro só do log na URL (sem aba) abre a visão do log", async () => {
    await openChanges("/admin/activity?action=workspace.suspend");
    expect(lastQuery()).toMatchObject({ action: "workspace.suspend" });
  });

  it("os filtros vão para a API: ação, alvo, workspace e autor", async () => {
    const { router } = await openChanges();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Ação" }), "workspace.suspend");
    await waitFor(() => expect(lastQuery()).toMatchObject({ action: "workspace.suspend", page: 1 }));

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Alvo" }), "workspace");
    await waitFor(() => expect(lastQuery()).toMatchObject({ target_type: "workspace", action: "workspace.suspend" }));

    await userEvent.click(screen.getByRole("button", { name: /^Workspace:/ }));
    await userEvent.click(await screen.findByRole("option", { name: /Café Serra Verde/ }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ workspace_id: CAFE_WORKSPACE_ITEM.id }));
    expect(currentSearch(router)).toMatchObject({ tab: "changes", action: "workspace.suspend", target_type: "workspace" });
  });

  it("o autor é escolhido numa busca de usuários (mesmo parâmetro da URL) e vira chip", async () => {
    client.adminList.mockImplementation(async (path: string) => {
      if (path === "/admin/audit-log") return listPage([SUSPEND, MEMBER]);
      if (path === "/admin/users") return listPage([{ id: 7, name: "Marina Admin", email: "marina@hype.test", kind: "brand", is_platform_admin: true }]);
      return listPage([]);
    });
    const { router } = await openChanges();
    expect(screen.getByRole("button", { name: /^Autor:/ })).toHaveTextContent("Qualquer pessoa");
    await userEvent.click(screen.getByRole("button", { name: /^Autor:/ }));
    expect(client.adminList).toHaveBeenCalledWith("/admin/users", expect.objectContaining({ kind: "brand", status: "all", sort_by: "name" }), expect.anything());
    await userEvent.click(await screen.findByRole("option", { name: /Marina Admin/ }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ actor_user_id: "7", page: 1 }));
    expect(currentSearch(router)).toMatchObject({ tab: "changes", actor_user_id: "7" });
    expect(screen.getByRole("button", { name: /^Autor:/ })).toHaveTextContent("Marina Admin");

    await userEvent.click(screen.getByRole("button", { name: "Remover filtro Autor: Marina Admin" }));
    await waitFor(() => expect(lastQuery().actor_user_id).toBeUndefined());
    expect(currentSearch(router)).toEqual({ tab: "changes" });
  });

  it("o chip do autor recém-escolhido já traz o nome: não busca o usuário nem mostra 'Carregando…'", async () => {
    client.adminList.mockImplementation(async (path: string) => {
      if (path === "/admin/audit-log") return listPage([SUSPEND, MEMBER]);
      if (path === "/admin/users") return listPage([{ id: 7, name: "Marina Admin", email: "marina@hype.test", kind: "brand", is_platform_admin: true }]);
      return listPage([]);
    });
    const { router } = await openChanges();
    await userEvent.click(screen.getByRole("button", { name: /^Autor:/ }));
    await userEvent.click(await screen.findByRole("option", { name: /Marina Admin/ }));
    // o chip aparece com o nome na primeira renderização com o id novo
    expect(screen.getByRole("button", { name: "Remover filtro Autor: Marina Admin" })).toBeInTheDocument();
    await waitFor(() => expect(currentSearch(router)).toMatchObject({ actor_user_id: "7" }));
    expect(screen.queryByText(/Carregando…/)).not.toBeInTheDocument();
    expect(client.adminGet).not.toHaveBeenCalledWith("/admin/users/7", expect.anything(), expect.anything());
    expect(client.adminGet.mock.calls.some(([path]) => String(path).startsWith("/admin/users/"))).toBe(false);
  });

  it("a opção de autor diz o e-mail e quem é administrador da plataforma", async () => {
    client.adminList.mockImplementation(async (path: string) =>
      path === "/admin/users"
        ? listPage([{ id: 7, name: "Marina Admin", email: "marina@hype.test", kind: "brand", is_platform_admin: true }])
        : path === "/admin/audit-log"
          ? listPage([SUSPEND])
          : listPage([]),
    );
    await openChanges();
    await userEvent.click(screen.getByRole("button", { name: /^Autor:/ }));
    const option = await screen.findByRole("option", { name: /Marina Admin/ });
    expect(option).toHaveTextContent("marina@hype.test · Administrador da plataforma");
  });

  it("uma só barra de filtros (workspace e autor na linha dela) e 'Limpar filtros' zera tudo menos o período", async () => {
    const { container, router } = await openChanges(
      `/admin/activity?tab=changes&action=workspace.suspend&target_type=workspace&actor_user_id=7&workspace_id=${CAFE_WORKSPACE_ITEM.id}&from=2026-10-20&to=2026-10-25`,
    );
    expect(container.querySelectorAll(".adm-filters")).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Autor:/ })).toHaveTextContent("Marina Admin"));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Workspace:/ })).toHaveTextContent("Café Serra Verde"));
    // filtros ligados: ação, alvo, workspace e autor (cada um com o seu chip)
    expect(screen.getByRole("group", { name: "Filtros ativos" }).querySelectorAll("button")).toHaveLength(4);

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(currentSearch(router)).toEqual({ tab: "changes", from: "2026-10-20", to: "2026-10-25" }));
    expect(lastQuery()).toEqual({ page: 1, per_page: 25, from: "2026-10-20", to: "2026-10-25" });
  });

  it("autor e registro específico vindos da URL entram na consulta", async () => {
    await openChanges(`/admin/activity?tab=changes&actor_user_id=7&target_type=user&target_id=1002`);
    expect(lastQuery()).toMatchObject({ actor_user_id: "7", target_type: "user", target_id: "1002" });
    await waitFor(() => expect(screen.getByRole("button", { name: /^Autor:/ })).toHaveTextContent("Marina Admin"));
    expect(client.adminGet.mock.calls.some(([path]) => path === "/admin/users/7")).toBe(true);
    // o alvo específico (link de outra tela) aparece como filtro ativo, com "×"
    expect(screen.getByRole("button", { name: "Remover filtro Registro: 1002" })).toBeInTheDocument();
  });

  it("trocar o período volta para a página 1", async () => {
    await openChanges("/admin/activity?tab=changes&page=3");
    client.adminList.mockImplementation(async () => listPage([SUSPEND], { page: 3, total: 60, total_pages: 3 }));
    const period = screen.getByRole("group", { name: "Período" });
    await userEvent.click(within(period).getByRole("button", { name: "7 dias" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 1, from: "2026-10-25", to: "2026-10-31" }));
  });

  it("paginação: próxima página e itens por página vão para a API", async () => {
    client.adminList.mockImplementation(async () => listPage([SUSPEND, MEMBER], { total: 120, total_pages: 5 }));
    const { router } = await openChanges();
    expect(await screen.findByText(/de 120/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(lastQuery().page).toBe(2));
    expect(currentSearch(router)).toMatchObject({ tab: "changes", page: 2 });

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Itens por página" }), "50");
    await waitFor(() => expect(lastQuery()).toMatchObject({ per_page: 50, page: 1 }));
  });
});

describe("Alterações administrativas: lista e detalhe", () => {
  it("cada alteração mostra a ação em destaque, o alvo, o autor, o motivo e a data em coluna fixa, ainda fechada", async () => {
    const { table } = await openChanges();
    await screen.findByText("Workspace suspenso", { selector: "b" });
    const [suspend, member] = entryRows(table);

    // a ação é o texto em destaque; o alvo vem logo abaixo, em apoio
    expect(within(suspend).getByText("Workspace suspenso").tagName).toBe("B");
    expect(within(suspend).getByText("Café Serra Verde")).toBeInTheDocument();
    expect(within(suspend).getByText("Marina Admin")).toBeInTheDocument();
    expect(within(suspend).getByText("Cobrança contestada, aguardando análise")).toBeInTheDocument();
    // 18:20 em UTC é 15:20 em São Paulo
    expect(suspend.querySelector("time")).toHaveAttribute("datetime", "2026-10-29T18:20:00.000Z");
    expect(within(suspend).getByText("29/10/2026")).toBeInTheDocument();
    expect(within(suspend).getByText("15:20")).toBeInTheDocument();
    expect(within(suspend).getByRole("button", { name: /^Detalhes: Workspace suspenso/, expanded: false })).toBeInTheDocument();
    // workspace que não está no nome do alvo entra no apoio; autor removido: nunca "null"
    expect(within(member).getByText("Vanessa Mendes · Café Serra Verde")).toBeInTheDocument();
    expect(within(member).getByText("Usuário removido")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Detalhes: Workspace suspenso/ })).not.toBeInTheDocument();
  });

  it("as colunas têm nome em frase normal (Alteração, Feito por, Motivo, Quando)", async () => {
    const { table } = await openChanges();
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Alteração", "Feito por", "Motivo", "Quando"]);
  });

  it("abrir mostra o motivo, o alvo, quem fez, o IP e o antes e depois campo a campo (sem JSON cru)", async () => {
    const { table } = await openChanges();
    await screen.findByText("Workspace suspenso", { selector: "b" });
    const expand = within(entryRows(table)[0]).getByRole("button", { name: /^Detalhes: Workspace suspenso/ });
    await userEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "true");

    const body = within(table).getByRole("region", { name: "Detalhes: Workspace suspenso" });
    expect(within(body).getByText("203.0.113.9")).toBeInTheDocument();
    expect(within(body).getByText("Alteração nº 41")).toBeInTheDocument();
    expect(within(body).getByText("marina@hype.test · Administrador", { exact: false })).toBeInTheDocument();
    // o alvo e o workspace são o mesmo aqui: dois links para o mesmo detalhe
    const links = within(body).getAllByRole("link", { name: "Café Serra Verde" });
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute("href", `/admin/workspaces/${WORKSPACE_ID}`));

    const diff = within(body).getByRole("table", { name: "O que mudou" });
    const row = within(diff).getByRole("rowheader", { name: "Status" }).closest("[role=row]") as HTMLElement;
    expect(within(row).getByText("Ativo")).toBeInTheDocument();
    expect(within(row).getByText("Suspenso")).toBeInTheDocument();
    expect(body.textContent).not.toMatch(/[{}]|undefined|null/);

    await userEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(within(table).queryByRole("region", { name: "Detalhes: Workspace suspenso" })).not.toBeInTheDocument();
  });

  it("o antes e depois é uma tabela com semântica completa: cabeçalhos de coluna, grupos de linhas e cabeçalho de linha", async () => {
    const { table } = await openChanges();
    await screen.findByText("Workspace suspenso", { selector: "b" });
    await userEvent.click(within(entryRows(table)[0]).getByRole("button", { name: /^Detalhes: Workspace suspenso/ }));
    const diff = within(table).getByRole("table", { name: "O que mudou" });
    expect(within(diff).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Campo", "Antes", "Depois"]);
    expect(within(diff).getAllByRole("rowgroup")).toHaveLength(2);
    expect(within(diff).getAllByRole("rowheader")).toHaveLength(1);
    expect(within(diff).getAllByRole("cell")).toHaveLength(2);
  });

  it("sem IP registrado diz isso, e o link do membro leva ao usuário afetado", async () => {
    const { table } = await openChanges();
    await screen.findByText("Papel do membro alterado", { selector: "b" });
    await userEvent.click(within(entryRows(table)[1]).getByRole("button", { name: /^Detalhes: Papel do membro alterado/ }));
    const body = within(table).getByRole("region", { name: "Detalhes: Papel do membro alterado" });
    expect(within(body).getByText("Não registrado")).toBeInTheDocument();
    expect(within(body).getByRole("link", { name: "Vanessa Mendes" })).toHaveAttribute("href", "/admin/users/1002");
  });

  it("mostra o impacto registrado quando há, e avisa quando a ação não registrou campos", async () => {
    client.adminList.mockImplementation(async (path: string) =>
      path === "/admin/audit-log"
        ? listPage([makeAuditEntry({ before_state: null, after_state: null, impact: { counts: { campaigns_active: 3 } } })])
        : listPage([]),
    );
    const { table } = await openChanges();
    await userEvent.click(await within(table).findByRole("button", { name: /^Detalhes: Workspace suspenso/ }));
    expect(screen.getByText("Esta ação não registrou campos alterados.")).toBeInTheDocument();
    const impact = screen.getByRole("region", { name: "Impacto no momento da ação" });
    expect(within(impact).getByText("3")).toBeInTheDocument();
  });
});

describe("Alterações administrativas: estados", () => {
  it("carregando: esqueleto", async () => {
    client.adminList.mockReturnValue(new Promise(() => {}));
    const { container } = renderActivity("/admin/activity?tab=changes");
    await waitFor(() => expect(container.querySelectorAll(".adm-row .adm-sk").length).toBeGreaterThan(0));
    expect(screen.getByRole("table", { name: "Alterações administrativas" })).toHaveAttribute("aria-busy", "true");
  });

  it("vazio com filtro oferece limpar os filtros", async () => {
    client.adminList.mockResolvedValue(listPage([]));
    const { router } = await openChanges("/admin/activity?tab=changes&action=user.merge");
    expect(await screen.findByText("Nenhuma alteração com estes filtros")).toBeInTheDocument();
    // a barra tem o seu "Limpar filtros" e o estado vazio, o dele: os dois fazem o mesmo
    expect(screen.getAllByRole("button", { name: "Limpar filtros" })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" }).at(-1)!);
    await waitFor(() => expect(currentSearch(router)).not.toHaveProperty("action"));
  });

  it("vazio sem filtro sugere um período maior", async () => {
    client.adminList.mockResolvedValue(listPage([]));
    await openChanges();
    expect(await screen.findByText("Nenhuma alteração no período")).toBeInTheDocument();
  });

  it("recurso ainda não disponível no servidor, com tentar de novo", async () => {
    client.adminList.mockRejectedValueOnce(
      new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "Este recurso ainda não está disponível no servidor." }),
    );
    renderActivity("/admin/activity?tab=changes");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Recurso indisponível")).toBeInTheDocument();
    await userEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Workspace suspenso", { selector: "b" })).toBeInTheDocument();
  });
});

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

vi.mock("@/components/admin/users/admin-workspace-picker", async () => ({
  AdminWorkspacePicker: (await import("@/components/admin/financial/workspace-picker-stub")).WorkspacePickerStub,
}));

import { feedPage, listPage } from "@/components/admin/financial/financial-fixtures";
import { PICKED_WORKSPACE } from "@/components/admin/financial/workspace-picker-stub";
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
  await screen.findByRole("heading", { name: "Alterações administrativas" });
  return view;
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
  client.adminGet.mockResolvedValue({ id: 7, name: "Marina Admin" });
  client.adminFeed.mockImplementation(async () => feedPage([]));
  client.adminList.mockImplementation(async (path: string) =>
    path === "/admin/audit-log" ? listPage([SUSPEND, MEMBER]) : listPage([]),
  );
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
    expect(await screen.findByRole("heading", { name: "Alterações administrativas" })).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole("button", { name: "Escolher workspace" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ workspace_id: PICKED_WORKSPACE.id }));
    expect(currentSearch(router)).toMatchObject({ tab: "changes", action: "workspace.suspend", target_type: "workspace" });
  });

  it("autor e registro específico vindos da URL entram na consulta", async () => {
    await openChanges(`/admin/activity?tab=changes&actor_user_id=7&target_type=user&target_id=1002`);
    expect(lastQuery()).toMatchObject({ actor_user_id: "7", target_type: "user", target_id: "1002" });
    expect(await screen.findByDisplayValue("Marina Admin")).toBeInTheDocument();
    expect(client.adminGet.mock.calls.some(([path]) => path === "/admin/users/7")).toBe(true);
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
  it("cada alteração mostra a ação, o alvo, o autor e o motivo, ainda fechada", async () => {
    await openChanges();
    const list = await screen.findByRole("list", { name: "Alterações administrativas" });
    const [suspend, member] = within(list).getAllByRole("listitem");
    expect(within(suspend).getByText("Workspace suspenso")).toBeInTheDocument();
    expect(within(suspend).getByText(/Café Serra Verde · por Marina Admin/)).toBeInTheDocument();
    expect(within(suspend).getByText("Cobrança contestada, aguardando análise")).toBeInTheDocument();
    expect(within(suspend).getByRole("button", { expanded: false })).toBeInTheDocument();
    // autor removido: nunca "null"
    expect(within(member).getByText(/por Usuário removido/)).toBeInTheDocument();
    expect(within(suspend).queryByRole("region", { name: /Workspace suspenso/ })).not.toBeInTheDocument();
  });

  it("abrir mostra o motivo, o alvo, quem fez, o IP e o antes e depois campo a campo (sem JSON cru)", async () => {
    await openChanges();
    const list = await screen.findByRole("list", { name: "Alterações administrativas" });
    const [suspend] = within(list).getAllByRole("listitem");
    await userEvent.click(within(suspend).getByRole("button", { expanded: false }));

    const body = within(suspend).getByRole("region", { name: /Workspace suspenso/ });
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

    await userEvent.click(within(suspend).getByRole("button", { expanded: true }));
    expect(within(suspend).queryByRole("region", { name: /Workspace suspenso/ })).not.toBeInTheDocument();
  });

  it("sem IP registrado diz isso, e o link do membro leva ao usuário afetado", async () => {
    await openChanges();
    const list = await screen.findByRole("list", { name: "Alterações administrativas" });
    const member = within(list).getAllByRole("listitem")[1];
    await userEvent.click(within(member).getByRole("button", { expanded: false }));
    const body = within(member).getByRole("region", { name: /Papel do membro alterado/ });
    expect(within(body).getByText("Não registrado")).toBeInTheDocument();
    expect(within(body).getByRole("link", { name: "Vanessa Mendes" })).toHaveAttribute("href", "/admin/users/1002");
  });

  it("mostra o impacto registrado quando há, e avisa quando a ação não registrou campos", async () => {
    client.adminList.mockImplementation(async () =>
      listPage([makeAuditEntry({ before_state: null, after_state: null, impact: { counts: { campaigns_active: 3 } } })]),
    );
    await openChanges();
    const list = await screen.findByRole("list", { name: "Alterações administrativas" });
    await userEvent.click(within(list).getByRole("button", { expanded: false }));
    expect(screen.getByText("Esta ação não registrou campos alterados.")).toBeInTheDocument();
    const impact = screen.getByRole("region", { name: "Impacto no momento da ação" });
    expect(within(impact).getByText("3")).toBeInTheDocument();
  });
});

describe("Alterações administrativas: estados", () => {
  it("carregando: esqueleto", async () => {
    client.adminList.mockReturnValue(new Promise(() => {}));
    const { container } = renderActivity("/admin/activity?tab=changes");
    await waitFor(() => expect(container.querySelectorAll(".adm-act-entry-skeleton .adm-sk").length).toBeGreaterThan(0));
  });

  it("vazio com filtro oferece limpar os filtros", async () => {
    client.adminList.mockResolvedValue(listPage([]));
    const { router } = await openChanges("/admin/activity?tab=changes&action=user.merge");
    expect(await screen.findByText("Nenhuma alteração com estes filtros")).toBeInTheDocument();
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
    expect(await screen.findByRole("list", { name: "Alterações administrativas" })).toBeInTheDocument();
  });
});

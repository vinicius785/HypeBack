/**
 * Tela "Segurança" (sentinela): alertas, vigiados e permissão.
 *
 * O QUE PRECISA FUNCIONAR:
 *   - lista de alertas com gravidade, título, nome e e-mail, canal (App/Painel), data no fuso de Brasília e anotação;
 *   - "Marcar como visto" com anotação opcional e "Marcar todos como vistos" com confirmação;
 *   - lista vazia: "Nenhum alerta novo. A sentinela está de olho.";
 *   - 403 da API: "Sem permissão", sem quebrar a tela; quem não é administrador nem pede os dados;
 *   - vigiados: ativos primeiro, "Já tem conta"/"Ainda sem conta"; 409 ao cadastrar mostra o texto fixo; "Parar de vigiar" com confirmação.
 *
 * O QUE NÃO PODE ACONTECER:
 *   - mandar Idempotency-Key (estas rotas não usam);
 *   - escrever o e-mail em console.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminGetEnvelope: vi.fn(),
  adminPostPlain: vi.fn(),
  adminDelete: vi.fn(),
  toastSuccess: vi.fn(),
  auth: { user: null as Record<string, unknown> | null },
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return {
    ...actual,
    adminGet: mocks.adminGet,
    adminGetEnvelope: mocks.adminGetEnvelope,
    adminPostPlain: mocks.adminPostPlain,
    adminDelete: mocks.adminDelete,
  };
});
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: mocks.auth.user, setUser: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));

import { toAdminApiError } from "@/lib/admin/admin-client";
import type { AdminActionAlert, SecurityAlert, SecurityWatch } from "@/shared/admin-platform.types";

import { renderRoutes, stubRoute } from "../users/admin-users-test-utils";
import { SecurityPage } from "./security-page";

const ADMIN = { id: 1, name: "Marina", is_platform_admin: true, platform_role: "admin" };

const ALERT: SecurityAlert = {
  id: 5,
  kind: "watched_login",
  severity: "high",
  title: "Conta conta vigiada abriu sessão".replace("Conta conta", "Conta"),
  details: { channel: "mobile-app" },
  created_at: "2026-11-10T01:30:00Z", // 22:30 de 09/11 em Brasília
  seen_at: null,
  note: null,
  user: { id: 42, name: "Bia Santos", email: "bia@marca.com" },
};

const WATCHES: SecurityWatch[] = [
  { id: 1, email: "antigo@marca.com", reason: "Caso encerrado", active: false, created_at: "2026-10-01T12:00:00Z", deactivated_at: "2026-10-20T12:00:00Z", registered_user: null },
  { id: 2, email: "novo@marca.com", reason: "Suspeita de fraude", active: true, created_at: "2026-11-01T12:00:00Z", deactivated_at: null, registered_user: { id: 9, name: "Caio Teodoro" } },
  { id: 3, email: "sem-conta@marca.com", reason: "Pedido do jurídico", active: true, created_at: "2026-11-02T12:00:00Z", deactivated_at: null, registered_user: null },
];

function alertsPage(data: SecurityAlert[], unseen = data.filter((a) => !a.seen_at).length) {
  return { data, meta: { total: data.length, unseen, limit: 50, offset: 0 } };
}

function serve(options: { alerts?: SecurityAlert[]; watches?: SecurityWatch[] } = {}) {
  mocks.adminGetEnvelope.mockImplementation(async () => alertsPage(options.alerts ?? [ALERT]));
  mocks.adminGet.mockImplementation(async (path: string) => {
    if (path === "/admin/security/alerts/summary") return { unseen: (options.alerts ?? [ALERT]).filter((a) => !a.seen_at).length };
    if (path === "/admin/security/watchlist") return options.watches ?? WATCHES;
    throw toAdminApiError(404, { message: "x" });
  });
}

const ROUTES = [
  {
    path: "/admin/security",
    component: SecurityPage,
    validateSearch: (raw: Record<string, unknown>) => ({ tab: raw.tab, status: raw.status }),
  },
  stubRoute("/admin/users/$userId"),
];

async function renderPage(url = "/admin/security") {
  const view = renderRoutes(ROUTES, url);
  await screen.findByRole("heading", { level: 1, name: "Segurança" });
  return { ...view, user: userEvent.setup() };
}

beforeEach(() => {
  for (const mock of [mocks.adminGet, mocks.adminGetEnvelope, mocks.adminPostPlain, mocks.adminDelete, mocks.toastSuccess]) mock.mockReset();
  mocks.auth.user = ADMIN;
  serve();
});

describe("Segurança: alertas", () => {
  it("mostra o alerta com gravidade, conta, canal, data de Brasília e o aviso de privacidade", async () => {
    await renderPage();
    const list = await screen.findByRole("list", { name: "Alertas de segurança" });
    const row = within(list).getByRole("listitem");
    expect(within(row).getByText("Alta")).toBeInTheDocument();
    expect(within(row).getByText("Conta vigiada abriu sessão")).toBeInTheDocument();
    expect(within(row).getByText("Bia Santos")).toBeInTheDocument();
    expect(within(row).getByText("bia@marca.com")).toBeInTheDocument();
    expect(within(row).getByText("App")).toBeInTheDocument();
    expect(within(row).getByText("09/11/2026 22:30")).toBeInTheDocument();
    // "Ver conta" mora no menu "⋯" do cartão
    await userEvent.click(within(row).getByRole("button", { name: "Ações do alerta 5" }));
    expect(await screen.findByRole("menuitem", { name: "Ver conta" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("Estas informações são visíveis apenas para administradores da plataforma.")).toBeInTheDocument();
    // o filtro padrão é "Novos", e a API é chamada com status=unseen, limit e offset
    expect(screen.getByRole("button", { name: "Novos" })).toHaveAttribute("aria-pressed", "true");
    expect(mocks.adminGetEnvelope).toHaveBeenCalledWith(
      "/admin/security/alerts",
      { status: "unseen", limit: 50, offset: 0 },
      expect.anything(),
    );
  });

  it("canal do painel aparece como Painel; alerta visto fica esmaecido, com a data da visualização e a anotação", async () => {
    serve({ alerts: [{ ...ALERT, id: 6, severity: "low", details: { channel: "backoffice" }, seen_at: "2026-11-10T13:00:00Z", note: "Era a própria pessoa" }] });
    await renderPage("/admin/security?status=all");
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Painel")).toBeInTheDocument();
    expect(within(row).getByText("Baixa")).toBeInTheDocument();
    expect(within(row).getByText("Visto em 10/11/2026 10:00")).toBeInTheDocument();
    expect(within(row).getByText("“Era a própria pessoa”")).toBeInTheDocument();
    expect(row).toHaveAttribute("data-seen", "true");
    expect(within(row).queryByRole("button", { name: "Marcar como visto" })).toBeNull();
  });

  it("sem alertas novos mostra o estado vazio", async () => {
    serve({ alerts: [] });
    await renderPage();
    expect(await screen.findByText("Nenhum alerta novo. A sentinela está de olho.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar todos como vistos" })).toBeDisabled();
  });

  it("403 da API mostra Sem permissão e a tela continua de pé", async () => {
    mocks.adminGetEnvelope.mockRejectedValue(toAdminApiError(403, { message: "Forbidden resource" }));
    await renderPage();
    expect(await screen.findByText("Sem permissão")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Segurança" })).toBeInTheDocument();
  });

  it("quem não é administrador vê Sem permissão e nenhuma chamada é feita", async () => {
    mocks.auth.user = { id: 7, name: "Caio", is_platform_admin: false, platform_role: "support" };
    await renderPage();
    expect(screen.getByText("Sem permissão")).toBeInTheDocument();
    expect(mocks.adminGet).not.toHaveBeenCalled();
    expect(mocks.adminGetEnvelope).not.toHaveBeenCalled();
  });

  it("marcar como visto: anotação opcional, sem Idempotency-Key", async () => {
    mocks.adminPostPlain.mockResolvedValue({ id: 5 });
    const { user } = await renderPage();
    await user.click(await screen.findByRole("button", { name: "Marcar como visto" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Anotação/), "  Conferido  ");
    await user.click(within(dialog).getByRole("button", { name: "Marcar como visto" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledTimes(1));
    expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/security/alerts/5/seen", { note: "Conferido" });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Alerta marcado como visto.", expect.anything());
  });

  it("marcar como visto sem anotação não manda corpo", async () => {
    mocks.adminPostPlain.mockResolvedValue({ id: 5 });
    const { user } = await renderPage();
    await user.click(await screen.findByRole("button", { name: "Marcar como visto" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Marcar como visto" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/security/alerts/5/seen", undefined));
  });

  it("marcar todos como vistos pede confirmação e chama seen-all", async () => {
    mocks.adminPostPlain.mockResolvedValue({ marked: 3 });
    const { user } = await renderPage();
    await user.click(await screen.findByRole("button", { name: "Marcar todos como vistos" }));
    const dialog = await screen.findByRole("alertdialog", {}, { timeout: 100 }).catch(() => screen.findByRole("dialog"));
    expect(mocks.adminPostPlain).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Marcar todos" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/security/alerts/seen-all"));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("3 alertas marcados como vistos.", expect.anything());
  });
});

const ADMIN_ACTION: AdminActionAlert = {
  id: 20,
  kind: "admin_action",
  severity: "high",
  title: "Papel na equipe da plataforma alterado — Fulano Alvo",
  details: {
    action_log_id: 99,
    action: "user.platform_role_change",
    action_label: "Alterou o papel de um usuário na equipe da plataforma",
    actor_name: "Marina Alves",
    actor_role: "platform_admin",
    target_type: "user",
    target_id: "7",
    target_label: "Fulano Alvo",
    reason: "Promoção aprovada pela diretoria",
    ip: "203.0.113.7",
  },
  created_at: "2026-11-10T01:30:00Z",
  seen_at: null,
  note: null,
  user: { id: 1, name: "Marina Alves", email: "marina@hype.com" },
};

/** Abre os detalhes de uma ação no Admin pelo menu "⋯" do cartão. */
async function openDetails(user: ReturnType<typeof userEvent.setup>, row: HTMLElement, id = 20) {
  await user.click(within(row).getByRole("button", { name: `Ações do alerta ${id}` }));
  await user.click(await screen.findByRole("menuitem", { name: /Ver detalhes/ }));
}

describe("Segurança: alertas de ações no Admin (admin_action)", () => {
  it("mostra o selo do tipo, o título e quem fez; sem canal App/Painel", async () => {
    serve({ alerts: [ADMIN_ACTION] });
    await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Ação no Admin")).toBeInTheDocument();
    expect(within(row).getByText("Papel na equipe da plataforma alterado — Fulano Alvo")).toBeInTheDocument();
    expect(within(row).getByText("Feito por Marina Alves")).toBeInTheDocument();
    expect(within(row).getByText("marina@hype.com")).toBeInTheDocument();
    expect(within(row).queryByText("App")).toBeNull();
    expect(within(row).queryByText("Painel")).toBeNull();
    expect(within(row).queryByText("Conta vigiada")).toBeNull();
  });

  it("ao expandir mostra motivo, alvo traduzido, papel de quem fez e IP", async () => {
    serve({ alerts: [ADMIN_ACTION] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).queryByText("Motivo informado")).toBeNull();
    await openDetails(user, row);
    expect(within(row).getByText("Promoção aprovada pela diretoria")).toBeInTheDocument();
    expect(within(row).getByText("Fulano Alvo · Usuário")).toBeInTheDocument();
    expect(within(row).getByText("Administrador")).toBeInTheDocument();
    expect(within(row).getByText("203.0.113.7")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 20" }));
    await user.click(await screen.findByRole("menuitem", { name: /Ocultar detalhes/ }));
    expect(within(row).queryByText("Promoção aprovada pela diretoria")).toBeNull();
  });

  it("sem IP o campo IP nem aparece; equipe e tipo desconhecido do alvo são traduzidos ou ficam como vieram", async () => {
    serve({
      alerts: [{ ...ADMIN_ACTION, details: { ...ADMIN_ACTION.details, ip: null, actor_role: "platform_staff", target_type: "workspace", target_label: "Acme" } }],
    });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    await openDetails(user, row);
    expect(within(row).queryByText("IP")).toBeNull();
    expect(within(row).getByText("Equipe")).toBeInTheDocument();
    expect(within(row).getByText("Acme · Workspace")).toBeInTheDocument();
  });

  it("motivo e alvo com HTML aparecem como texto, nunca como HTML", async () => {
    const evil = '<img src=x onerror="alert(1)"><b>negrito</b>';
    serve({ alerts: [{ ...ADMIN_ACTION, details: { ...ADMIN_ACTION.details, reason: evil, target_label: "<script>x</script>" } }] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    await openDetails(user, row);
    expect(within(row).getByText(evil)).toBeInTheDocument();
    expect(row.querySelector("img")).toBeNull();
    expect(row.querySelector("script")).toBeNull();
    expect(row.querySelector("b > b, b + b")).toBeNull();
  });

  it("watched_login continua igual: selo Conta vigiada, canal e sem botão de detalhes", async () => {
    serve({ alerts: [ALERT] });
    await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Conta vigiada")).toBeInTheDocument();
    expect(within(row).getByText("App")).toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", { name: /Ações do alerta/ }));
    expect(screen.queryByRole("menuitem", { name: /detalhes/ })).toBeNull();
  });

  it("tipo desconhecido não quebra: título e pessoa, sem selo nem detalhes", async () => {
    serve({ alerts: [{ id: 30, kind: "novo_tipo", severity: "medium", title: "Algo novo aconteceu", details: { x: 1 }, created_at: "2026-11-10T01:30:00Z", seen_at: null, note: null, user: { id: 3, name: "Bia", email: "bia@marca.com" } }] });
    await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Algo novo aconteceu")).toBeInTheDocument();
    expect(within(row).getByText("Bia")).toBeInTheDocument();
    expect(within(row).queryByText("Ação no Admin")).toBeNull();
    expect(within(row).queryByText("Conta vigiada")).toBeNull();
    expect(within(row).queryByRole("button", { name: /detalhes/ })).toBeNull();
  });

  it("filtro por tipo (no cliente): ações no Admin escondem as contas vigiadas e vice-versa", async () => {
    serve({ alerts: [ALERT, ADMIN_ACTION] });
    const { user } = await renderPage();
    await screen.findAllByRole("listitem");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Ações no Admin" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Ação no Admin")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Contas vigiadas" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Conta vigiada abriu sessão")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Todos os tipos" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("Segurança: a ilha só esquenta quando aconteceu algo", () => {
  it("sem alertas novos: tranquila, sem o vermelho nem o alerta na sentinela", async () => {
    serve({ alerts: [] });
    const { container } = await renderPage();
    expect(await screen.findByText("Tudo tranquilo")).toBeInTheDocument();
    expect(container.querySelector(".adm-sec-isl")).not.toHaveClass("adm-sec-isl-alert");
    expect(container.querySelector(".adm-sentinel")).toHaveAttribute("data-state", "calm");
  });

  it("com alertas novos: a ilha, o título e a sentinela passam para o alerta", async () => {
    serve({ alerts: [ALERT, { ...ALERT, id: 6 }, { ...ALERT, id: 7 }] });
    const { container } = await renderPage();
    expect(await screen.findByRole("heading", { level: 2, name: /3 alertas novos/ })).toBeInTheDocument();
    expect(container.querySelector(".adm-sec-isl")).toHaveClass("adm-sec-isl-alert");
    expect(container.querySelector(".adm-sentinel")).toHaveAttribute("data-state", "alert");
  });

  it("alerta já visto não é vermelho (selo cinza)", async () => {
    serve({ alerts: [{ ...ALERT, id: 6, seen_at: "2026-11-10T13:00:00Z" }] });
    const { container } = await renderPage("/admin/security?status=all");
    await screen.findByRole("listitem");
    expect(container.querySelector('.adm-badge[data-tone="bad"]')).toBeNull();
  });
});

describe("Segurança: vigiados", () => {
  it("lista ativos primeiro, com a indicação de conta e o aviso de privacidade", async () => {
    await renderPage("/admin/security?tab=watchlist");
    const list = await screen.findByRole("list", { name: "E-mails vigiados" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => within(row).getByText(/@marca\.com$/).textContent)).toEqual(["sem-conta@marca.com", "novo@marca.com", "antigo@marca.com"]);
    expect(within(rows[0]).getByText("Ainda sem conta")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Caio Teodoro")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Já tem conta")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Inativo")).toBeInTheDocument();
    // encerrado e sem conta: não há o que fazer, então nem o menu "⋯" aparece
    expect(within(rows[2]).queryByRole("button", { name: /Ações de/ })).toBeNull();
    // ativo com conta: o menu tem Ver conta e Parar de vigiar
    await userEvent.click(within(rows[1]).getByRole("button", { name: "Ações de novo@marca.com" }));
    expect(await screen.findByRole("menuitem", { name: "Ver conta" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Parar de vigiar" })).toBeInTheDocument();
    expect(screen.getByText("Estas informações são visíveis apenas para administradores da plataforma.")).toBeInTheDocument();
  });

  it("Vigiar e-mail valida o motivo e manda e-mail e motivo", async () => {
    mocks.adminPostPlain.mockResolvedValue({ id: 10, reactivated: false });
    const { user } = await renderPage("/admin/security?tab=watchlist");
    await user.click(await screen.findByRole("button", { name: "Vigiar e-mail" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("E-mail"), "Fulano@Marca.com");
    await user.type(within(dialog).getByLabelText("Motivo"), "abc");
    await user.click(within(dialog).getByRole("button", { name: "Vigiar" }));
    expect(await within(dialog).findByText("Descreva o motivo com pelo menos 5 caracteres.")).toBeInTheDocument();
    expect(mocks.adminPostPlain).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText("Motivo"), "de");
    await user.click(within(dialog).getByRole("button", { name: "Vigiar" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/security/watchlist", { email: "fulano@marca.com", reason: "abcde" }));
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("409 WATCH_ALREADY_ACTIVE mostra que o e-mail já é vigiado e mantém o diálogo aberto", async () => {
    mocks.adminPostPlain.mockRejectedValue(toAdminApiError(409, { statusCode: 409, error: "WATCH_ALREADY_ACTIVE", message: "Already watched" }));
    const { user } = await renderPage("/admin/security?tab=watchlist");
    await user.click(await screen.findByRole("button", { name: "Vigiar e-mail" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("E-mail"), "novo@marca.com");
    await user.type(within(dialog).getByLabelText("Motivo"), "Suspeita de fraude");
    await user.click(within(dialog).getByRole("button", { name: "Vigiar" }));
    expect(await within(dialog).findByText("Esse e-mail já está na lista de vigiados.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Parar de vigiar pede confirmação e chama DELETE", async () => {
    mocks.adminDelete.mockResolvedValue({ id: 3 });
    const { user } = await renderPage("/admin/security?tab=watchlist");
    const row = (await screen.findByText("sem-conta@marca.com")).closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Ações de sem-conta@marca.com" }));
    expect(screen.queryByRole("menuitem", { name: "Ver conta" })).toBeNull(); // sem conta ainda: só Parar de vigiar
    await user.click(await screen.findByRole("menuitem", { name: "Parar de vigiar" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("A conta deixa de gerar alertas. O histórico fica guardado.")).toBeInTheDocument();
    expect(mocks.adminDelete).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Parar de vigiar" }));
    await waitFor(() => expect(mocks.adminDelete).toHaveBeenCalledWith("/admin/security/watchlist/3"));
  });
});

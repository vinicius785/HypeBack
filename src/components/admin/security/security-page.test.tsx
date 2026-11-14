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
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
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
import type {
  AdminActionAlert,
  AttackAnonymizerWaveAlert,
  AttackCodeGuessingAlert,
  AttackEnumerationAlert,
  AttackIpDeniedAlert,
  AttackUserProbingAlert,
  AttackVolumeAlert,
  SecurityAlert,
  SecurityWatch,
  SignupDomainClusterAlert,
  SecurityWatchActivityRow,
  SignupWaveAlert,
  StaffResetAttemptAlert,
  WatchedActiveAlert,
} from "@/shared/admin-platform.types";

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

const SHIELD_OFF = { configured: true, active: false, id: null, activated_at: null, expires_at: null, reason: null, activated_by: null };
const HELD_NONE = { accounts: 0, withdrawals: 0, withdrawals_list: [] };

function serve(
  options: {
    alerts?: SecurityAlert[];
    watches?: SecurityWatch[];
    activity?: SecurityWatchActivityRow[] | "forbidden";
    shield?: Record<string, unknown>;
    held?: Record<string, unknown>;
  } = {},
) {
  mocks.adminGetEnvelope.mockImplementation(async (path: string) => {
    if (path.includes("/activity")) {
      if (options.activity === "forbidden") throw toAdminApiError(403, { message: "Forbidden resource" });
      const rows = options.activity ?? [];
      return { data: rows, meta: { total: rows.length, limit: 100, offset: 0 } };
    }
    return alertsPage(options.alerts ?? [ALERT]);
  });
  mocks.adminGet.mockImplementation(async (path: string) => {
    if (path === "/admin/security/alerts/summary") return { unseen: (options.alerts ?? [ALERT]).filter((a) => !a.seen_at).length };
    if (path === "/admin/security/watchlist") return options.watches ?? WATCHES;
    if (path === "/admin/security/shield") return options.shield ?? SHIELD_OFF;
    if (path === "/admin/security/shield/held") return options.held ?? HELD_NONE;
    throw toAdminApiError(404, { message: "x" });
  });
}

/** Escolhe uma opção no painel do botão de filtro da ilha (um botão só, com os filtros "Mostrar", "Tipo" e "Estado"). */
async function chooseFilter(user: ReturnType<typeof userEvent.setup>, filter: "Mostrar" | "Tipo" | "Estado", value: string) {
  await user.click(screen.getByRole("button", { name: /^Filtros/ }));
  await user.selectOptions(screen.getByRole("combobox", { name: filter }), value);
}

const ROUTES = [
  {
    path: "/admin/security",
    component: SecurityPage,
    validateSearch: (raw: Record<string, unknown>) => ({ tab: raw.tab, status: raw.status }),
  },
  stubRoute("/admin/users/$userId"),
  stubRoute("/admin/users"),
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
    expect(screen.getByRole("combobox", { name: "Mostrar" })).toHaveValue("unseen");
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
    await chooseFilter(user, "Tipo", "admin_action");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Ação no Admin")).toBeInTheDocument();
    await chooseFilter(user, "Tipo", "watched_login");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Conta vigiada abriu sessão")).toBeInTheDocument();
    await chooseFilter(user, "Tipo", "all");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

const IP_DENIED: AttackIpDeniedAlert = {
  id: 40,
  kind: "attack_ip_denied",
  severity: "high",
  title: "IP com muitas tentativas negadas",
  details: { ip: "198.51.100.9", count: 5, window_minutes: 10, last_status: 403, last_path: "/api/backoffice/admin/users" },
  created_at: "2026-11-10T01:30:00Z",
  seen_at: null,
  note: null,
  user: null,
};

const PROBING: AttackUserProbingAlert = {
  id: 41,
  kind: "attack_user_probing",
  severity: "medium",
  title: "Conta recebendo muitos erros de acesso",
  details: { ip: "203.0.113.50", count: 12, window_minutes: 5, last_status: 404, last_path: "/api/campaigns/999/contracts" },
  created_at: "2026-11-10T01:30:00Z",
  seen_at: null,
  note: null,
  user: { id: 3, name: "Bia Santos", email: "bia@marca.com" },
};

const WAVE: SignupWaveAlert = {
  id: 42,
  kind: "signup_wave",
  severity: "medium",
  title: "Muitos cadastros em pouco tempo",
  details: { count: 40, window_minutes: 10 },
  created_at: "2026-11-10T01:30:00Z",
  seen_at: null,
  note: null,
  user: null,
};

describe("Segurança: alertas de ataque à API", () => {
  it("attack_ip_denied: selo, resumo com o IP, sem canal e sem Ver conta; o detalhe traz IP, rota e status", async () => {
    serve({ alerts: [IP_DENIED] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("IP suspeito")).toBeInTheDocument();
    expect(within(row).getByText(/5 tentativas negadas em 10 min vindas do IP/)).toBeInTheDocument();
    expect(within(row).getAllByText("198.51.100.9").length).toBeGreaterThan(0);
    expect(within(row).queryByText("App")).toBeNull();
    expect(within(row).queryByText("Painel")).toBeNull();
    expect(within(row).queryByText(/Feito por|Conta suspeita:/)).toBeNull();
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 40" }));
    expect(screen.queryByRole("menuitem", { name: "Ver conta" })).toBeNull();
    await user.click(await screen.findByRole("menuitem", { name: "Ver detalhes" }));
    expect(within(row).getByText("/api/backoffice/admin/users")).toBeInTheDocument();
    expect(within(row).getByText("403")).toBeInTheDocument();
    expect(within(row).getByText("/api/backoffice/admin/users")).toHaveClass("adm-sec-mono");
  });

  it("attack_user_probing: 'Conta suspeita:' com nome e e-mail, resumo, Ver conta e detalhe com IP, rota e status", async () => {
    serve({ alerts: [PROBING] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Conta suspeita: Bia Santos")).toBeInTheDocument();
    expect(within(row).getByText("bia@marca.com")).toBeInTheDocument();
    expect(within(row).getByText("12 erros de acesso (403/404) em 5 min")).toBeInTheDocument();
    expect(within(row).queryByText(/Feito por/)).toBeNull();
    expect(within(row).queryByText("App")).toBeNull();
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 41" }));
    expect(await screen.findByRole("menuitem", { name: "Ver conta" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Ver detalhes" }));
    expect(within(row).getByText("203.0.113.50")).toBeInTheDocument();
    expect(within(row).getByText("/api/campaigns/999/contracts")).toBeInTheDocument();
    expect(within(row).getByText("404")).toBeInTheDocument();
  });

  it("attack_user_probing sem conta e sem IP: não quebra, mostra 'não identificada' e um traço no IP", async () => {
    serve({ alerts: [{ ...PROBING, user: null, details: { ...PROBING.details, ip: null } }] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Conta suspeita: não identificada")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 41" }));
    expect(screen.queryByRole("menuitem", { name: "Ver conta" })).toBeNull();
    await user.click(await screen.findByRole("menuitem", { name: "Ver detalhes" }));
    expect(within(row).getByText("IP").nextElementSibling).toHaveTextContent("—");
  });

  it("attack_ip_denied com uma conta (não esperado): continua mostrando o IP e ganha Ver conta", async () => {
    serve({ alerts: [{ ...IP_DENIED, user: { id: 8, name: "Caio", email: "caio@marca.com" } }] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 40" }));
    expect(await screen.findByRole("menuitem", { name: "Ver conta" })).toBeInTheDocument();
  });

  it("signup_wave: selo, resumo; sem canal, sem detalhes e sem menu (não há o que abrir)", async () => {
    serve({ alerts: [WAVE] });
    await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Onda de cadastros")).toBeInTheDocument();
    expect(within(row).getByText("40 contas novas em 10 min")).toBeInTheDocument();
    expect(within(row).queryByText("App")).toBeNull();
    expect(within(row).queryByRole("button", { name: /Ações do alerta/ })).toBeNull();
  });

  it("IP e rota com HTML aparecem como texto, nunca como HTML", async () => {
    const evil = '<img src=x onerror="alert(1)">/admin';
    serve({ alerts: [{ ...IP_DENIED, details: { ...IP_DENIED.details, last_path: evil } }] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 40" }));
    await user.click(await screen.findByRole("menuitem", { name: "Ver detalhes" }));
    expect(within(row).getByText(evil)).toBeInTheDocument();
    expect(row.querySelector("img")).toBeNull();
  });

  it("filtro por tipo agrupa: Ataques reúne os de ataque e Cadastros reúne onda e domínio", async () => {
    serve({ alerts: [ALERT, IP_DENIED, PROBING, WAVE] });
    const { user } = await renderPage();
    await screen.findAllByRole("listitem");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    await chooseFilter(user, "Tipo", "attacks");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Conta suspeita: Bia Santos")).toBeInTheDocument();
    await chooseFilter(user, "Tipo", "signups");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("40 contas novas em 10 min")).toBeInTheDocument();
  });
});

const BASE = { created_at: "2026-11-10T01:30:00Z", seen_at: null, note: null } as const;

const CODE_GUESSING: AttackCodeGuessingAlert = {
  ...BASE,
  id: 50,
  kind: "attack_code_guessing",
  severity: "high",
  title: "Chute de código de verificação",
  details: { target: "b***@marca.com", count: 30, distinct_ips: 6, window_minutes: 10, last_status: 400, last_path: "/api/auth/first-access" },
  user: { id: 5, name: "Dani Lima", email: "dani@marca.com" },
};
const VOLUME: AttackVolumeAlert = {
  ...BASE,
  id: 51,
  kind: "attack_volume",
  severity: "medium",
  title: "Volume anormal de chamadas",
  details: { ip: "203.0.113.20", count: 900, window_minutes: 5, new_account: true, last_path: "/api/creators" },
  user: { id: 6, name: "Leo Ramos", email: "leo@marca.com" },
};
const ENUMERATION: AttackEnumerationAlert = {
  ...BASE,
  id: 52,
  kind: "attack_enumeration",
  severity: "high",
  title: "Varredura de dados",
  details: { ip: "203.0.113.21", distinct_ids: 250, window_minutes: 10, route: "/api/creators/:id" },
  user: { id: 7, name: "Ana Prado", email: "ana@marca.com" },
};
const ANONYMIZER: AttackAnonymizerWaveAlert = {
  ...BASE,
  id: 53,
  kind: "attack_anonymizer_wave",
  severity: "medium",
  title: "Onda de rede anônima",
  details: { count: 18, window_minutes: 15, last_path: "/api/auth/login" },
  user: null,
};
const STAFF_RESET: StaffResetAttemptAlert = {
  ...BASE,
  id: 54,
  kind: "staff_reset_attempt",
  severity: "high",
  title: "Tentativas de redefinir a senha de uma conta da equipe",
  details: { target: "m***@hype.com", staff: true, watched: false, attempts: 7, distinct_ips: 2, ips: ["198.51.100.1", "198.51.100.2"], paths: ["/api/auth/forgot-password", "/api/auth/reset-password"] },
  user: { id: 1, name: "Marina Alves", email: "marina@hype.com" },
};
const DOMAIN_CLUSTER: SignupDomainClusterAlert = {
  ...BASE,
  id: 55,
  kind: "signup_domain_cluster",
  severity: "medium",
  title: "Muitos cadastros do mesmo domínio",
  details: { domain: "mailbox.example", count: 25, window_minutes: 30 },
  user: null,
};

describe("Segurança: todos os tipos de alerta da sentinela", () => {
  it("attack_code_guessing: 'Conta alvo:', resumo com o alvo e os IPs, e o aviso de rede Tor com 5 IPs ou mais", async () => {
    serve({ alerts: [CODE_GUESSING] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Chute de código")).toBeInTheDocument();
    expect(within(row).getByText("Conta alvo: Dani Lima")).toBeInTheDocument();
    expect(within(row).getByText(/30 códigos errados em 10 min para/)).toHaveTextContent("30 códigos errados em 10 min para b***@marca.com, vindos de 6 IPs");
    expect(within(row).getByText("b***@marca.com")).toHaveClass("adm-sec-mono");
    expect(within(row).getByText("IPs diferentes: possível rede Tor")).toBeInTheDocument();
    expect(within(row).queryByText("App")).toBeNull();
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 50" }));
    expect(await screen.findByRole("menuitem", { name: "Ver conta" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Ver detalhes" }));
    expect(within(row).getByText("/api/auth/first-access")).toBeInTheDocument();
  });

  it("attack_code_guessing com poucos IPs não tem o aviso; sem conta mostra o e-mail mascarado como alvo", async () => {
    serve({ alerts: [{ ...CODE_GUESSING, user: null, details: { ...CODE_GUESSING.details, distinct_ips: 1 } }] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).queryByText(/possível rede Tor/)).toBeNull();
    expect(within(row).getByText(/Conta alvo:/)).toHaveTextContent("Conta alvo: b***@marca.com");
    expect(within(row).getByText(/vindo de 1 IP$/)).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 50" }));
    expect(screen.queryByRole("menuitem", { name: "Ver conta" })).toBeNull();
  });

  it("attack_volume: resumo e a etiqueta de conta nova só quando new_account é verdadeiro", async () => {
    serve({ alerts: [VOLUME] });
    const first = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Volume anormal")).toBeInTheDocument();
    expect(within(row).getByText("Conta suspeita: Leo Ramos")).toBeInTheDocument();
    expect(within(row).getByText("900 chamadas em 5 min")).toBeInTheDocument();
    expect(within(row).getByText("Conta nova (menos de 48 h)")).toBeInTheDocument();
    first.unmount();
    serve({ alerts: [{ ...VOLUME, details: { ...VOLUME.details, new_account: false } }] });
    await renderPage();
    expect(within(await screen.findByRole("listitem")).queryByText("Conta nova (menos de 48 h)")).toBeNull();
  });

  it("attack_enumeration: resumo com a rota em monoespaçada e 'Conta suspeita:'", async () => {
    serve({ alerts: [ENUMERATION] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Varredura de dados", { selector: ".adm-sec-tag-item" })).toBeInTheDocument();
    expect(within(row).getByText("Conta suspeita: Ana Prado")).toBeInTheDocument();
    expect(within(row).getByText(/Leu 250 registros diferentes em 10 min na rota/)).toBeInTheDocument();
    expect(within(row).getByText("/api/creators/:id")).toHaveClass("adm-sec-mono");
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 52" }));
    await user.click(await screen.findByRole("menuitem", { name: "Ver detalhes" }));
    expect(within(row).getByText("Registros diferentes").nextElementSibling).toHaveTextContent("250");
  });

  it("attack_anonymizer_wave: selo e resumo, sem conta e sem canal", async () => {
    serve({ alerts: [ANONYMIZER] });
    await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Rede anônima")).toBeInTheDocument();
    expect(within(row).getByText("18 tentativas bloqueadas de rede anônima (Tor/VPN) em 15 min")).toBeInTheDocument();
    expect(within(row).queryByText("App")).toBeNull();
    expect(within(row).queryByText("Painel")).toBeNull();
  });

  it("staff_reset_attempt com equipe: em vermelho, 'Conta visada:', etiqueta Equipe e a lista de IPs e rotas", async () => {
    serve({ alerts: [STAFF_RESET] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(row).toHaveAttribute("data-critical", "true");
    expect(within(row).getByText("Conta da equipe visada")).toBeInTheDocument();
    expect(within(row).getByText("Conta visada: Marina Alves")).toBeInTheDocument();
    expect(within(row).getByText(/7 tentativas de redefinir a senha de/)).toHaveTextContent("7 tentativas de redefinir a senha de m***@hype.com");
    expect(within(row).getByText("Equipe")).toBeInTheDocument();
    expect(within(row).queryByText("Vigiado")).toBeNull();
    expect(within(row).getByText("Tentativas de redefinir a senha de uma conta da equipe")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 54" }));
    expect(await screen.findByRole("menuitem", { name: "Ver conta" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Ver detalhes" }));
    for (const text of ["198.51.100.1", "198.51.100.2", "/api/auth/forgot-password", "/api/auth/reset-password"]) {
      expect(within(row).getByText(text)).toBeInTheDocument();
    }
  });

  it("staff_reset_attempt só vigiado e sem conta: etiqueta Vigiado, sem Equipe, alvo mascarado no lugar da conta", async () => {
    serve({ alerts: [{ ...STAFF_RESET, user: null, details: { ...STAFF_RESET.details, staff: false, watched: true, ips: [], paths: [] } }] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Vigiado")).toBeInTheDocument();
    expect(within(row).queryByText("Equipe")).toBeNull();
    expect(within(row).getByText(/Conta visada:/)).toHaveTextContent("Conta visada: m***@hype.com");
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 54" }));
    expect(screen.queryByRole("menuitem", { name: "Ver conta" })).toBeNull();
  });

  it("signup_domain_cluster: resumo com o domínio e o botão que leva a Pessoas com a busca por @domínio", async () => {
    serve({ alerts: [DOMAIN_CLUSTER] });
    const { user, router } = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Domínio repetido")).toBeInTheDocument();
    expect(within(row).getByText("@mailbox.example")).toBeInTheDocument();
    expect(within(row).getByText(/25 contas novas do domínio/)).toHaveTextContent("25 contas novas do domínio mailbox.example em 30 min");
    await user.click(within(row).getByRole("button", { name: "Ver cadastros deste domínio" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/users"));
    expect(router.state.location.search).toMatchObject({ search: "@mailbox.example" });
  });

  it("filtros Equipe visada e Cadastros mostram só os seus tipos", async () => {
    serve({ alerts: [ALERT, STAFF_RESET, WAVE, DOMAIN_CLUSTER] });
    const { user } = await renderPage();
    await screen.findAllByRole("listitem");
    await chooseFilter(user, "Tipo", "staff");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    await chooseFilter(user, "Tipo", "signups");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

const ACCESS = { ip: "203.0.113.7", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", device: "iPhone/iPad (iOS)", new_ip: true };

const WATCHED_ACTIVE: WatchedActiveAlert = {
  id: 60,
  kind: "watched_active",
  severity: "medium",
  title: "Conta vigiada está ativa",
  details: { ...ACCESS, first_path: "/api/campaigns" },
  created_at: "2026-11-10T01:30:00Z",
  seen_at: null,
  note: null,
  user: { id: 2, name: "Bia Santos", email: "bia@marca.com" },
};

describe("Segurança: conta vigiada com IP e aparelho", () => {
  it("watched_login com IP novo: canal, aparelho, IP, etiqueta IP novo e o User-Agent só ao expandir", async () => {
    serve({ alerts: [{ ...ALERT, title: "Conta vigiada abriu sessão de um IP novo", details: { channel: "mobile-app", ...ACCESS } }] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Conta vigiada abriu sessão de um IP novo")).toBeInTheDocument();
    expect(within(row).getByText("App")).toBeInTheDocument();
    expect(within(row).getByText(/iPhone\/iPad \(iOS\)/)).toHaveTextContent("iPhone/iPad (iOS) · IP 203.0.113.7");
    expect(within(row).getByText("203.0.113.7")).toHaveClass("adm-sec-mono");
    expect(within(row).getByText("IP novo")).toBeInTheDocument();
    expect(within(row).queryByText(/Mozilla/)).toBeNull();
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 5" }));
    await user.click(await screen.findByRole("menuitem", { name: "Ver detalhes" }));
    expect(within(row).getByText(/Mozilla\/5.0/)).toHaveClass("adm-sec-mono");
  });

  it("watched_login sem IP novo (new_ip falso ou desconhecido) não tem a etiqueta; sem IP nem aparelho não tem resumo nem detalhes", async () => {
    serve({ alerts: [{ ...ALERT, details: { channel: "backoffice", ip: "203.0.113.8", device: "Windows", new_ip: false, user_agent: null } }] });
    const first = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Painel")).toBeInTheDocument();
    expect(within(row).getByText(/Windows/)).toHaveTextContent("Windows · IP 203.0.113.8");
    expect(within(row).queryByText("IP novo")).toBeNull();
    first.unmount();

    serve({ alerts: [{ ...ALERT, details: { channel: "mobile-app", ip: null, user_agent: null, device: null, new_ip: null } }] });
    const { user } = await renderPage();
    const bare = await screen.findByRole("listitem");
    expect(within(bare).queryByText("IP novo")).toBeNull();
    expect(within(bare).queryByText(/IP/)).toBeNull();
    await user.click(within(bare).getByRole("button", { name: "Ações do alerta 5" }));
    expect(screen.queryByRole("menuitem", { name: "Ver detalhes" })).toBeNull();
  });

  it("watched_active: selo Vigiado ativo, resumo com aparelho e IP, IP novo e a primeira rota ao expandir", async () => {
    serve({ alerts: [WATCHED_ACTIVE] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    expect(within(row).getByText("Vigiado ativo")).toBeInTheDocument();
    expect(within(row).getByText(/Conta vigiada está ativa ·/)).toHaveTextContent("Conta vigiada está ativa · iPhone/iPad (iOS) · IP 203.0.113.7");
    expect(within(row).getByText("IP novo")).toBeInTheDocument();
    expect(within(row).queryByText("App")).toBeNull();
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 60" }));
    await user.click(await screen.findByRole("menuitem", { name: "Ver detalhes" }));
    expect(within(row).getByText("/api/campaigns")).toHaveClass("adm-sec-mono");
    expect(within(row).getByText("Primeira rota vista no minuto")).toBeInTheDocument();
  });

  it("User-Agent e rota com HTML aparecem como texto", async () => {
    const evil = '<img src=x onerror="alert(1)">';
    serve({ alerts: [{ ...WATCHED_ACTIVE, details: { ...ACCESS, user_agent: evil, first_path: evil } }] });
    const { user } = await renderPage();
    const row = await screen.findByRole("listitem");
    await user.click(within(row).getByRole("button", { name: "Ações do alerta 60" }));
    await user.click(await screen.findByRole("menuitem", { name: "Ver detalhes" }));
    expect(within(row).getAllByText(evil).length).toBe(2);
    expect(row.querySelector("img")).toBeNull();
  });

  it("o filtro Contas vigiadas inclui o vigiado ativo", async () => {
    serve({ alerts: [ALERT, WATCHED_ACTIVE, IP_DENIED] });
    const { user } = await renderPage();
    await screen.findAllByRole("listitem");
    await chooseFilter(user, "Tipo", "watched_login");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

const ACTIVITY: SecurityWatchActivityRow[] = [
  { id: 3, created_at: "2026-11-10T13:05:00Z", method: "GET", path: "/api/campaigns", status: 200, ip: "203.0.113.7", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", hits: 3, user: null },
  { id: 2, created_at: "2026-11-10T13:04:00Z", method: "POST", path: "/api/auth/login", status: 401, ip: "203.0.113.7", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", hits: 1, user: null },
  { id: 1, created_at: "2026-11-10T13:00:00Z", method: "GET", path: "/api/me", status: 500, ip: "198.51.100.4", user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", hits: 1, user: null },
];

async function openActivity(user: ReturnType<typeof userEvent.setup>, email = "novo@marca.com") {
  const row = (await screen.findByText(email)).closest("li") as HTMLElement;
  await user.click(within(row).getByRole("button", { name: "Ver atividade" }));
  return screen.findByRole("dialog", { name: /Atividade/ });
}

describe("Segurança: atividade dos vigiados", () => {
  it("cada vigiado mostra a última atividade (data, hora e há quanto tempo) ou 'Nenhuma atividade ainda'", async () => {
    serve({
      watches: [
        { ...WATCHES[1], last_activity_at: "2026-11-10T13:05:00Z" },
        { ...WATCHES[2], last_activity_at: null },
      ],
    });
    await renderPage("/admin/security?tab=watchlist");
    const withActivity = (await screen.findByText("novo@marca.com")).closest("li") as HTMLElement;
    expect(within(withActivity).getByText(/Última atividade/)).toHaveTextContent("10/11/2026 10:05");
    const without = screen.getByText("sem-conta@marca.com").closest("li") as HTMLElement;
    expect(within(without).getByText("Nenhuma atividade ainda")).toBeInTheDocument();
  });

  it("variação do e-mail: mostra 'Conta: {e-mail da conta}' só quando difere do e-mail vigiado", async () => {
    serve({
      watches: [
        { ...WATCHES[1], email: "fulano@gmail.com", registered_user: { id: 9, name: "Fulano", email: "fu.lano+x@gmail.com" } },
        { ...WATCHES[2], email: "igual@marca.com", registered_user: { id: 10, name: "Igual", email: "IGUAL@marca.com" } },
      ],
    });
    await renderPage("/admin/security?tab=watchlist");
    const variation = (await screen.findByText("fulano@gmail.com")).closest("li") as HTMLElement;
    expect(within(variation).getByText("Conta: fu.lano+x@gmail.com")).toBeInTheDocument();
    const same = screen.getByText("igual@marca.com").closest("li") as HTMLElement;
    expect(within(same).queryByText(/^Conta:/)).toBeNull();
  });

  it("sem atividade: estado vazio e o aviso de 30 dias", async () => {
    serve({ activity: [] });
    const { user } = await renderPage("/admin/security?tab=watchlist");
    const dialog = await openActivity(user);
    expect(await within(dialog).findByText("Sem atividade registrada nos últimos 30 dias.")).toBeInTheDocument();
    expect(within(dialog).getByText("Registro de rotas e IPs, guardado por 30 dias, visível só para administradores. Não inclui o conteúdo das requisições.")).toBeInTheDocument();
    expect(mocks.adminGetEnvelope).toHaveBeenCalledWith("/admin/security/watchlist/2/activity", { limit: 100, offset: 0 }, expect.anything());
  });

  it("com dados: horário de Brasília, método, rota, status, ×hits, IP e aparelho", async () => {
    serve({ activity: ACTIVITY });
    const { user } = await renderPage("/admin/security?tab=watchlist");
    const dialog = await openActivity(user);
    expect(await within(dialog).findByText("/api/campaigns")).toHaveClass("adm-sec-mono");
    expect(within(dialog).getByText("10/11/2026 10:05")).toBeInTheDocument();
    expect(within(dialog).getByText("×3")).toBeInTheDocument();
    expect(within(dialog).getByText("200")).toBeInTheDocument();
    expect(within(dialog).getByText("401")).toBeInTheDocument();
    expect(within(dialog).getByText("500")).toBeInTheDocument();
    expect(within(dialog).getAllByText("iPhone/iPad").length).toBe(2);
    expect(within(dialog).getByText("Windows")).toBeInTheDocument();
    expect(within(dialog).getByText("POST")).toBeInTheDocument();
  });

  it("filtros no cliente: por IP e só erros", async () => {
    serve({ activity: ACTIVITY });
    const { user } = await renderPage("/admin/security?tab=watchlist");
    const dialog = await openActivity(user);
    await within(dialog).findByText("/api/campaigns");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Filtrar por IP" }), "198.51.100.4");
    expect(within(dialog).queryByText("/api/campaigns")).toBeNull();
    expect(within(dialog).getByText("/api/me")).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Filtrar por IP" }), "");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Filtrar por status" }), "errors");
    expect(within(dialog).queryByText("/api/campaigns")).toBeNull();
    expect(within(dialog).getByText("/api/auth/login")).toBeInTheDocument();
    expect(within(dialog).getByText("/api/me")).toBeInTheDocument();
  });

  it("403 na atividade mostra Sem permissão; rota com HTML vira texto", async () => {
    serve({ activity: "forbidden" });
    const first = await renderPage("/admin/security?tab=watchlist");
    const dialog = await openActivity(first.user);
    expect(await within(dialog).findByText("Sem permissão")).toBeInTheDocument();
    first.unmount();

    const evil = '<img src=x onerror="alert(1)">';
    serve({ activity: [{ ...ACTIVITY[0], path: evil }] });
    const second = await renderPage("/admin/security?tab=watchlist");
    const again = await openActivity(second.user);
    expect(await within(again).findByText(evil)).toBeInTheDocument();
    expect(again.querySelector("img")).toBeNull();
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
  it("abre mostrando só os ativos; o encerrado só aparece em Todos ou Inativos", async () => {
    const { user } = await renderPage("/admin/security?tab=watchlist");
    const list = await screen.findByRole("list", { name: "E-mails vigiados" });
    expect(screen.getByRole("combobox", { name: "Estado" })).toHaveValue("active");
    expect(within(list).getAllByRole("listitem").map((row) => within(row).getByText(/@marca\.com$/).textContent)).toEqual(["sem-conta@marca.com", "novo@marca.com"]);
    await chooseFilter(user, "Estado", "inactive");
    expect(within(screen.getByRole("list", { name: "E-mails vigiados" })).getAllByRole("listitem")).toHaveLength(1);
    await chooseFilter(user, "Estado", "all");
    expect(within(screen.getByRole("list", { name: "E-mails vigiados" })).getAllByRole("listitem")).toHaveLength(3);
  });

  it("sem nenhum ativo, avisa e oferece 'Ver todos' (o histórico dos encerrados)", async () => {
    serve({ watches: [WATCHES[0]] });
    const { user } = await renderPage("/admin/security?tab=watchlist");
    expect(await screen.findByText("Nenhum vigiado ativo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver todos" }));
    expect(await screen.findByText("antigo@marca.com")).toBeInTheDocument();
  });

  it("lista ativos primeiro, com a indicação de conta e o aviso de privacidade", async () => {
    const { user } = await renderPage("/admin/security?tab=watchlist");
    await screen.findByRole("list", { name: "E-mails vigiados" });
    await chooseFilter(user, "Estado", "all");
    const list = screen.getByRole("list", { name: "E-mails vigiados" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => within(row).getByText(/@marca\.com$/).textContent)).toEqual(["sem-conta@marca.com", "novo@marca.com", "antigo@marca.com"]);
    expect(within(rows[0]).getByText("Ainda sem conta")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Caio Teodoro")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Já tem conta")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Inativo")).toBeInTheDocument();
    // encerrado e sem conta: o menu "⋯" só tem "Ver atividade" (nada de Ver conta nem Parar de vigiar)
    await userEvent.click(within(rows[2]).getByRole("button", { name: "Ações de antigo@marca.com" }));
    expect(await screen.findByRole("menuitem", { name: "Ver atividade" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Ver conta" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Parar de vigiar" })).toBeNull();
    await userEvent.keyboard("{Escape}");
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
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/security/watchlist", { email: "fulano@marca.com", reason: "abcde", days: 7 }));
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("409 WATCH_ALREADY_ACTIVE mostra que o e-mail já é vigiado e mantém o diálogo aberto", async () => {
    mocks.adminPostPlain.mockRejectedValue(toAdminApiError(409, { statusCode: 409, error: "WATCH_ALREADY_ACTIVE", message: "Esse e-mail já está na lista de vigiados." }));
    const { user } = await renderPage("/admin/security?tab=watchlist");
    await user.click(await screen.findByRole("button", { name: "Vigiar e-mail" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("E-mail"), "novo@marca.com");
    await user.type(within(dialog).getByLabelText("Motivo"), "Suspeita de fraude");
    await user.click(within(dialog).getByRole("button", { name: "Vigiar" }));
    expect(await within(dialog).findByText("Esse e-mail já está na lista de vigiados.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("409 de variação do e-mail (Gmail com pontos ou +algo) mostra a mensagem da API", async () => {
    mocks.adminPostPlain.mockRejectedValue(toAdminApiError(409, { statusCode: 409, error: "WATCH_ALREADY_ACTIVE", message: "Uma variação desse e-mail já está na lista de vigiados." }));
    const { user } = await renderPage("/admin/security?tab=watchlist");
    await user.click(await screen.findByRole("button", { name: "Vigiar e-mail" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("E-mail"), "no.vo+x@marca.com");
    await user.type(within(dialog).getByLabelText("Motivo"), "Suspeita de fraude");
    await user.click(within(dialog).getByRole("button", { name: "Vigiar" }));
    expect(await within(dialog).findByText("Uma variação desse e-mail já está na lista de vigiados.")).toBeInTheDocument();
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

describe("Segurança: prazo da vigilância", () => {
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

  async function openDialog() {
    const { user } = await renderPage("/admin/security?tab=watchlist");
    await user.click(await screen.findByRole("button", { name: "Vigiar e-mail" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("E-mail"), "fulano@marca.com");
    await user.type(within(dialog).getByLabelText("Motivo"), "Suspeita de fraude");
    return { user, dialog };
  }

  it("oferece 7 dias (sugerido), 30, 90 e sem prazo; 7 dias já vem escolhido", async () => {
    const { dialog } = await openDialog();
    const group = within(dialog).getByRole("radiogroup", { name: "Prazo da vigilância" });
    expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["7 diasSugerido", "30 dias", "90 dias", "Sem prazo"]);
    expect(within(group).getByRole("radio", { name: /7 dias/ })).toHaveAttribute("aria-checked", "true");
  });

  it("30 dias envia days: 30; 'Sem prazo' não envia days", async () => {
    mocks.adminPostPlain.mockResolvedValue({ id: 10, reactivated: false, expires_at: null });
    const first = await openDialog();
    await first.user.click(within(first.dialog).getByRole("radio", { name: "30 dias" }));
    await first.user.click(within(first.dialog).getByRole("button", { name: "Vigiar" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenLastCalledWith("/admin/security/watchlist", { email: "fulano@marca.com", reason: "Suspeita de fraude", days: 30 }));
    cleanup();

    const second = await openDialog();
    await second.user.click(within(second.dialog).getByRole("radio", { name: "Sem prazo" }));
    await second.user.click(within(second.dialog).getByRole("button", { name: "Vigiar" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledTimes(2));
    expect(mocks.adminPostPlain).toHaveBeenLastCalledWith("/admin/security/watchlist", { email: "fulano@marca.com", reason: "Suspeita de fraude" });
  });

  it("a lista mostra 'Vigiado até', 'Sem prazo', o destaque âmbar de 2 dias ou menos e 'Prazo encerrado'", async () => {
    const watches: SecurityWatch[] = [
      { ...WATCHES[1], id: 21, email: "longe@marca.com", expires_at: inDays(20) },
      { ...WATCHES[1], id: 22, email: "perto@marca.com", expires_at: inDays(1.5) },
      { ...WATCHES[2], id: 23, email: "livre@marca.com", expires_at: null },
      { ...WATCHES[0], id: 24, email: "vencido@marca.com", expires_at: inDays(-3) },
    ];
    serve({ watches });
    const { user } = await renderPage("/admin/security?tab=watchlist");
    await chooseFilter(user, "Estado", "all");
    const card = (email: string) => screen.getByText(email).closest("li") as HTMLElement;
    expect(within(card("longe@marca.com")).getByText(/Vigiado até/)).toBeInTheDocument();
    expect(within(card("longe@marca.com")).queryByText(/vence em/)).not.toBeInTheDocument();
    const soon = within(card("perto@marca.com"));
    expect(soon.getByText(/vence em 2 dias/)).toBeInTheDocument();
    expect(card("perto@marca.com").querySelector('[data-state="soon"]')).not.toBeNull();
    expect(within(card("livre@marca.com")).getByText("Sem prazo")).toBeInTheDocument();
    expect(within(card("vencido@marca.com")).getByText(/Prazo encerrado/)).toBeInTheDocument();
  });

  it("reativar um inativo abre o mesmo formulário com e-mail e motivo e deixa escolher o prazo", async () => {
    mocks.adminPostPlain.mockResolvedValue({ id: 1, reactivated: true, expires_at: inDays(90) });
    const { user } = await renderPage("/admin/security?tab=watchlist");
    await chooseFilter(user, "Estado", "inactive");
    const card = screen.getByText("antigo@marca.com").closest("li") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: /Ações de antigo@marca.com/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Reativar vigilância" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("E-mail")).toHaveValue("antigo@marca.com");
    await user.click(within(dialog).getByRole("radio", { name: "90 dias" }));
    await user.click(within(dialog).getByRole("button", { name: "Reativar" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/security/watchlist", { email: "antigo@marca.com", reason: "Caso encerrado", days: 90 }));
  });
});

describe("Segurança: alerta de comportamento e aviso por e-mail", () => {
  const behavior = (signal: string, count: number, extra: Partial<SecurityAlert> = {}): SecurityAlert =>
    ({
      id: 70,
      kind: "watched_behavior",
      severity: signal === "withdrawal" ? "high" : "medium",
      title: "Conta vigiada fez algo",
      details: {
        signal,
        count,
        window_minutes: 60,
        top_routes: [
          { route: "/app/campaigns/1/join", hits: 9 },
          { route: "/app/campaigns/2/join", hits: 4 },
          { route: "/a", hits: 3 },
          { route: "/b", hits: 2 },
          { route: "/c", hits: 2 },
          { route: "/d-cortada", hits: 1 },
        ],
      },
      created_at: "2026-11-10T01:30:00Z",
      seen_at: null,
      note: null,
      user: { id: 42, name: "Bia Santos", email: "bia@marca.com" },
      ...extra,
    }) as SecurityAlert;

  it.each([
    ["many_joins", 12, "Muitas inscrições · 12 na última hora"],
    ["social_churn", 3, "Mexeu nas redes sociais · 3 vezes na última hora"],
    ["multi_ip", 4, "Acessou de vários IPs · 4 IPs diferentes na última hora"],
    ["withdrawal", 1, "Pediu saque"],
  ])("sinal %s mostra o resumo em português", async (signal, count, text) => {
    serve({ alerts: [behavior(signal, count)] });
    await renderPage();
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("lista as rotas mais chamadas com a quantidade, no máximo 5 linhas, como texto", async () => {
    serve({ alerts: [behavior("many_joins", 12)] });
    await renderPage();
    const routes = await screen.findByRole("list", { name: "Rotas mais chamadas" });
    const rows = within(routes).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("/app/campaigns/1/join9×");
    expect(within(routes).queryByText("/d-cortada")).not.toBeInTheDocument();
  });

  it("saque tem severidade alta; sinal desconhecido mostra só o título", async () => {
    serve({ alerts: [behavior("withdrawal", 1), behavior("sinal_novo", 5, { id: 71, title: "Algo que o painel ainda não conhece" })] });
    await renderPage();
    const list = within(await screen.findByRole("list", { name: "Alertas de segurança" }));
    const byTitle = (title: string) => list.getByText(title).closest("li") as HTMLElement;
    expect(byTitle("Conta vigiada fez algo")).toHaveAttribute("data-severity", "high");
    const unknown = byTitle("Algo que o painel ainda não conhece");
    expect(within(unknown).queryByRole("list", { name: "Rotas mais chamadas" })).not.toBeInTheDocument();
    expect(unknown).toHaveAttribute("data-kind", "watched_behavior");
  });

  it("o atalho para a atividade aparece quando o alerta traz watchlist_id", async () => {
    serve({ alerts: [behavior("many_joins", 12, { watchlist_id: 2 })] });
    const { user } = await renderPage();
    await user.click(await screen.findByRole("button", { name: /Ações do alerta 70/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Ver atividade" }));
    await waitFor(() => expect(mocks.adminGetEnvelope).toHaveBeenCalledWith("/admin/security/watchlist/2/activity", { limit: 100, offset: 0 }, expect.anything()));
  });

  it("a página avisa que alertas de severidade alta também saem por e-mail", async () => {
    await renderPage();
    expect(screen.getByText("Alertas de severidade alta também são enviados por e-mail à equipe.")).toBeInTheDocument();
  });
});

/** O jsdom não tem PointerEvent: um MouseEvent com o nome do evento de ponteiro leva o clientX até o React. */
const pointer = (el: Element, type: "pointerdown" | "pointermove" | "pointerup", clientX: number) =>
  fireEvent(el, new MouseEvent(type, { bubbles: true, cancelable: true, clientX }));

describe("Segurança: Operação Escudo", () => {
  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
  const ON = { configured: true, active: true, id: 3, activated_at: new Date().toISOString(), expires_at: inHours(5), reason: "Onda de cadastros falsos", activated_by: { user_id: 1, name: "Marina" } };

  /** O botão é "arrastar para confirmar": no teste, a forma de teclado (Enter) faz o mesmo gesto. */
  async function slide(user: ReturnType<typeof userEvent.setup>, name: string) {
    const thumb = await screen.findByRole("button", { name });
    thumb.focus();
    await user.keyboard("{Enter}");
  }

  async function shieldCard() {
    const ctx = await renderPage("/admin/security?tab=shield");
    // As ações (Ativar/Encerrar) ficam na ilha e os dados no cartão: o escopo é a página inteira.
    return { ...ctx, card: within(document.body) };
  }

  it("sem `configured`: cartão desabilitado com 'Configuração pendente no servidor'", async () => {
    serve({ shield: { ...SHIELD_OFF, configured: false } });
    const { card } = await shieldCard();
    expect((await card.findAllByText("Configuração pendente no servidor.")).length).toBeGreaterThan(0);
    expect(card.queryByRole("button", { name: "Ativar Operação Escudo" })).not.toBeInTheDocument();
  });

  it("desligado: janela com motivo, duração (24 h marcada), lista do que muda e código; envia reason, hours e code", async () => {
    mocks.adminPostPlain.mockResolvedValue({ ...ON });
    const { user } = await shieldCard();
    await slide(user, "Ativar Operação Escudo");
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("radio", { name: /24 horas/ })).toHaveAttribute("aria-checked", "true");
    expect(dialog.getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual(["6 horas", "12 horas", "24 horas", "48 horas", "72 horas"]);
    // as regras já estão na tela (O que muda): a janela não repete a lista, e não mostra erro antes de tentar enviar
    expect(dialog.queryByText(/limites da sentinela caem pela metade/)).not.toBeInTheDocument();
    expect(dialog.queryByRole("alert")).not.toBeInTheDocument();
    // sem motivo e código, não envia
    await user.click(dialog.getByRole("button", { name: "Ativar Escudo" }));
    expect(mocks.adminPostPlain).not.toHaveBeenCalled();
    await user.type(dialog.getByLabelText("Motivo"), "Onda de cadastros falsos");
    await user.click(dialog.getByRole("radio", { name: /48 horas/ }));
    await user.type(dialog.getByLabelText("Código do Authenticator"), "12a34b56");
    await user.click(dialog.getByRole("button", { name: "Ativar Escudo" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/security/shield/activate", { reason: "Onda de cadastros falsos", hours: 48, code: "123456" }));
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("código errado: mostra a mensagem em português, mantém a janela aberta e limpa o campo", async () => {
    mocks.adminPostPlain.mockRejectedValueOnce(toAdminApiError(403, { message: "x", error: "SHIELD_CODE_INVALID" }));
    const { user } = await shieldCard();
    await slide(user, "Ativar Operação Escudo");
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Motivo"), "Teste de motivo");
    await user.type(dialog.getByLabelText("Código do Authenticator"), "000000");
    await user.click(dialog.getByRole("button", { name: "Ativar Escudo" }));
    expect(await dialog.findByText(/Código inválido ou já usado/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(dialog.getByLabelText("Código do Authenticator")).toHaveValue("");
  });

  it("5 erros travam: mostra 'Aguarde 15 minutos' e desabilita o envio", async () => {
    mocks.adminPostPlain.mockRejectedValueOnce(toAdminApiError(403, { message: "x", error: "SHIELD_CODE_LOCKED" }));
    const { user } = await shieldCard();
    await slide(user, "Ativar Operação Escudo");
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Motivo"), "Teste de motivo");
    await user.type(dialog.getByLabelText("Código do Authenticator"), "000000");
    await user.click(dialog.getByRole("button", { name: "Ativar Escudo" }));
    expect(await dialog.findByText("Muitas tentativas. Aguarde 15 minutos.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Ativar Escudo" })).toBeDisabled();
  });

  it("ligado: mostra motivo, quem ativou e 'Encerrar' (pede o código)", async () => {
    serve({ shield: ON });
    mocks.adminPostPlain.mockResolvedValue({ ...ON, active: false });
    const { user, card } = await shieldCard();
    expect(await card.findByText("Onda de cadastros falsos")).toBeInTheDocument();
    expect(card.getByText("Marina")).toBeInTheDocument();
    expect(card.queryByRole("button", { name: "Ativar Operação Escudo" })).not.toBeInTheDocument();
    await slide(user, "Encerrar Escudo");
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("button", { name: "Encerrar Escudo" })).toBeDisabled();
    await user.type(dialog.getByLabelText("Código do Authenticator"), "654321");
    await user.click(dialog.getByRole("button", { name: "Encerrar Escudo" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/security/shield/deactivate", { code: "654321" }));
  });

  const HELD = {
    accounts: 3,
    withdrawals: 2,
    withdrawals_list: [
      { withdrawal_id: 11, user_id: 7, amount_cents: 15000, status: "pending", held_at: new Date(Date.now() - 3_600_000).toISOString() },
      { withdrawal_id: 12, user_id: 8, amount_cents: 2550, status: "pending", held_at: new Date(Date.now() - 7_200_000).toISOString() },
    ],
  };

  it("'Retido pelo Escudo' não existe sem retenções e aparece com elas, mesmo com o Escudo desligado", async () => {
    await renderPage("/admin/security?tab=shield");
    await screen.findByRole("button", { name: "Ativar Operação Escudo" });
    expect(screen.queryByText("Retido pelo Escudo")).not.toBeInTheDocument();
    cleanup();
    serve({ held: HELD });
    await renderPage("/admin/security?tab=shield");
    expect(await screen.findByText("Retido pelo Escudo")).toBeInTheDocument();
    expect(screen.getByText("contas em análise")).toBeInTheDocument();
    expect(screen.getByText("saques em espera")).toBeInTheDocument();
    expect(screen.getByText("#11")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?150,00/)).toBeInTheDocument();
  });

  it("'Liberar tudo' avisa do PIX, pede o código e mostra X contas e Y saques liberados", async () => {
    serve({ held: HELD });
    mocks.adminPostPlain.mockResolvedValue({ accounts_released: 3, withdrawals_released: 2 });
    await renderPage("/admin/security?tab=shield");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Liberar tudo" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Liberar um saque dispara o PIX na hora. Não dá para desfazer.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Liberar tudo" })).toBeDisabled();
    await user.type(dialog.getByLabelText("Código do Authenticator"), "123456");
    await user.click(dialog.getByRole("button", { name: "Liberar tudo" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/security/shield/release", { what: "all", code: "123456" }));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("3 contas e 2 saques liberados.", expect.anything());
  });

  it("liberar só os saques marcados manda withdrawal_ids; contas não levam aviso de PIX", async () => {
    serve({ held: HELD });
    mocks.adminPostPlain.mockResolvedValue({ accounts_released: 0, withdrawals_released: 1 });
    await renderPage("/admin/security?tab=shield");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox", { name: "Marcar o saque 12" }));
    await user.click(screen.getByRole("button", { name: "Liberar 1 saque marcado" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Código do Authenticator"), "123456");
    await user.click(dialog.getByRole("button", { name: "Liberar saques" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/security/shield/release", { what: "withdrawals", withdrawal_ids: [12], code: "123456" }));
    cleanup();
    await renderPage("/admin/security?tab=shield");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Liberar contas" }));
    const accountsDialog = within(await screen.findByRole("dialog"));
    expect(accountsDialog.queryByText(/dispara o PIX/)).not.toBeInTheDocument();
  });

  it("os alertas do Escudo mostram o título e o que mudou", async () => {
    const shieldAlert = (kind: string, severity: "high" | "medium", title: string, details?: object): SecurityAlert =>
      ({ id: Math.floor(Math.random() * 1e6), kind, severity, title, details, created_at: "2026-11-10T01:30:00Z", seen_at: null, note: null, user: null }) as unknown as SecurityAlert;
    serve({
      alerts: [
        shieldAlert("shield_activated", "high", "Operação Escudo ativada"),
        shieldAlert("shield_ended", "high", "Operação Escudo encerrada", { end_kind: "expired" }),
        shieldAlert("shield_released", "medium", "Retenções liberadas", { accounts: 2, withdrawals: 1 }),
      ],
    });
    await renderPage();
    const list = within(await screen.findByRole("list", { name: "Alertas de segurança" }));
    expect(list.getByText("Terminou no prazo")).toBeInTheDocument();
    expect(list.getByText("2 contas liberadas e 1 saque liberado")).toBeInTheDocument();
    const items = list.getAllByRole("listitem");
    expect(items.map((i) => i.getAttribute("data-severity"))).toEqual(["high", "high", "medium"]);
  });

  it("o Escudo é uma aba própria; ligado, aparece o chip nas outras abas e o selo 'ligado' na aba", async () => {
    serve({ shield: ON });
    const { user } = await renderPage();
    const tabs = within(screen.getByRole("group", { name: "Seções de Segurança" }));
    expect(tabs.getAllByRole("button").map((b) => b.textContent?.replace(/ligado|\d+/, "").trim())).toEqual(["Alertas", "Vigiados", "Escudo"]);
    expect(await tabs.findByText("ligado")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: /Tempo do Escudo/ })).not.toBeInTheDocument();
    await user.click(tabs.getByRole("button", { name: /Escudo/ }));
    expect(await screen.findByRole("progressbar", { name: /Tempo do Escudo/ })).toBeInTheDocument();
  });

  it("abaixo da ilha, o que muda vem lado a lado (um passo por ícone, sem cartões)", async () => {
    await renderPage("/admin/security?tab=shield");
    const changes = await screen.findByRole("region", { name: "O que muda com a Operação Escudo" });
    const items = within(changes).getAllByRole("listitem");
    expect(items).toHaveLength(7);
    expect(within(changes).getByText("Código a cada alteração")).toBeInTheDocument();
    expect(within(changes).getByText("Saques em espera")).toBeInTheDocument();
    // a frase inteira fica na dica de cada passo
    expect(within(changes).getByText("Código a cada alteração").closest("li")).toHaveAttribute("title", "Toda alteração no Admin pede o código do Authenticator.");
    expect(within(changes).getByRole("heading", { name: "O que muda" })).toBeInTheDocument();
    // sem os cartões de antes
    expect(document.querySelector(".adm-shield-tiles")).toBeNull();
  });

  it("com o Escudo ligado o título vira 'O que está valendo'", async () => {
    serve({ shield: ON });
    await renderPage("/admin/security?tab=shield");
    expect(await screen.findByRole("heading", { name: "O que está valendo" })).toBeInTheDocument();
  });

  it("o botão de ativar fica na ilha, ao lado da personagem", async () => {
    const { user } = await renderPage("/admin/security?tab=shield");
    const island = within(screen.getByRole("region", { name: "Segurança" }));
    const button = await island.findByRole("button", { name: "Ativar Operação Escudo" });
    // o botão divide o canto direito com a sentinela
    expect(button.closest(".adm-sec-shield-cta")?.querySelector(".adm-sentinel")).not.toBeNull();
    // só clicar não ativa nada: é preciso arrastar (ou usar o teclado)
    await user.click(button);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    button.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Ativar Operação Escudo" })).toBeInTheDocument();
  });

  it("arrastar o círculo até o fim abre a janela; soltar antes do fim volta ao início", async () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 268 });
    try {
      await renderPage("/admin/security?tab=shield");
      const thumb = await screen.findByRole("button", { name: "Ativar Operação Escudo" });
      // solta no meio do trilho: nada acontece e o círculo volta
      pointer(thumb, "pointerdown", 0);
      pointer(thumb, "pointermove", 80);
      pointer(thumb, "pointerup", 80);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(thumb.style.transform).toBe("translateX(0px)");
      // leva até o fim: abre a janela do Escudo
      pointer(thumb, "pointerdown", 0);
      pointer(thumb, "pointermove", 300);
      pointer(thumb, "pointerup", 300);
      expect(await screen.findByRole("dialog", { name: "Ativar Operação Escudo" })).toBeInTheDocument();
    } finally {
      delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth;
    }
  });

  it("com o Escudo ligado, o título da ilha é o do Escudo em qualquer aba (no lugar de 'Tudo tranquilo')", async () => {
    serve({ shield: ON });
    const { user } = await renderPage("/admin/security?tab=alerts");
    const island = within(screen.getByRole("region", { name: "Segurança" }));
    expect(await island.findByText("Operação Escudo")).toBeInTheDocument();
    expect(island.queryByText("Tudo tranquilo")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Vigiados" }));
    expect(await island.findByText("Operação Escudo")).toBeInTheDocument();
    expect(island.queryByText("Tudo tranquilo")).not.toBeInTheDocument();
  });

  it("desligado, volta a 'Tudo tranquilo' nas abas de alertas e vigiados", async () => {
    serve({ alerts: [] });
    await renderPage();
    expect(await screen.findByText("Tudo tranquilo")).toBeInTheDocument();
  });
});

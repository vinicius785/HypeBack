/**
 * Suporte no Admin.
 *
 * O QUE PRECISA FUNCIONAR:
 *   - lista os pedidos ativos (nº, assunto, solicitante, origem, prioridade, status, responsável) com as contagens do `meta.counts`;
 *   - filtros (origem, prioridade, responsável) e busca viram parâmetros da chamada;
 *   - quem tem `support.manage` muda status/prioridade/responsável e responde (com Idempotency-Key) ou deixa nota interna;
 *   - pedido do site (sem conta) avisa que a resposta não chega e oferece o e-mail.
 *
 * O QUE NÃO PODE ACONTECER:
 *   - suporte sem a permissão ou somente leitura ver campos de edição ou o campo de resposta;
 *   - enviar mensagem vazia.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminList: vi.fn(),
  adminPost: vi.fn(),
  adminPatch: vi.fn(),
  auth: { user: null as Record<string, unknown> | null },
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: mocks.adminGet, adminList: mocks.adminList, adminPost: mocks.adminPost, adminPatch: mocks.adminPatch };
});
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: mocks.auth.user, setUser: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import type { SupportTicket, SupportTicketDetail } from "@/shared/services/admin-support";

import { listResult } from "../users/admin-users-test-data";
import { renderRoutes, stubRoute } from "../users/admin-users-test-utils";
import { AdminSupportPage } from "./support-page";

const ticket = (over: Partial<SupportTicket> = {}): SupportTicket => ({
  id: "t1",
  number: 1042,
  source: "app",
  status: "open",
  priority: "high",
  category: "bug",
  subject: "Não consigo sacar meu saldo",
  preview: "Ao tocar em sacar o app trava",
  requester: { user_id: 10, name: "Lúcia Prado", email: "lucia@casa.com", phone: null },
  workspace: null,
  context: { platform: "iOS", app_version: "2.4.1" },
  assignee: null,
  messages_count: 1,
  last_message_at: "2026-11-05T10:00:00Z",
  created_at: "2026-11-05T10:00:00Z",
  updated_at: "2026-11-05T10:00:00Z",
  resolved_at: null,
  ...over,
});

const detail = (over: Partial<SupportTicketDetail> = {}): SupportTicketDetail => ({
  ...ticket(),
  messages: [
    { id: "m1", author_type: "requester", author: { id: 10, name: "Lúcia Prado", avatar: null }, body: "Ao tocar em sacar o app trava", created_at: "2026-11-05T10:00:00Z" },
    { id: "m2", author_type: "note", author: { id: 1, name: "Marina", avatar: null }, body: "Parece o bug do saque", created_at: "2026-11-05T10:05:00Z" },
  ],
  ...over,
});

const COUNTS = { by_status: { open: 3, in_progress: 1, waiting: 0, resolved: 5, closed: 2 }, by_source: { platform: 1, app: 3, site: 0 }, unassigned: 4, mine: 1 };
const ADMIN = { id: 1, name: "Marina", is_platform_admin: true, platform_role: "admin" };
const ROUTES = [{ path: "/admin/support", component: AdminSupportPage }, stubRoute("/admin/workspaces/$workspaceId")];

function serve(rows: SupportTicket[], d: SupportTicketDetail = detail(), permissions: string[] = ["read", "support.manage"]) {
  mocks.adminList.mockImplementation(async () => ({ ...listResult(rows as never, rows.length), meta: { ...listResult(rows as never, rows.length).meta, counts: COUNTS } }));
  mocks.adminGet.mockImplementation(async (path: string) => {
    if (path.startsWith("/admin/support/tickets/")) return d;
    if (path === "/admin/platform-team") return { roles: [], members: [{ user_id: 1, name: "Marina", email: "m@h.com", role: "admin", status: "active" }, { user_id: 7, name: "Caio", email: "c@h.com", role: "support", status: "active" }] };
    return { user_id: 7, role: "support", permissions };
  });
  mocks.adminPost.mockResolvedValue({ id: "m3" });
  mocks.adminPatch.mockResolvedValue(ticket());
}

async function renderPage() {
  const view = renderRoutes(ROUTES, "/admin/support");
  await screen.findByRole("heading", { level: 1, name: "Suporte" });
  return { ...view, user: userEvent.setup() };
}

beforeEach(() => {
  for (const m of [mocks.adminGet, mocks.adminList, mocks.adminPost, mocks.adminPatch]) m.mockReset();
  mocks.auth.user = ADMIN;
});

describe("Suporte (Admin)", () => {
  it("lista os ativos com nº, assunto, solicitante, origem, prioridade e status, e mostra as contagens", async () => {
    serve([ticket()]);
    await renderPage();
    const row = (await screen.findByText("Não consigo sacar meu saldo")).closest('[role="row"]') as HTMLElement;
    expect(within(row).getByText("#1042")).toBeInTheDocument();
    expect(within(row).getByText("Lúcia Prado")).toBeInTheDocument();
    expect(within(row).getByText("App")).toBeInTheDocument();
    expect(within(row).getByText("Alta")).toBeInTheDocument();
    expect(within(row).getByText("Aberto")).toBeInTheDocument();
    expect(within(row).getByText("Sem responsável")).toBeInTheDocument();
    expect(mocks.adminList).toHaveBeenCalledWith("/admin/support/tickets", expect.objectContaining({ status: "active", page: 1 }), expect.anything());
    expect(await screen.findByRole("tab", { name: /Ativos/ })).toHaveTextContent("4");
    expect(screen.getByRole("tab", { name: /Resolvidos/ })).toHaveTextContent("7");
  });

  it("filtros e busca viram parâmetros da chamada", async () => {
    serve([ticket()]);
    const { user } = await renderPage();
    await screen.findByText("Não consigo sacar meu saldo");
    await user.selectOptions(screen.getByLabelText("Origem"), "site");
    await user.selectOptions(screen.getByLabelText("Prioridade"), "urgent");
    await user.selectOptions(screen.getByLabelText("Responsável"), "none");
    await waitFor(() =>
      expect(mocks.adminList).toHaveBeenLastCalledWith("/admin/support/tickets", expect.objectContaining({ source: "site", priority: "urgent", assigned: "none" }), expect.anything()),
    );
    await user.click(screen.getByRole("tab", { name: /Resolvidos/ }));
    await waitFor(() => expect(mocks.adminList).toHaveBeenLastCalledWith("/admin/support/tickets", expect.objectContaining({ status: "resolved_all" }), expect.anything()));
  });

  it("estado vazio explica de onde vêm os pedidos", async () => {
    serve([]);
    await renderPage();
    expect(await screen.findByText("Nenhum pedido em aberto")).toBeInTheDocument();
  });

  it("abre o pedido, muda o status e assume o responsável", async () => {
    serve([ticket()]);
    const { user } = await renderPage();
    await user.click(await screen.findByRole("button", { name: /Não consigo sacar/ }));
    const drawer = within(await screen.findByRole("dialog"));
    expect(await drawer.findByText("Parece o bug do saque")).toBeInTheDocument();
    expect(drawer.getAllByText("Nota interna").length).toBeGreaterThan(0);
    await user.selectOptions(drawer.getByLabelText("Status"), "in_progress");
    await waitFor(() => expect(mocks.adminPatch).toHaveBeenCalledTimes(1));
    expect(mocks.adminPatch.mock.calls[0][0]).toBe("/admin/support/tickets/t1");
    expect(mocks.adminPatch.mock.calls[0][1]).toEqual({ status: "in_progress" });
    expect(mocks.adminPatch.mock.calls[0][2].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    await user.click(drawer.getByRole("button", { name: "Assumir" }));
    await waitFor(() => expect(mocks.adminPatch).toHaveBeenCalledTimes(2));
    expect(mocks.adminPatch.mock.calls[1][1]).toEqual({ assignee_id: 1 });
  });

  it("responde marcando como resolvido, deixa nota e recusa mensagem vazia", async () => {
    serve([ticket()]);
    const { user } = await renderPage();
    await user.click(await screen.findByRole("button", { name: /Não consigo sacar/ }));
    const drawer = within(await screen.findByRole("dialog"));
    await drawer.findByLabelText("Resposta");
    await user.click(drawer.getByRole("button", { name: "Enviar resposta" }));
    expect(drawer.getByRole("alert")).toHaveTextContent("Escreva a resposta.");
    expect(mocks.adminPost).not.toHaveBeenCalled();
    await user.type(drawer.getByLabelText("Resposta"), "Já corrigimos, atualize o app.");
    await user.selectOptions(drawer.getByLabelText("Depois de enviar"), "resolved");
    await user.click(drawer.getByRole("button", { name: "Enviar resposta" }));
    await waitFor(() => expect(mocks.adminPost).toHaveBeenCalledTimes(1));
    expect(mocks.adminPost.mock.calls[0][0]).toBe("/admin/support/tickets/t1/messages");
    expect(mocks.adminPost.mock.calls[0][1]).toEqual({ body: "Já corrigimos, atualize o app.", kind: "reply", status: "resolved" });
    expect(mocks.adminPost.mock.calls[0][2].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);

    await user.click(drawer.getByRole("radio", { name: "Nota interna" }));
    await user.type(drawer.getByLabelText("Nota interna"), "Cliente já avisado por telefone");
    await user.click(drawer.getByRole("button", { name: "Salvar nota" }));
    await waitFor(() => expect(mocks.adminPost).toHaveBeenCalledTimes(2));
    expect(mocks.adminPost.mock.calls[1][1]).toEqual({ body: "Cliente já avisado por telefone", kind: "note" });
  });

  it("pedido do site (sem conta) avisa que a resposta não chega e oferece o e-mail", async () => {
    const site = ticket({ id: "t2", source: "site", requester: { user_id: null, name: "Visitante", email: "v@x.com", phone: null } });
    serve([site], detail({ ...site, messages: [] }));
    const { user } = await renderPage();
    await user.click(await screen.findByRole("button", { name: /Não consigo sacar/ }));
    const drawer = within(await screen.findByRole("dialog"));
    expect(await drawer.findByText(/não tem conta na plataforma/)).toBeInTheDocument();
    expect(drawer.getByRole("link", { name: "v@x.com" })).toHaveAttribute("href", expect.stringContaining("mailto:v@x.com"));
  });

  it("pedido fechado só aceita nota interna", async () => {
    const closed = ticket({ status: "closed" });
    serve([closed], detail({ ...closed }));
    const { user } = await renderPage();
    await user.click(await screen.findByRole("button", { name: /Não consigo sacar/ }));
    const drawer = within(await screen.findByRole("dialog"));
    expect(await drawer.findByText(/só é possível deixar notas internas/)).toBeInTheDocument();
    expect(drawer.getByRole("radio", { name: "Responder" })).toBeDisabled();
    expect(drawer.getByRole("button", { name: "Salvar nota" })).toBeInTheDocument();
  });

  it("sem a permissão `support.manage` (somente leitura) não há edição nem resposta", async () => {
    mocks.auth.user = { id: 9, name: "Visitante", platform_role: "viewer" };
    serve([ticket()], detail(), ["read"]);
    const { user } = await renderPage();
    await user.click(await screen.findByRole("button", { name: /Não consigo sacar/ }));
    const drawer = within(await screen.findByRole("dialog"));
    expect(await drawer.findByText("Parece o bug do saque")).toBeInTheDocument();
    expect(drawer.queryByLabelText("Status")).not.toBeInTheDocument();
    expect(drawer.queryByLabelText("Resposta")).not.toBeInTheDocument();
    expect(drawer.queryByRole("button", { name: "Assumir" })).not.toBeInTheDocument();
  });
});

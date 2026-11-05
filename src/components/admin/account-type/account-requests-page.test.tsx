/**
 * Solicitações de tipo de conta no Admin.
 *
 * O QUE PRECISA FUNCIONAR:
 *   - pendentes por padrão (com a contagem), histórico na outra aba; cada linha mostra workspace, responsável, mudança,
 *     justificativa, data e status;
 *   - o administrador aprova (Idempotency-Key, sem motivo obrigatório) e rejeita (motivo obrigatório);
 *   - detalhes mostram a justificativa inteira, a decisão e o histórico do workspace.
 *
 * O QUE NÃO PODE ACONTECER:
 *   - botões de aprovar/rejeitar para quem não é administrador (suporte e somente leitura só leem);
 *   - rejeitar sem motivo.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminList: vi.fn(),
  adminPost: vi.fn(),
  toastSuccess: vi.fn(),
  auth: { user: null as Record<string, unknown> | null },
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: mocks.adminGet, adminList: mocks.adminList, adminPost: mocks.adminPost };
});
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: mocks.auth.user, setUser: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));

import type { AccountTypeRequest } from "@/shared/services/account-type-requests";

import { listResult } from "../users/admin-users-test-data";
import { renderRoutes, stubRoute } from "../users/admin-users-test-utils";
import { AdminAccountTypeRequestsPage } from "./account-requests-page";

const req = (over: Partial<AccountTypeRequest> = {}): AccountTypeRequest => ({
  id: "r1",
  status: "pending",
  current_type: "brand",
  requested_type: "agency",
  justification: "Passamos a atender várias marcas e precisamos separar as campanhas.",
  requested_at: "2026-11-04T10:00:00Z",
  requested_by: { id: 10, name: "Lúcia Prado", email: "lucia@casa.com" },
  decided_at: null,
  decided_by: null,
  decision_reason: null,
  workspace: { id: "0a0a0a0a-0000-4000-8000-000000000007", name: "Casa Aurora", photo: null, account_type: "brand" },
  ...over,
});

const ADMIN = { id: 1, name: "Marina", is_platform_admin: true, platform_role: "admin" };
const ROUTES = [{ path: "/admin/account-requests", component: AdminAccountTypeRequestsPage }, stubRoute("/admin/workspaces/$workspaceId")];

function serve(rows: AccountTypeRequest[]) {
  mocks.adminList.mockImplementation(async (_p: string, params?: Record<string, unknown>) => {
    const decided = params?.status === "decided";
    const filtered = rows.filter((r) => (decided ? r.status !== "pending" : r.status === "pending"));
    return listResult(filtered as never, filtered.length, { page: 1, per_page: Number(params?.per_page ?? 20) });
  });
  mocks.adminGet.mockImplementation(async (path: string) => {
    if (path.startsWith("/admin/workspace-account-type-requests/")) {
      return { request: rows[0], history: [req({ id: "old", status: "rejected", decided_at: "2026-10-01T10:00:00Z", decision_reason: "Faltou o contrato" })] };
    }
    return { user_id: 7, role: "support", permissions: ["read"] };
  });
  mocks.adminPost.mockResolvedValue(req({ status: "approved" }));
}

async function renderPage() {
  const view = renderRoutes(ROUTES, "/admin/account-requests");
  await screen.findByRole("heading", { level: 1, name: "Solicitações de tipo de conta" });
  return { ...view, user: userEvent.setup() };
}

beforeEach(() => {
  for (const m of [mocks.adminGet, mocks.adminList, mocks.adminPost, mocks.toastSuccess]) m.mockReset();
  mocks.auth.user = ADMIN;
});

describe("Solicitações de tipo de conta (Admin)", () => {
  it("lista as pendentes com workspace, responsável, mudança, justificativa e status", async () => {
    serve([req()]);
    await renderPage();
    const row = (await screen.findByText("Casa Aurora")).closest('[role="row"]') as HTMLElement;
    expect(within(row).getByText(/Lúcia Prado/)).toBeInTheDocument();
    expect(within(row).getByText("Marca → Agência")).toBeInTheDocument();
    expect(within(row).getByText(/Passamos a atender várias marcas/)).toBeInTheDocument();
    expect(within(row).getByText("Pendente")).toBeInTheDocument();
    expect(mocks.adminList).toHaveBeenCalledWith("/admin/workspace-account-type-requests", expect.objectContaining({ status: "pending" }), expect.anything());
  });

  it("o administrador aprova com confirmação e a chamada leva a Idempotency-Key", async () => {
    serve([req()]);
    const { user } = await renderPage();
    await user.click(await screen.findByRole("button", { name: "Aprovar" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(/não são alterados/)).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Aprovar solicitação" }));
    await waitFor(() => expect(mocks.adminPost).toHaveBeenCalledTimes(1));
    const [path, body, options] = mocks.adminPost.mock.calls[0];
    expect(path).toBe("/admin/workspace-account-type-requests/r1/approve");
    expect(body).toEqual({});
    expect(options.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("rejeitar exige o motivo e o envia", async () => {
    serve([req()]);
    const { user } = await renderPage();
    await user.click(await screen.findByRole("button", { name: "Rejeitar" }));
    const dialog = within(screen.getByRole("alertdialog"));
    const confirm = dialog.getByRole("button", { name: "Rejeitar solicitação" });
    expect(confirm).toBeDisabled();
    await user.type(dialog.getByRole("textbox"), "Falta o contrato social");
    await user.click(confirm);
    await waitFor(() => expect(mocks.adminPost).toHaveBeenCalledTimes(1));
    expect(mocks.adminPost.mock.calls[0][0]).toBe("/admin/workspace-account-type-requests/r1/reject");
    expect(mocks.adminPost.mock.calls[0][1]).toEqual({ reason: "Falta o contrato social" });
  });

  it("suporte e somente leitura veem os pedidos, sem aprovar nem rejeitar", async () => {
    mocks.auth.user = { id: 7, name: "Caio", platform_role: "support" };
    serve([req()]);
    await renderPage();
    await screen.findByText("Casa Aurora");
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rejeitar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Detalhes" })).toBeInTheDocument();
  });

  it("detalhes: justificativa inteira e histórico do workspace", async () => {
    serve([req()]);
    const { user } = await renderPage();
    await user.click(await screen.findByRole("button", { name: "Detalhes" }));
    const drawer = within(await screen.findByRole("dialog"));
    expect(await drawer.findByText("Outras solicitações deste workspace")).toBeInTheDocument();
    expect(drawer.getByText("Faltou o contrato")).toBeInTheDocument();
    expect(drawer.getByText("Justificativa")).toBeInTheDocument();
  });

  it("histórico mostra decididas; estados vazios", async () => {
    serve([]);
    const { user } = await renderPage();
    expect(await screen.findByText("Nenhuma solicitação pendente")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Histórico/ }));
    expect(await screen.findByText("Nenhuma decisão registrada ainda")).toBeInTheDocument();
  });
});

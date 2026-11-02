/**
 * Excluir conta e permissões por papel no detalhe do usuário.
 *
 * O QUE PRECISA FUNCIONAR:
 *   - o administrador vê "Excluir conta"; o diálogo explica que é permanente e pede o motivo E o e-mail da conta;
 *   - o botão só habilita com os dois; o envio leva `reason` e `confirm_email` e uma Idempotency-Key;
 *   - impedimentos do servidor (saldo, saque pendente, único proprietário) aparecem listados, com o diálogo aberto;
 *   - o suporte vê Suspender mas NÃO Excluir; o somente leitura não vê nenhuma ação e lê o porquê.
 *
 * O QUE NÃO PODE ACONTECER:
 *   - confirmar a exclusão sem digitar o e-mail certo;
 *   - oferecer "Excluir conta" para a própria conta, outro administrador ou conta já excluída;
 *   - piscar botões que o servidor vai recusar enquanto o papel ainda está carregando.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminList: vi.fn(),
  adminGet: vi.fn(),
  adminPost: vi.fn(),
  toastSuccess: vi.fn(),
  auth: { user: null as Record<string, unknown> | null },
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminList: mocks.adminList, adminGet: mocks.adminGet, adminPost: mocks.adminPost };
});
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: mocks.auth.user, setUser: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));

import { toAdminApiError } from "@/lib/admin/admin-client";
import type { AdminUserDetail } from "@/shared/admin-platform.types";

import { AdminUserDetailScreen, validateAdminUserSearch } from "./admin-user-detail";
import { NOW_ISO, listResult, makeUserDetail } from "./admin-users-test-data";
import { renderRoutes, stubRoute, type TestRoute } from "./admin-users-test-utils";

function DetailPage() {
  const { userId } = useParams({ strict: false }) as { userId: string };
  return <AdminUserDetailScreen userId={userId} />;
}

const ROUTES: TestRoute[] = [
  { path: "/admin/users/$userId", component: DetailPage, validateSearch: validateAdminUserSearch },
  stubRoute("/admin/users"),
  stubRoute("/admin/workspaces/$workspaceId"),
];

const server = { detail: makeUserDetail() as AdminUserDetail, me: null as null | Record<string, unknown> };

function serve() {
  mocks.adminGet.mockImplementation(async (path: string) => {
    if (path === `/admin/users/${server.detail.id}`) return server.detail;
    if (path === "/admin/me" && server.me) return server.me;
    throw toAdminApiError(404, { message: "Não encontrado." });
  });
  mocks.adminList.mockImplementation(async () => listResult([], 0, { page: 1, per_page: 10 }));
}

const ADMIN_USER = { id: 1, name: "Marina", is_platform_admin: true, platform_role: "admin" };
const SUPPORT_USER = { id: 2, name: "Caio", platform_role: "support" };
const VIEWER_USER = { id: 3, name: "Leo", platform_role: "viewer" };

async function renderDetail() {
  const view = renderRoutes(ROUTES, `/admin/users/${server.detail.id}`);
  await screen.findByRole("heading", { level: 1, name: server.detail.name });
  return { ...view, user: userEvent.setup() };
}

const deleteButton = () => screen.queryByRole("button", { name: /Excluir conta/ });

beforeEach(() => {
  for (const mock of [mocks.adminList, mocks.adminGet, mocks.adminPost, mocks.toastSuccess]) mock.mockReset();
  vi.useRealTimers();
  mocks.auth.user = ADMIN_USER;
  server.detail = makeUserDetail();
  server.me = null;
  serve();
  void NOW_ISO;
});

describe("excluir conta (administrador)", () => {
  async function openDelete() {
    const ctx = await renderDetail();
    await ctx.user.click(screen.getByRole("button", { name: /Excluir conta/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Excluir a conta de Bernardo Medeiros Moraes" });
    return { ...ctx, dialog };
  }
  const confirm = () => screen.getByRole("button", { name: "Excluir conta para sempre" });

  it("o diálogo diz que é permanente, o que some e o que fica, e pede motivo e e-mail", async () => {
    const { dialog } = await openDelete();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(/permanente e não pode ser desfeita/);
    expect(dialog).toHaveTextContent("Nome, e-mail, telefone, documento, foto e endereços são apagados");
    expect(dialog).toHaveTextContent("Campanhas e registros financeiros continuam no histórico");
    expect(dialog).toHaveTextContent("use Suspender");
    expect(within(dialog).getByLabelText(/Motivo/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/digite o e-mail da conta/i)).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
  });

  it("só habilita com motivo E o e-mail certo (maiúsculas e espaços nas pontas não contam)", async () => {
    const { user, dialog } = await openDelete();
    const reason = within(dialog).getByLabelText(/Motivo/);
    const email = within(dialog).getByLabelText(/digite o e-mail da conta/i);

    await user.type(reason, "Pedido do titular (LGPD)");
    expect(confirm()).toBeDisabled();
    await user.type(email, "outra@conta.com");
    expect(confirm()).toBeDisabled();
    await user.clear(email);
    await user.type(email, "  BERNARDO@cafeserraverde.com.br ");
    expect(confirm()).toBeEnabled();
    expect(mocks.adminPost).not.toHaveBeenCalled();
  });

  it("confirma: envia motivo e confirm_email para /delete, com Idempotency-Key, avisa e fecha", async () => {
    mocks.adminPost.mockImplementation(async () => {
      server.detail = makeUserDetail({ status: "deleted", deleted_at: NOW_ISO, sessions: { active_count: 0, last_used_at: null, clients: [] } });
      return server.detail;
    });
    const { user, dialog } = await openDelete();
    await user.type(within(dialog).getByLabelText(/Motivo/), "Pedido do titular (LGPD)");
    await user.type(within(dialog).getByLabelText(/digite o e-mail da conta/i), "bernardo@cafeserraverde.com.br");
    await user.click(confirm());

    expect(mocks.adminPost).toHaveBeenCalledTimes(1);
    const [path, body, options] = mocks.adminPost.mock.calls[0];
    expect(path).toBe("/admin/users/9/delete");
    expect(body).toEqual({ reason: "Pedido do titular (LGPD)", confirm_email: "bernardo@cafeserraverde.com.br" });
    expect(options.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Conta excluída.");
    await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("USER_DELETE_BLOCKED: lista os impedimentos com valores e deixa o diálogo aberto", async () => {
    mocks.adminPost.mockRejectedValue(
      toAdminApiError(409, {
        message: "Não é possível excluir esta conta agora.",
        error: "USER_DELETE_BLOCKED",
        details: {
          blockers: [
            { code: "HAS_OPEN_BALANCE", message: "O criador tem R$ 150,50 em saldo em aberto.", count: 2, amount_cents: 15050 },
            { code: "IS_SOLE_WORKSPACE_OWNER", message: "A conta é a única proprietária de 1 workspace.", count: 1 },
          ],
        },
      }),
    );
    const { user, dialog } = await openDelete();
    await user.type(within(dialog).getByLabelText(/Motivo/), "Pedido do titular (LGPD)");
    await user.type(within(dialog).getByLabelText(/digite o e-mail da conta/i), "bernardo@cafeserraverde.com.br");
    await user.click(confirm());

    const blockers = await within(dialog).findByRole("group", { name: "Impedimentos da exclusão" });
    expect(blockers).toHaveTextContent("Saldo do criador em aberto");
    expect(blockers).toHaveTextContent("R$ 150,50");
    expect(blockers).toHaveTextContent("Único proprietário de workspace");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("A exclusão está bloqueada");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("422 CONFIRMATION_MISMATCH do servidor: explica o e-mail", async () => {
    mocks.adminPost.mockRejectedValue(
      toAdminApiError(422, { message: "x", error: "CONFIRMATION_MISMATCH" }),
    );
    const { user, dialog } = await openDelete();
    await user.type(within(dialog).getByLabelText(/Motivo/), "Pedido do titular (LGPD)");
    await user.type(within(dialog).getByLabelText(/digite o e-mail da conta/i), "bernardo@cafeserraverde.com.br");
    await user.click(confirm());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("O e-mail digitado não confere");
  });
});

describe("quem pode ver o botão de excluir", () => {
  it("não aparece para a própria conta, para outro administrador nem para conta excluída", async () => {
    server.detail = makeUserDetail({ id: 1, name: "Marina", email: "marina@x.com" });
    const own = await renderDetail();
    expect(deleteButton()).not.toBeInTheDocument();
    own.unmount();

    server.detail = makeUserDetail({ kind: "admin", is_platform_admin: true });
    const other = await renderDetail();
    expect(deleteButton()).not.toBeInTheDocument();
    expect(screen.getByText(/administradora da plataforma/)).toBeInTheDocument();
    other.unmount();

    server.detail = makeUserDetail({ status: "deleted", deleted_at: NOW_ISO });
    await renderDetail();
    expect(deleteButton()).not.toBeInTheDocument();
    expect(screen.getByText("Conta excluída: não há ações disponíveis.")).toBeInTheDocument();
  });
});

describe("papéis da equipe no detalhe do usuário", () => {
  it("suporte: vê Suspender e Encerrar sessões, e NÃO vê Excluir conta", async () => {
    mocks.auth.user = SUPPORT_USER;
    server.me = { user_id: 2, role: "support", permissions: ["read", "users.moderate", "workspaces.moderate"] };
    await renderDetail();
    expect(await screen.findByRole("button", { name: "Suspender" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Encerrar sessões" })).toBeInTheDocument();
    expect(deleteButton()).not.toBeInTheDocument();
    expect(mocks.adminGet).toHaveBeenCalledWith("/admin/me", undefined, expect.anything());
  });

  it("somente leitura: nenhuma ação, só a explicação de que o papel só permite ver", async () => {
    mocks.auth.user = VIEWER_USER;
    server.me = { user_id: 3, role: "viewer", permissions: ["read"] };
    await renderDetail();
    expect(await screen.findByText(/só permite ver esta conta/)).toBeInTheDocument();
    for (const name of ["Suspender", "Reativar", "Encerrar sessões"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(deleteButton()).not.toBeInTheDocument();
  });

  it("enquanto o papel carrega, nenhum botão de ação aparece (sem piscar)", async () => {
    mocks.auth.user = SUPPORT_USER;
    let release: (value: unknown) => void = () => {};
    mocks.adminGet.mockImplementation(async (path: string) => {
      if (path === "/admin/me") return new Promise((resolve) => (release = resolve));
      if (path === `/admin/users/${server.detail.id}`) return server.detail;
      throw toAdminApiError(404, { message: "x" });
    });
    await renderDetail();
    expect(screen.queryByRole("button", { name: "Suspender" })).not.toBeInTheDocument();
    expect(screen.queryByText(/só permite ver esta conta/)).not.toBeInTheDocument();
    release({ user_id: 2, role: "support", permissions: ["read", "users.moderate"] });
    expect(await screen.findByRole("button", { name: "Suspender" })).toBeInTheDocument();
  });
});

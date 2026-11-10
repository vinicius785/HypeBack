/**
 * Gerar código de recuperação de senha de um colega da equipe (Admin → Equipe).
 *
 * O QUE PRECISA FUNCIONAR: confirmar antes de gerar; o código aparece em destaque UMA vez, com "Copiar", contagem
 * regressiva de 15 min e o aviso fixo; um só envio mesmo com duplo clique; cada erro tem texto em português.
 * O QUE NÃO PODE ACONTECER: o código sobreviver ao fechar o diálogo, ir para storage ou ficar no cache; erro técnico na tela.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminList: vi.fn(),
  adminPatch: vi.fn(),
  adminPost: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: mocks.adminGet, adminList: mocks.adminList, adminPatch: mocks.adminPatch, adminPost: mocks.adminPost };
});
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: 1, name: "Marina Alves", is_platform_admin: true, platform_role: "admin" }, setUser: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { toAdminApiError } from "@/lib/admin/admin-client";
import type { AdminPlatformTeam } from "@/shared/admin-platform.types";

import { renderRoutes, stubRoute } from "../users/admin-users-test-utils";
import { AdminTeamPage } from "./admin-team-page";
import { describeStaffRecoveryError } from "./staff-recovery-errors";
import { formatRemaining } from "./staff-recovery-dialogs";

const TEAM: AdminPlatformTeam = {
  roles: [{ role: "admin", label: "Administrador", description: "x", permissions: ["read"] }, { role: "support", label: "Suporte", description: "x", permissions: ["read"] }, { role: "viewer", label: "Somente leitura", description: "x", permissions: ["read"] }],
  members: [
    { user_id: 1, name: "Marina Alves", email: "marina@hype.com", role: "admin", status: "active" },
    { user_id: 7, name: "Caio Teodoro", email: "caio@hype.com", role: "support", status: "active" },
  ],
};
const ISSUED = { code: "AB3D-9XK2-M7QP", expires_in_minutes: 15, user: { id: 7, name: "Caio Teodoro", email: "caio@hype.com" } };

const ROUTES = [{ path: "/admin/team", component: AdminTeamPage }, stubRoute("/admin/users/$userId")];
const rowOf = (name: string) => screen.getByText(name).closest('[role="row"]') as HTMLElement;

async function openConfirm() {
  renderRoutes(ROUTES, "/admin/team");
  await screen.findByText("Caio Teodoro");
  const user = userEvent.setup();
  await user.click(within(rowOf("Caio Teodoro")).getByRole("button", { name: "Gerar código de recuperação" }));
  const dialog = await screen.findByRole("dialog", { name: "Gerar código de recuperação" });
  return { user, dialog };
}
const generate = () => screen.getByRole("button", { name: "Gerar código" });

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  mocks.adminGet.mockImplementation(async (path: string) => {
    if (path === "/admin/platform-team") return TEAM;
    throw toAdminApiError(404, { message: "x" });
  });
  mocks.adminList.mockResolvedValue({ data: [], meta: { page: 1, per_page: 6, total: 0, total_pages: 0 } });
});

describe("Gerar código de recuperação: confirmação e exibição única", () => {
  it("pede confirmação antes de gerar, citando a pessoa e que o código anterior deixa de valer", async () => {
    const { dialog } = await openConfirm();
    expect(dialog).toHaveTextContent("Gerar um código de recuperação para Caio Teodoro? O código anterior deixa de valer.");
    expect(mocks.adminPost).not.toHaveBeenCalled();
    // não pede motivo: o endpoint não recebe corpo
    expect(within(dialog).queryByLabelText(/Motivo/)).not.toBeInTheDocument();
  });

  it("gera pelo endpoint certo, sem corpo, e mostra o código em destaque com Copiar, contagem e o aviso fixo", async () => {
    mocks.adminPost.mockResolvedValue(ISSUED);
    const { user } = await openConfirm();
    await user.click(generate());

    const code = await screen.findByLabelText("Código gerado");
    expect(code).toHaveTextContent("AB3D-9XK2-M7QP");
    expect(mocks.adminPost).toHaveBeenCalledTimes(1);
    const [path, body] = mocks.adminPost.mock.calls[0];
    expect(path).toBe("/admin/users/7/staff-recovery-code");
    expect(body).toBeUndefined();
    const dialog = screen.getByRole("dialog", { name: "Código de recuperação" });
    expect(within(dialog).getByText(/Vence em 1[45]:\d\d/)).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Entregue este código por fora do sistema (WhatsApp ou pessoalmente), só para Caio Teodoro. Vale 15 minutos e só pode ser usado uma vez.");
    expect(within(dialog).getByRole("button", { name: /Copiar/ })).toBeEnabled();
  });

  it("Copiar põe o código na área de transferência", async () => {
    mocks.adminPost.mockResolvedValue(ISSUED);
    const { user } = await openConfirm();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await user.click(generate());
    await user.click(await screen.findByRole("button", { name: /Copiar/ }));
    expect(writeText).toHaveBeenCalledWith("AB3D-9XK2-M7QP");
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());
  });

  it("ao fechar, o código some e não pode ser visto de novo: reabrir pede outra geração", async () => {
    mocks.adminPost.mockResolvedValueOnce(ISSUED).mockResolvedValueOnce({ ...ISSUED, code: "ZZZZ-1111-AAAA" });
    const { user } = await openConfirm();
    await user.click(generate());
    await screen.findByLabelText("Código gerado");
    await user.click(screen.getAllByRole("button", { name: "Fechar" }).at(-1) as HTMLElement);

    expect(screen.queryByLabelText("Código gerado")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("AB3D-9XK2-M7QP");

    await user.click(within(rowOf("Caio Teodoro")).getByRole("button", { name: "Gerar código de recuperação" }));
    expect(screen.queryByLabelText("Código gerado")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("AB3D-9XK2-M7QP");
    await user.click(generate());
    expect(await screen.findByLabelText("Código gerado")).toHaveTextContent("ZZZZ-1111-AAAA");
    expect(mocks.adminPost).toHaveBeenCalledTimes(2);
  });

  it("o código não vai para storage nem para a URL", async () => {
    mocks.adminPost.mockResolvedValue(ISSUED);
    const { user } = await openConfirm();
    await user.click(generate());
    await screen.findByLabelText("Código gerado");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(window.location.href).not.toContain("AB3D");
    expect(window.location.search).toBe("");
  });

  it("durante a chamada o botão fica desabilitado e o duplo clique faz um único envio", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mocks.adminPost.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { user } = await openConfirm();
    await user.dblClick(generate());
    expect(await screen.findByRole("button", { name: "Gerando…" })).toBeDisabled();
    expect(mocks.adminPost).toHaveBeenCalledTimes(1);
    await act(async () => resolve(ISSUED));
    expect(await screen.findByLabelText("Código gerado")).toBeInTheDocument();
    expect(mocks.adminPost).toHaveBeenCalledTimes(1);
  });

  it("a contagem regressiva vence o código: some o código, o Copiar desabilita e pede para gerar outro", async () => {
    mocks.adminPost.mockResolvedValue({ ...ISSUED, expires_in_minutes: 0.02 });
    const { user } = await openConfirm();
    await user.click(generate());
    expect(await screen.findByLabelText("Código gerado", {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Código gerado")).toHaveTextContent("Código vencido"), { timeout: 4000 });
    expect(screen.getByRole("button", { name: /Copiar/ })).toBeDisabled();
    expect(screen.getByText("Vencido: gere outro código.")).toBeInTheDocument();
  });
});

describe("Gerar código de recuperação: erros em português", () => {
  async function fail(status: number, body: Record<string, unknown>) {
    mocks.adminPost.mockRejectedValue(toAdminApiError(status, body));
    const { user, dialog } = await openConfirm();
    await user.click(generate());
    return dialog;
  }

  it.each([
    [403, { message: "Forbidden resource" }, "Só administradores da plataforma podem gerar códigos de recuperação."],
    [409, { message: "x", error: "CANNOT_ACT_ON_SELF" }, "Você não pode gerar um código para a sua própria conta. Peça a outro admin."],
    [400, { message: "x", error: "NOT_STAFF_ACCOUNT" }, "Este usuário não é da equipe da plataforma."],
    [429, { message: "ThrottlerException" }, "Muitos códigos gerados. Tente novamente mais tarde."],
    [503, { message: "x" }, "Recuperação indisponível no momento. Tente novamente."],
  ])("%s mostra a mensagem clara dentro do diálogo, que continua aberto", async (status, body, text) => {
    const dialog = await fail(status, body);
    expect(await within(dialog).findByText(text)).toBeInTheDocument();
    expect(screen.queryByLabelText("Código gerado")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gerar código" })).toBeEnabled();
  });

  it("describeStaffRecoveryError cobre 401 e o erro desconhecido sem vazar detalhe técnico", () => {
    expect(describeStaffRecoveryError(toAdminApiError(401, { message: "Unauthorized" }))).toBe("Sua sessão expirou. Entre novamente para continuar.");
    expect(describeStaffRecoveryError(new Error("stack interno"))).toBe("Não foi possível gerar o código. Tente novamente.");
    expect(describeStaffRecoveryError(toAdminApiError(500, { message: "SELECT * FROM users" }))).toBe("Não foi possível gerar o código. Tente novamente.");
  });

  it("formatRemaining mostra mm:ss e nunca negativo", () => {
    expect(formatRemaining(15 * 60_000)).toBe("15:00");
    expect(formatRemaining(61_000)).toBe("01:01");
    expect(formatRemaining(-5000)).toBe("00:00");
  });
});

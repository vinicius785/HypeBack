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

/** Abre o menu "Ações" da linha da pessoa e escolhe "Gerar código de recuperação". */
async function openRecoveryFromMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(rowOf("Caio Teodoro")).getByRole("button", { name: "Ações de Caio Teodoro" }));
  await user.click(await screen.findByRole("menuitem", { name: "Gerar código de recuperação" }));
}

async function openConfirm() {
  renderRoutes(ROUTES, "/admin/team");
  await screen.findByText("Caio Teodoro");
  const user = userEvent.setup();
  await openRecoveryFromMenu(user);
  const dialog = await screen.findByRole("dialog", { name: "Gerar código de recuperação" });
  return { user, dialog };
}
const generate = () => screen.getByRole("button", { name: "Gerar código" });
const approvalField = () => screen.getByLabelText("Código do Google Authenticator") as HTMLInputElement;
/** Digita os 6 dígitos do Authenticator (se o campo estiver vazio) e confirma. */
async function submit(user: ReturnType<typeof userEvent.setup>, digits = "123456") {
  if (approvalField().value === "") await user.type(approvalField(), digits);
  await user.click(generate());
}

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
    await submit(user);

    const code = await screen.findByLabelText("Código gerado");
    expect(code).toHaveTextContent("AB3D-9XK2-M7QP");
    expect(mocks.adminPost).toHaveBeenCalledTimes(1);
    const [path, body] = mocks.adminPost.mock.calls[0];
    expect(path).toBe("/admin/users/7/staff-recovery-code");
    // o segundo fator vai no corpo, como texto de 6 dígitos
    expect(body).toEqual({ approval_code: "123456" });
    const dialog = screen.getByRole("dialog", { name: "Código de recuperação" });
    expect(within(dialog).getByText(/Vence em 1[45]:\d\d/)).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Entregue este código por fora do sistema (WhatsApp ou pessoalmente), só para Caio Teodoro. Vale 15 minutos e só pode ser usado uma vez.");
    expect(within(dialog).getByRole("button", { name: /Copiar/ })).toBeEnabled();
  });

  it("Copiar põe o código na área de transferência", async () => {
    mocks.adminPost.mockResolvedValue(ISSUED);
    const { user } = await openConfirm();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await submit(user);
    await user.click(await screen.findByRole("button", { name: /Copiar/ }));
    expect(writeText).toHaveBeenCalledWith("AB3D-9XK2-M7QP");
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());
  });

  it("ao fechar, o código some e não pode ser visto de novo: reabrir pede outra geração", async () => {
    mocks.adminPost.mockResolvedValueOnce(ISSUED).mockResolvedValueOnce({ ...ISSUED, code: "ZZZZ-1111-AAAA" });
    const { user } = await openConfirm();
    await submit(user);
    await screen.findByLabelText("Código gerado");
    await user.click(screen.getAllByRole("button", { name: "Fechar" }).at(-1) as HTMLElement);

    expect(screen.queryByLabelText("Código gerado")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("AB3D-9XK2-M7QP");

    await openRecoveryFromMenu(user);
    expect(screen.queryByLabelText("Código gerado")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("AB3D-9XK2-M7QP");
    await submit(user);
    expect(await screen.findByLabelText("Código gerado")).toHaveTextContent("ZZZZ-1111-AAAA");
    expect(mocks.adminPost).toHaveBeenCalledTimes(2);
  });

  it("o código não vai para storage nem para a URL", async () => {
    mocks.adminPost.mockResolvedValue(ISSUED);
    const { user } = await openConfirm();
    await submit(user);
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
    await user.type(approvalField(), "123456");
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
    await submit(user);
    expect(await screen.findByLabelText("Código gerado", {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Código gerado")).toHaveTextContent("Código vencido"), { timeout: 4000 });
    expect(screen.getByRole("button", { name: /Copiar/ })).toBeDisabled();
    expect(screen.getByText("Vencido: gere outro código.")).toBeInTheDocument();
  });
});

describe("Gerar código de recuperação: código do Google Authenticator", () => {
  it("o campo tem rótulo, texto de apoio e atributos de código de uso único", async () => {
    const { dialog } = await openConfirm();
    const field = approvalField();
    expect(field).toHaveAttribute("inputmode", "numeric");
    expect(field).toHaveAttribute("maxlength", "6");
    expect(field).toHaveAttribute("autocomplete", "one-time-code");
    expect(within(dialog).getByText("Abra o app Google Authenticator e digite o código de 6 dígitos de “HypeApp recuperação”.")).toBeInTheDocument();
    expect(field).toHaveAccessibleDescription(/HypeApp recuperação/);
  });

  it("'Gerar código' só habilita com 6 dígitos; letras e espaços são descartados", async () => {
    const { user } = await openConfirm();
    expect(generate()).toBeDisabled();
    await user.type(approvalField(), "12 ab 345");
    expect(approvalField()).toHaveValue("12345");
    expect(generate()).toBeDisabled();
    await user.type(approvalField(), "6789");
    expect(approvalField()).toHaveValue("123456");
    expect(generate()).toBeEnabled();
    await user.clear(approvalField());
    expect(generate()).toBeDisabled();
  });

  it("sem os 6 dígitos nada é enviado, nem com Enter", async () => {
    const { user } = await openConfirm();
    await user.type(approvalField(), "123{Enter}");
    expect(mocks.adminPost).not.toHaveBeenCalled();
  });

  it("envia o approval_code como texto de 6 dígitos (com zeros à esquerda preservados)", async () => {
    mocks.adminPost.mockResolvedValue(ISSUED);
    const { user } = await openConfirm();
    await user.type(approvalField(), "004217");
    await user.click(generate());
    await screen.findByLabelText("Código gerado");
    expect(mocks.adminPost.mock.calls[0][1]).toEqual({ approval_code: "004217" });
    expect(typeof mocks.adminPost.mock.calls[0][1].approval_code).toBe("string");
  });

  it("o código do Authenticator não vai para storage nem para a URL, e o campo some ao fechar", async () => {
    const { user } = await openConfirm();
    await user.type(approvalField(), "987654");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(window.location.href).not.toContain("987654");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Código do Google Authenticator")).not.toBeInTheDocument();

    // reabrir começa com o campo vazio
    await openRecoveryFromMenu(user);
    await screen.findByRole("dialog", { name: "Gerar código de recuperação" });
    expect(approvalField()).toHaveValue("");
  });

  it("depois de gerar, o campo fica vazio: o próximo código vale uma vez só", async () => {
    mocks.adminPost.mockResolvedValue(ISSUED);
    const { user } = await openConfirm();
    await user.type(approvalField(), "123456");
    await user.click(generate());
    await screen.findByLabelText("Código gerado");
    await user.click(screen.getAllByRole("button", { name: "Fechar" }).at(-1) as HTMLElement);
    await openRecoveryFromMenu(user);
    await screen.findByRole("dialog", { name: "Gerar código de recuperação" });
    expect(approvalField()).toHaveValue("");
    expect(generate()).toBeDisabled();
  });

  it.each([
    [400, { message: "x", error: "APPROVAL_CODE_REQUIRED" }, "Informe o código do Google Authenticator."],
    [403, { message: "x", error: "APPROVAL_CODE_INVALID" }, "Código do Authenticator inválido ou já usado. Aguarde o próximo código (30 s) e tente de novo."],
    [429, { message: "x", error: "APPROVAL_CODE_LOCKED" }, "Muitas tentativas com o código do Authenticator. Tente novamente em alguns minutos."],
  ])("%s %s mostra a mensagem certa, limpa o campo e mantém o diálogo aberto", async (status, body, text) => {
    mocks.adminPost.mockRejectedValue(toAdminApiError(status, body));
    const { user, dialog } = await openConfirm();
    await user.type(approvalField(), "123456");
    await user.click(generate());
    expect(await within(dialog).findByText(text)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Gerar código de recuperação" })).toBeInTheDocument();
    expect(approvalField()).toHaveValue("");
    expect(generate()).toBeDisabled();
    expect(screen.queryByLabelText("Código gerado")).not.toBeInTheDocument();
  });

  it("os erros antigos continuam iguais (409 CANNOT_ACT_ON_SELF)", async () => {
    mocks.adminPost.mockRejectedValue(toAdminApiError(409, { message: "x", error: "CANNOT_ACT_ON_SELF" }));
    const { user, dialog } = await openConfirm();
    await user.type(approvalField(), "123456");
    await user.click(generate());
    expect(await within(dialog).findByText("Você não pode gerar um código para a sua própria conta. Peça a outro admin.")).toBeInTheDocument();
  });
});

describe("Gerar código de recuperação: erros em português", () => {
  async function fail(status: number, body: Record<string, unknown>) {
    mocks.adminPost.mockRejectedValue(toAdminApiError(status, body));
    const { user, dialog } = await openConfirm();
    await submit(user);
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
    // o código do Authenticator foi gasto: o campo volta vazio e o botão espera o próximo código
    expect(approvalField()).toHaveValue("");
    expect(within(dialog).getByRole("button", { name: "Gerar código" })).toBeDisabled();
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

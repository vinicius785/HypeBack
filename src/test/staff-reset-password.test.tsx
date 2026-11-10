/**
 * Redefinir com código (equipe da plataforma): tela pública. Fica em `src/test`: tudo dentro de `src/screens` é lido
 * pelo gerador de rotas.
 *
 * O QUE PRECISA FUNCIONAR: e-mail, código (cola com ou sem hífens e em qualquer caixa) e nova senha com 12+ caracteres
 * e confirmação; sucesso leva ao login; cada erro do servidor tem texto em português.
 * O QUE NÃO PODE ACONTECER: código vindo da URL; segredo em storage; diferenciar a causa do "código inválido".
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  navigate: vi.fn(),
  staffResetPassword: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => ctx.navigate,
}));
vi.mock("sonner", () => ({ toast: ctx.toast }));
vi.mock("@/shared/services/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/auth")>();
  return { ...actual, staffResetPassword: ctx.staffResetPassword };
});

import { Route } from "@/screens/(public)/staff-reset-password";
import { StaffResetError } from "@/shared/services/auth";

const Page = (Route as unknown as { options: { component: () => ReactNode } }).options.component;
const wrap = () => render(createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) }, createElement(Page)));

const STRONG = "uma-senha-bem-forte-123";

async function fill({ email = "lucas@vocenohype.com", code = "ab3d-9xk2-m7qp", password = STRONG, confirm = STRONG } = {}) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Digite seu e-mail"), email);
  if (code) await user.type(screen.getByPlaceholderText("XXXX-XXXX-XXXX"), code);
  if (password) await user.type(screen.getByPlaceholderText("Mínimo 12 caracteres"), password);
  if (confirm) await user.type(screen.getByPlaceholderText("Digite a senha novamente"), confirm);
  return user;
}
const submit = () => userEvent.click(screen.getByRole("button", { name: "Redefinir senha" }));

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("Redefinir com código", () => {
  it("explica que a equipe precisa pedir o código a um admin", () => {
    wrap();
    expect(screen.getByText(/peça a um admin para gerar um código para você/)).toBeInTheDocument();
  });

  it("normaliza o código para XXXX-XXXX-XXXX ao digitar e ao colar (com ou sem hífens, qualquer caixa)", async () => {
    wrap();
    const user = userEvent.setup();
    const field = screen.getByPlaceholderText("XXXX-XXXX-XXXX");
    await user.type(field, "ab3d9xk2m7qp");
    expect(field).toHaveValue("AB3D-9XK2-M7QP");
    await user.clear(field);
    await user.click(field);
    await user.paste("ab3d-9xk2-m7qp");
    expect(field).toHaveValue("AB3D-9XK2-M7QP");
  });

  it("não pré-preenche nada pela URL, e a senha usa autocomplete 'new-password'", () => {
    window.history.replaceState({}, "", "/staff-reset-password?code=AB3D-9XK2-M7QP&email=a@b.com");
    wrap();
    expect(screen.getByPlaceholderText("XXXX-XXXX-XXXX")).toHaveValue("");
    expect(screen.getByPlaceholderText("Digite seu e-mail")).toHaveValue("");
    expect(screen.getByPlaceholderText("Mínimo 12 caracteres")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByPlaceholderText("Digite a senha novamente")).toHaveAttribute("autocomplete", "new-password");
    window.history.replaceState({}, "", "/");
  });

  it("valida no cliente: senha com menos de 12 caracteres, confirmação diferente e código incompleto", async () => {
    wrap();
    await fill({ code: "ab3d", password: "curta123", confirm: "outra-coisa" });
    await submit();
    expect(await screen.findByText("A senha da equipe deve ter no mínimo 12 caracteres")).toBeInTheDocument();
    expect(screen.getByText("As senhas não coincidem")).toBeInTheDocument();
    expect(screen.getByText("O código tem 12 letras ou números (XXXX-XXXX-XXXX)")).toBeInTheDocument();
    expect(ctx.staffResetPassword).not.toHaveBeenCalled();
  });

  it("senha com 12 caracteres e confirmação igual passa", async () => {
    ctx.staffResetPassword.mockResolvedValue({ message: "Senha redefinida com sucesso. Entre com a nova senha." });
    wrap();
    await fill({ password: "123456789012", confirm: "123456789012" });
    await submit();
    await waitFor(() => expect(ctx.staffResetPassword).toHaveBeenCalledTimes(1));
  });

  it("envia e-mail, código normalizado e senha (sem a confirmação) e, no sucesso, leva ao login com a mensagem", async () => {
    ctx.staffResetPassword.mockResolvedValue({ message: "Senha redefinida com sucesso. Entre com a nova senha." });
    wrap();
    await fill();
    await submit();
    await waitFor(() => expect(ctx.navigate).toHaveBeenCalledWith({ to: "/sign-in" }));
    expect(ctx.staffResetPassword.mock.calls[0][0]).toEqual({ email: "lucas@vocenohype.com", code: "AB3D-9XK2-M7QP", password: STRONG });
    expect(ctx.toast.success).toHaveBeenCalledWith("Senha redefinida com sucesso. Entre com a nova senha.");
  });

  it("nenhum segredo (código ou senha) vai para storage, e a senha não aparece na tela", async () => {
    ctx.staffResetPassword.mockResolvedValue({ message: "ok" });
    const { container } = wrap();
    await fill();
    await submit();
    await waitFor(() => expect(ctx.navigate).toHaveBeenCalled());
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(container.textContent).not.toContain(STRONG);
  });

  it("400 'Código inválido ou expirado': UMA mensagem genérica, sem dizer a causa", async () => {
    ctx.staffResetPassword.mockRejectedValue(new StaffResetError({ status: 400, code: null, messages: ["Código inválido ou expirado"] }));
    wrap();
    await fill();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Código inválido ou expirado. Peça um novo código a um admin.");
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it("400 de validação do servidor aparece junto do campo", async () => {
    ctx.staffResetPassword.mockRejectedValue(
      new StaffResetError({ status: 400, code: null, messages: ["E-mail deve ter um formato válido", "Senha da equipe deve ter no mínimo 12 caracteres"] }),
    );
    wrap();
    await fill();
    await submit();
    expect(await screen.findByText("E-mail deve ter um formato válido")).toBeInTheDocument();
    expect(screen.getByText("Senha da equipe deve ter no mínimo 12 caracteres")).toBeInTheDocument();
  });

  it("403 ANONYMIZER_BLOCKED e 429 têm o seu texto", async () => {
    ctx.staffResetPassword.mockRejectedValueOnce(new StaffResetError({ status: 403, code: "ANONYMIZER_BLOCKED", messages: ["Forbidden"] }));
    wrap();
    await fill();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível concluir por esta conexão. Desative VPN/proxy e tente novamente.");

    ctx.staffResetPassword.mockRejectedValueOnce(new StaffResetError({ status: 429, code: null, messages: ["Too Many Requests"] }));
    await submit();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Muitas tentativas. Aguarde e tente novamente."));
  });
});

/**
 * "Esqueci a senha" numa tela só: o campo de código aceita o código de 6 dígitos do e-mail OU o código de admin
 * (XXXX-XXXX-XXXX) e o formato decide o endpoint. A tela não pergunta nem revela o tipo da conta. Fica em `src/test`:
 * tudo dentro de `src/screens` é lido pelo gerador de rotas.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { email: "" },
  resetPassword: vi.fn(),
  staffResetPassword: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  redirect: (args: unknown) => ({ redirectTo: args }),
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => ctx.navigate,
  useSearch: () => ctx.search,
}));
vi.mock("sonner", () => ({ toast: ctx.toast }));
vi.mock("@/shared/services/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/auth")>();
  return { ...actual, resetPassword: ctx.resetPassword, staffResetPassword: ctx.staffResetPassword };
});

import { Route as ResetRoute } from "@/screens/(public)/reset-password";
import { Route as OldStaffRoute } from "@/screens/(public)/staff-reset-password";
import { Route as SignInRoute } from "@/screens/(public)/sign-in";
import { StaffResetError } from "@/shared/services/auth";

type Opts = { component: () => ReactNode; beforeLoad?: () => void };
const opts = (r: unknown) => (r as { options: Opts }).options;
const Page = opts(ResetRoute).component;
const wrap = (node: () => ReactNode = Page) =>
  render(createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) }, createElement(node)));

const codeField = () => screen.getByPlaceholderText("123456 ou XXXX-XXXX-XXXX");
const submit = () => userEvent.click(screen.getByRole("button", { name: "Redefinir senha" }));

async function fill({ code, password, confirm = password }: { code: string; password: string; confirm?: string }) {
  const user = userEvent.setup();
  await user.type(codeField(), code);
  await user.type(screen.getAllByPlaceholderText(/Mínimo \d+ caracteres/)[0], password);
  await user.type(screen.getByPlaceholderText("Digite a senha novamente"), confirm);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.search = { email: "lucas@vocenohype.com" };
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("Esqueci a senha: um só caminho para todos", () => {
  it("o campo aceita o código do e-mail ou o de admin, e a tela explica as duas origens sem perguntar o tipo da conta", () => {
    wrap();
    expect(screen.getByText(/código de 6 dígitos enviado para o seu e-mail/)).toBeInTheDocument();
    expect(screen.getByText(/Conta da equipe\? Use o código gerado por um admin/)).toBeInTheDocument();
    expect(screen.queryByText(/Redefinir com código/)).not.toBeInTheDocument();
    expect(codeField()).toBeInTheDocument();
  });

  it("código de 6 dígitos (e-mail): usa a redefinição comum, com senha de 8+ caracteres", async () => {
    ctx.resetPassword.mockResolvedValue({ message: "Senha redefinida com sucesso!" });
    wrap();
    await fill({ code: "123456", password: "12345678" });
    await submit();
    await waitFor(() => expect(ctx.resetPassword).toHaveBeenCalledTimes(1));
    expect(ctx.resetPassword.mock.calls[0][0]).toEqual({ code: "123456", password: "12345678" });
    expect(ctx.staffResetPassword).not.toHaveBeenCalled();
  });

  it("código de admin (12 caracteres, colado em minúsculas): usa o endpoint da equipe com e-mail, código normalizado e senha de 12+", async () => {
    ctx.staffResetPassword.mockResolvedValue({ message: "Senha redefinida com sucesso. Entre com a nova senha." });
    wrap();
    const user = userEvent.setup();
    await user.click(codeField());
    await user.paste("ab3d-9xk2-m7qp");
    expect(codeField()).toHaveValue("AB3D-9XK2-M7QP");
    await user.type(screen.getAllByPlaceholderText(/Mínimo \d+ caracteres/)[0], "uma-senha-bem-forte-123");
    await user.type(screen.getByPlaceholderText("Digite a senha novamente"), "uma-senha-bem-forte-123");
    await submit();
    await waitFor(() => expect(ctx.staffResetPassword).toHaveBeenCalledTimes(1));
    expect(ctx.staffResetPassword.mock.calls[0][0]).toEqual({ email: "lucas@vocenohype.com", code: "AB3D-9XK2-M7QP", password: "uma-senha-bem-forte-123" });
    expect(ctx.resetPassword).not.toHaveBeenCalled();
  });

  it("o placeholder da senha acompanha o tipo do código: 8 caracteres, e 12 com o código de admin", async () => {
    wrap();
    expect(screen.getByPlaceholderText("Mínimo 8 caracteres")).toBeInTheDocument();
    await userEvent.type(codeField(), "ab3d9xk2m7qp");
    expect(screen.getByPlaceholderText("Mínimo 12 caracteres")).toBeInTheDocument();
  });

  it("com código de admin a senha precisa de 12+ caracteres; com o do e-mail bastam 8", async () => {
    wrap();
    await fill({ code: "ab3d9xk2m7qp", password: "curta12345" });
    await submit();
    expect(await screen.findByText("Senha deve ter no mínimo 12 caracteres (conta da equipe)")).toBeInTheDocument();
    expect(ctx.staffResetPassword).not.toHaveBeenCalled();
  });

  it("código incompleto, senhas diferentes: erros no cliente e nenhum envio", async () => {
    wrap();
    await fill({ code: "AB3D", password: "12345678", confirm: "outra-senha" });
    await submit();
    expect(await screen.findByText("Informe o código de 6 dígitos do e-mail ou o código de admin (XXXX-XXXX-XXXX)")).toBeInTheDocument();
    expect(screen.getByText("As senhas não coincidem")).toBeInTheDocument();
    expect(ctx.resetPassword).not.toHaveBeenCalled();
    expect(ctx.staffResetPassword).not.toHaveBeenCalled();
  });

  it("sem e-mail na URL o campo de e-mail aparece (necessário para o código de admin) e é exigido", async () => {
    ctx.search = { email: "" };
    wrap();
    expect(screen.getByPlaceholderText("Digite seu e-mail")).toBeInTheDocument();
    await fill({ code: "ab3d9xk2m7qp", password: "uma-senha-bem-forte-123" });
    await submit();
    expect(await screen.findByText("Informe o e-mail da sua conta")).toBeInTheDocument();
    expect(ctx.staffResetPassword).not.toHaveBeenCalled();
  });

  it("não pré-preenche o código pela URL nem guarda segredo em storage", async () => {
    window.history.replaceState({}, "", "/reset-password?code=AB3D-9XK2-M7QP&email=lucas@vocenohype.com");
    ctx.resetPassword.mockResolvedValue({ message: "ok" });
    wrap();
    expect(codeField()).toHaveValue("");
    await fill({ code: "123456", password: "12345678" });
    await submit();
    await waitFor(() => expect(ctx.resetPassword).toHaveBeenCalled());
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    window.history.replaceState({}, "", "/");
  });

  it("no sucesso mostra a confirmação e leva ao login", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ctx.resetPassword.mockResolvedValue({ message: "Senha redefinida com sucesso!" });
    wrap();
    await fill({ code: "123456", password: "12345678" });
    await submit();
    expect(await screen.findByText("Senha redefinida com sucesso!")).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2100);
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/sign-in" });
    vi.useRealTimers();
  });
});

describe("Esqueci a senha: erros", () => {
  const staffFill = () => fill({ code: "ab3d9xk2m7qp", password: "uma-senha-bem-forte-123" });

  it("código de admin errado, vencido ou usado: UMA mensagem genérica, sem dizer a causa", async () => {
    ctx.staffResetPassword.mockRejectedValue(new StaffResetError({ status: 400, code: null, messages: ["Código inválido ou expirado"] }));
    wrap();
    await staffFill();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Código inválido ou expirado. Peça um novo código a um admin.");
  });

  it("403 de VPN/proxy e 429 têm o seu texto", async () => {
    ctx.staffResetPassword.mockRejectedValueOnce(new StaffResetError({ status: 403, code: "ANONYMIZER_BLOCKED", messages: ["Forbidden"] }));
    wrap();
    await staffFill();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Desative VPN/proxy");

    ctx.staffResetPassword.mockRejectedValueOnce(new StaffResetError({ status: 429, code: null, messages: ["Too Many Requests"] }));
    await submit();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Muitas tentativas. Aguarde e tente novamente."));
  });

  it("erro da redefinição comum (código do e-mail) continua aparecendo como aviso", async () => {
    ctx.resetPassword.mockRejectedValue(new Error("Código inválido ou expirado"));
    wrap();
    await fill({ code: "123456", password: "12345678" });
    await submit();
    await waitFor(() => expect(ctx.toast.error).toHaveBeenCalledWith("Código inválido ou expirado"));
  });
});

describe("não há mais duas opções", () => {
  it("o endereço antigo /staff-reset-password leva ao 'Esqueci a senha'", () => {
    try {
      opts(OldStaffRoute).beforeLoad?.();
      throw new Error("deveria redirecionar");
    } catch (e) {
      expect(e).toEqual({ redirectTo: { to: "/forgot-password", replace: true } });
    }
  });

  it("a tela de entrar só tem o 'Esqueci a senha' (sem o link separado para admin)", () => {
    const SignIn = opts(SignInRoute).component;
    wrap(SignIn);
    expect(screen.getByRole("link", { name: "Esqueci a senha" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByText(/Redefinir com código de um admin/)).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/staff-reset-password"]')).toBeNull();
  });
});

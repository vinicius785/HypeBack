/**
 * Entrar e criar conta: o servidor responde 403 ACCOUNT_SUSPENDED em qualquer caminho que emite token. O aviso
 * fica na tela (com o caminho para o suporte), não num toast que some. Fica em `src/test`: tudo dentro de
 * `src/screens` é lido pelo gerador de rotas.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  navigate: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  saveAuthToken: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: unknown }) => ({ options }),
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => ctx.navigate,
}));
vi.mock("sonner", () => ({ toast: ctx.toast }));
vi.mock("@/shared/services/auth", () => ({ signIn: ctx.signIn, signUp: ctx.signUp }));
vi.mock("@/lib/utils/api", () => ({ saveAuthToken: ctx.saveAuthToken }));

import { Route as SignInRoute } from "@/screens/(public)/sign-in";
import { Route as SignUpRoute } from "@/screens/(public)/sign-up";

const SignIn = (SignInRoute as unknown as { options: { component: () => ReactNode } }).options.component;
const SignUp = (SignUpRoute as unknown as { options: { component: () => ReactNode } }).options.component;

/** O corpo que o servidor manda; `signIn`/`signUp` lançam esse corpo cru (`throw errorData`). */
const SUSPENDED_BODY = {
  statusCode: 403,
  message: "Conta suspensa. Entre em contato com o suporte.",
  error: "ACCOUNT_SUSPENDED",
  timestamp: "2026-10-31T12:00:00.000Z",
  path: "/api/backoffice/auth/login",
  method: "POST",
};

const wrap = (Screen: () => ReactNode) =>
  render(createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) }, createElement(Screen)));

async function submitSignIn() {
  await userEvent.type(screen.getByPlaceholderText("Digite seu e-mail"), "marca@empresa.com");
  await userEvent.type(screen.getByPlaceholderText("Digite sua senha"), "segredo123");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

async function submitSignUp() {
  await userEvent.type(screen.getByPlaceholderText("Digite seu nome completo"), "Maria da Silva Souza");
  await userEvent.type(screen.getByPlaceholderText("Digite seu e-mail"), "maria@empresa.com");
  const [password, confirmation] = screen.getAllByPlaceholderText("********");
  await userEvent.type(password, "segredo123");
  await userEvent.type(confirmation, "segredo123");
  await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
}

beforeEach(() => {
  ctx.navigate.mockReset();
  ctx.signIn.mockReset();
  ctx.signUp.mockReset();
  ctx.saveAuthToken.mockReset();
  ctx.toast.error.mockReset();
  ctx.toast.success.mockReset();
});

describe("entrar", () => {
  it("conta suspensa: o aviso do servidor fica na tela, com o caminho para o suporte, e não vira toast", async () => {
    ctx.signIn.mockRejectedValue(SUSPENDED_BODY);
    wrap(SignIn);
    await submitSignIn();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Conta suspensa. Entre em contato com o suporte.");
    expect(screen.getByRole("link", { name: "Falar com o suporte" })).toHaveAttribute(
      "href",
      "mailto:suporte@hypeapp.com.br?subject=Conta%20suspensa",
    );
    expect(ctx.toast.error).not.toHaveBeenCalled();
    expect(ctx.saveAuthToken).not.toHaveBeenCalled();
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it("o texto vem do servidor; se ele mandar uma lista de mensagens, vira um texto só", async () => {
    ctx.signIn.mockRejectedValue({ ...SUSPENDED_BODY, message: ["Conta suspensa.", "Fale com o suporte."] });
    wrap(SignIn);
    await submitSignIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("Conta suspensa. Fale com o suporte.");
  });

  it("outro erro (senha errada) segue como toast e não deixa aviso de conta suspensa", async () => {
    ctx.signIn.mockRejectedValue({ statusCode: 401, message: "Credenciais inválidas.", error: "Unauthorized" });
    wrap(SignIn);
    await submitSignIn();
    await waitFor(() => expect(ctx.toast.error).toHaveBeenCalledWith("Credenciais inválidas."));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tentar de novo apaga o aviso antigo (e se a conta voltou, entra normalmente)", async () => {
    ctx.signIn.mockRejectedValueOnce(SUSPENDED_BODY);
    ctx.signIn.mockResolvedValueOnce({ token: "tok-novo" });
    wrap(SignIn);
    await submitSignIn();
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(ctx.saveAuthToken).toHaveBeenCalledWith("tok-novo"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/" });
  });
});

describe("criar conta", () => {
  it("conta suspensa: o mesmo aviso na tela, sem toast", async () => {
    ctx.signUp.mockRejectedValue({ ...SUSPENDED_BODY, path: "/api/backoffice/auth/register" });
    wrap(SignUp);
    await submitSignUp();

    expect(await screen.findByRole("alert")).toHaveTextContent("Conta suspensa. Entre em contato com o suporte.");
    expect(screen.getByRole("link", { name: "Falar com o suporte" })).toBeInTheDocument();
    expect(ctx.toast.error).not.toHaveBeenCalled();
    expect(ctx.saveAuthToken).not.toHaveBeenCalled();
  });

  it("outro erro (e-mail já cadastrado) segue como toast", async () => {
    ctx.signUp.mockRejectedValue({ statusCode: 409, message: "E-mail já cadastrado.", error: "EMAIL_ALREADY_REGISTERED" });
    wrap(SignUp);
    await submitSignUp();
    await waitFor(() => expect(ctx.toast.error).toHaveBeenCalledWith("E-mail já cadastrado."));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

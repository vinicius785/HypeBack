/**
 * "Primeiro acesso": o dono de uma conta criada pelo Admin abre o link do e-mail de convite, define a senha e já entra. Fica
 * em `src/test`: tudo dentro de `src/screens` é lido pelo gerador de rotas.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { email: "dona@marca.com.br", code: "123456" },
  firstAccess: vi.fn(),
  saveAuthToken: vi.fn(),
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
  useSearch: () => ctx.search,
}));
vi.mock("sonner", () => ({ toast: ctx.toast }));
vi.mock("@/lib/utils/api", () => ({ saveAuthToken: ctx.saveAuthToken, getApiUrl: (p: string) => p, getAuthToken: () => null }));
vi.mock("@/shared/services/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/auth")>();
  return { ...actual, firstAccess: ctx.firstAccess };
});

import { Route as FirstAccessRoute } from "@/screens/(public)/primeiro-acesso";
import { FirstAccessError } from "@/shared/services/auth";

type Opts = { component: () => ReactNode; validateSearch: (raw: Record<string, unknown>) => unknown };
const opts = (FirstAccessRoute as unknown as { options: Opts }).options;

const wrap = () =>
  render(createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) }, createElement(opts.component)));

const submitButton = () => screen.getByRole("button", { name: /Definir senha e entrar|Entrando/ });

async function typePasswords(password = "senha-forte-1", confirm = password) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Mínimo 8 caracteres"), password);
  await user.type(screen.getByPlaceholderText("Digite a senha novamente"), confirm);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.search = { email: "dona@marca.com.br", code: "123456" };
});

describe("Primeiro acesso", () => {
  it("lê e-mail e código da URL, preenche os campos (editáveis) e tira o código da URL", async () => {
    wrap();
    expect(screen.getByPlaceholderText("Digite seu e-mail")).toHaveValue("dona@marca.com.br");
    expect(screen.getByPlaceholderText("123456")).toHaveValue("123456");
    expect(screen.getByPlaceholderText("Digite seu e-mail")).toBeEnabled();
    expect(screen.getByPlaceholderText("123456")).toBeEnabled();
    await waitFor(() => expect(ctx.navigate).toHaveBeenCalledWith({ to: ".", search: { email: "dona@marca.com.br", code: "" }, replace: true }));
  });

  it("sem e-mail nem código na URL a pessoa digita (e nada é trocado na URL)", async () => {
    ctx.search = { email: "", code: "" };
    wrap();
    expect(screen.getByPlaceholderText("Digite seu e-mail")).toHaveValue("");
    expect(screen.getByPlaceholderText("123456")).toHaveValue("");
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it("validateSearch ignora o que não é texto", () => {
    expect(opts.validateSearch({ email: "a@b.com", code: "123456" })).toEqual({ email: "a@b.com", code: "123456" });
    expect(opts.validateSearch({ email: 5, code: ["1"] })).toEqual({ email: "", code: "" });
  });

  it("define a senha, guarda o token como o login e leva para o início", async () => {
    ctx.firstAccess.mockResolvedValue({ token: "tok-123" });
    wrap();
    const user = await typePasswords();
    await user.click(submitButton());
    await waitFor(() => expect(ctx.firstAccess).toHaveBeenCalledTimes(1));
    expect(ctx.firstAccess.mock.calls[0][0]).toEqual({ email: "dona@marca.com.br", code: "123456", password: "senha-forte-1" });
    await waitFor(() => expect(ctx.saveAuthToken).toHaveBeenCalledWith("tok-123"));
    expect(ctx.navigate).toHaveBeenLastCalledWith({ to: "/" });
  });

  it("valida no cliente: senha de 8 a 255, senhas iguais, código de 6 dígitos", async () => {
    wrap();
    const user = await typePasswords("curta", "outra");
    await user.click(submitButton());
    expect(await screen.findByText("Senha deve ter no mínimo 8 caracteres")).toBeInTheDocument();
    expect(screen.getByText("As senhas não coincidem")).toBeInTheDocument();
    expect(ctx.firstAccess).not.toHaveBeenCalled();
    await user.clear(screen.getByPlaceholderText("123456"));
    await user.type(screen.getByPlaceholderText("123456"), "12a4");
    expect(screen.getByPlaceholderText("123456")).toHaveValue("124");
    await user.click(submitButton());
    expect(await screen.findByText("Informe o código de 6 dígitos do e-mail")).toBeInTheDocument();
  });

  it("enquanto envia o botão fica travado (sem envio duplo)", async () => {
    let finish: (value: { token: string }) => void = () => undefined;
    ctx.firstAccess.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    wrap();
    const user = await typePasswords();
    await user.click(submitButton());
    await waitFor(() => expect(screen.getByRole("button", { name: "Entrando..." })).toBeDisabled());
    expect(ctx.firstAccess).toHaveBeenCalledTimes(1);
    finish({ token: "t" });
  });

  it("400 'Código inválido ou expirado': mostra a frase combinada e o link do Esqueci a senha", async () => {
    ctx.firstAccess.mockRejectedValue(new FirstAccessError({ status: 400, code: "Bad Request", messages: ["Código inválido ou expirado"] }));
    wrap();
    const user = await typePasswords();
    await user.click(submitButton());
    expect(
      await screen.findByText("Este convite expirou ou o código está errado. Peça um novo convite à equipe do HypeApp ou use Esqueci a senha."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Esqueci a senha" })).toHaveAttribute("href", "/forgot-password");
    expect(ctx.saveAuthToken).not.toHaveBeenCalled();
  });

  it("400 de validação: a mensagem vai para o campo certo", async () => {
    ctx.firstAccess.mockRejectedValue(
      new FirstAccessError({ status: 400, code: "Bad Request", messages: ["password must be longer than or equal to 8 characters", "email must be an email"] }),
    );
    wrap();
    const user = await typePasswords();
    await user.click(submitButton());
    expect(await screen.findByText("password must be longer than or equal to 8 characters")).toBeInTheDocument();
    expect(screen.getByText("email must be an email")).toBeInTheDocument();
  });

  it("429: 'Muitas tentativas. Aguarde e tente de novo.'", async () => {
    ctx.firstAccess.mockRejectedValue(new FirstAccessError({ status: 429, code: null, messages: ["Too Many Requests"] }));
    wrap();
    const user = await typePasswords();
    await user.click(submitButton());
    expect(await screen.findByText("Muitas tentativas. Aguarde e tente de novo.")).toBeInTheDocument();
  });

  it("403 ACCOUNT_SUSPENDED: o mesmo aviso de conta suspensa do login", async () => {
    ctx.firstAccess.mockRejectedValue(new FirstAccessError({ status: 403, code: "ACCOUNT_SUSPENDED", messages: ["Conta suspensa. Entre em contato com o suporte."] }));
    wrap();
    const user = await typePasswords();
    await user.click(submitButton());
    expect(await screen.findByText("Conta suspensa. Entre em contato com o suporte.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Falar com o suporte" })).toBeInTheDocument();
    expect(ctx.saveAuthToken).not.toHaveBeenCalled();
  });
});

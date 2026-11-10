/**
 * Cadastro fechado por enquanto (`SIGNUP_ENABLED = false`): ninguém cria conta nem marca pela plataforma. Quem já tem
 * conta entra normalmente. Fica em `src/test`: tudo dentro de `src/screens` é lido pelo gerador de rotas.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  redirect: (args: unknown) => ({ redirectTo: args }),
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/onboarding/create-workspace", search: {} }),
  useRouter: () => ({}),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/shared/services/auth", () => ({ signIn: vi.fn(), signUp: vi.fn() }));
vi.mock("@/lib/utils/api", () => ({ saveAuthToken: vi.fn() }));

import { Route as SignInRoute } from "@/screens/(public)/sign-in";
import { Route as SignUpRoute } from "@/screens/(public)/sign-up";
import { Route as CreateWorkspaceRoute } from "@/screens/(private)/onboarding/create-workspace";
import { SIGNUP_ENABLED } from "@/shared/constants/signup";

type Opts = { component: () => ReactNode; beforeLoad?: () => void };
const opts = (r: unknown) => (r as { options: Opts }).options;

describe("cadastro fechado", () => {
  it("o interruptor está desligado", () => {
    expect(SIGNUP_ENABLED).toBe(false);
  });

  it("entrar não oferece 'Criar conta'; mostra que os cadastros estão fechados", () => {
    const SignIn = opts(SignInRoute).component;
    render(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(SignIn)));
    expect(screen.queryByRole("link", { name: "Criar conta" })).not.toBeInTheDocument();
    expect(screen.getByText("Novos cadastros estão temporariamente fechados.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("/sign-up redireciona para entrar", () => {
    expect(() => opts(SignUpRoute).beforeLoad?.()).toThrow();
    try {
      opts(SignUpRoute).beforeLoad?.();
    } catch (e) {
      expect(e).toEqual({ redirectTo: { to: "/sign-in", replace: true } });
    }
  });

  it("criar workspace redireciona para o painel", () => {
    try {
      opts(CreateWorkspaceRoute).beforeLoad?.();
      throw new Error("deveria redirecionar");
    } catch (e) {
      expect(e).toEqual({ redirectTo: { to: "/", replace: true } });
    }
  });
});

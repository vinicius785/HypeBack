/**
 * Layout das telas privadas: quem cai na Configuração da conta. Com a confirmação do telefone desligada, conta nova
 * (sem telefone e sem marca) vai direto criar a marca; com ela ligada, conta sem telefone vai para o primeiro passo.
 * A regra em si está em `lib/onboarding/flow.test.ts`; aqui fica a ligação com o layout (consulta das marcas, espera,
 * redirecionamento). Fica em `src/test`: tudo dentro de `src/screens` é lido pelo gerador de rotas.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/shared/types";

const ctx = vi.hoisted(() => ({
  user: null as User | null,
  pathname: "/",
  workspaces: { data: undefined as unknown[] | undefined, isPending: true },
  navigate: vi.fn(),
  workspaceOptions: [] as unknown[],
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: unknown }) => ({ options }),
  Outlet: () => <div data-testid="outlet" />,
  redirect: vi.fn(),
  useLocation: () => ({ pathname: ctx.pathname }),
  useNavigate: () => ctx.navigate,
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ user: ctx.user, isLoading: false, error: null, isError: false }),
}));
vi.mock("@/hooks/use-workspaces", () => ({
  useWorkspaces: (options: unknown) => {
    ctx.workspaceOptions.push(options);
    return ctx.workspaces;
  },
}));
vi.mock("@/lib/utils/session", () => ({ clearClientSession: vi.fn() }));
vi.mock("@/lib/utils/api", () => ({ getAuthToken: () => "token" }));
vi.mock("@/components/ui/loading-spinner", () => ({
  LoadingSpinner: ({ message }: { message: string }) => <div data-testid="spinner">{message}</div>,
}));

import { Route } from "@/screens/(private)/_layout";

const Layout = (Route as unknown as { options: { component: () => ReactNode } }).options.component;

const BASE: User = { id: 1, name: "Ana", email: "ana@marca.com", phone: null, created_at: "", updated_at: "" };
const STAFF: User = { ...BASE, is_platform_admin: true, platform_role: "admin" };

const setWorkspaces = (data: unknown[] | undefined, isPending = false) => {
  ctx.workspaces = { data, isPending };
};
const lastEnabled = () => (ctx.workspaceOptions.at(-1) as { enabled: boolean }).enabled;

beforeEach(() => {
  ctx.user = BASE;
  ctx.pathname = "/";
  ctx.workspaces = { data: undefined, isPending: true };
  ctx.navigate.mockReset();
  ctx.workspaceOptions = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("(private)/_layout e a Configuração da conta", () => {
  describe("confirmação do telefone desligada (o padrão)", () => {
    it("conta nova, sem marca, vai direto criar a marca", () => {
      setWorkspaces([]);
      render(createElement(Layout));

      expect(ctx.navigate).toHaveBeenCalledWith({ to: "/onboarding/create-workspace", replace: true });
    });

    it("enquanto a lista de marcas não chega, espera (sem piscar o app e sem desviar ninguém)", () => {
      setWorkspaces(undefined, true);
      render(createElement(Layout));

      expect(screen.getByTestId("spinner")).toHaveTextContent("Preparando ambiente...");
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
      expect(ctx.navigate).not.toHaveBeenCalled();
      expect(lastEnabled()).toBe(true);
    });

    it("se a lista de marcas falhar, o app abre como está (uma falha da API não manda ninguém criar marca)", () => {
      setWorkspaces(undefined, false);
      render(createElement(Layout));

      expect(screen.getByTestId("outlet")).toBeInTheDocument();
      expect(ctx.navigate).not.toHaveBeenCalled();
    });

    it("quem não tem telefone mas já tem marca entra no app", () => {
      setWorkspaces([{ id: "w1" }]);
      render(createElement(Layout));

      expect(screen.getByTestId("outlet")).toBeInTheDocument();
      expect(ctx.navigate).not.toHaveBeenCalled();
    });

    it("quem tem telefone entra direto e a lista de marcas nem é consultada aqui", () => {
      ctx.user = { ...BASE, phone: "11992922135" };
      render(createElement(Layout));

      expect(screen.getByTestId("outlet")).toBeInTheDocument();
      expect(ctx.navigate).not.toHaveBeenCalled();
      expect(lastEnabled()).toBe(false);
    });

    it("a equipe da plataforma não é levada para a criação de marca", () => {
      ctx.user = STAFF;
      ctx.pathname = "/admin/dashboard";
      setWorkspaces([]);
      render(createElement(Layout));

      expect(screen.getByTestId("outlet")).toBeInTheDocument();
      expect(ctx.navigate).not.toHaveBeenCalled();
      expect(lastEnabled()).toBe(false);
    });

    it("já dentro da Configuração da conta, nada é desviado nem espera a lista de marcas", () => {
      ctx.pathname = "/onboarding/create-workspace";
      setWorkspaces(undefined, true);
      render(createElement(Layout));

      expect(screen.getByTestId("outlet")).toBeInTheDocument();
      expect(ctx.navigate).not.toHaveBeenCalled();
    });
  });

  describe("confirmação do telefone ligada (VITE_PHONE_VERIFICATION=on)", () => {
    beforeEach(() => vi.stubEnv("VITE_PHONE_VERIFICATION", "on"));

    it("conta sem telefone vai para o primeiro passo, como sempre foi", () => {
      render(createElement(Layout));

      expect(ctx.navigate).toHaveBeenCalledWith({ to: "/onboarding", replace: true });
      expect(lastEnabled()).toBe(false);
    });

    it("quem tem telefone entra direto", () => {
      ctx.user = { ...BASE, phone: "11992922135" };
      render(createElement(Layout));

      expect(screen.getByTestId("outlet")).toBeInTheDocument();
      expect(ctx.navigate).not.toHaveBeenCalled();
    });
  });
});

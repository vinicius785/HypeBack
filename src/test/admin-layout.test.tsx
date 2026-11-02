/**
 * Layout do Admin: espelha o do app no celular e não leva nada do workspace (Header, seletor).
 * Fica em `src/test` e não ao lado do layout: tudo dentro de `src/screens` é lido pelo gerador de rotas.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  pathname: "/admin/dashboard",
  user: { name: "Vini", email: "v@h.com", is_platform_admin: true } as Record<string, unknown> | null,
  navigate: vi.fn(),
  sidebarScope: vi.fn(),
  mobileScope: vi.fn(),
  guard: vi.fn(),
  scrollTo: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: unknown }) => ({ options }),
  Outlet: () => <div data-testid="outlet" />,
  useLocation: () => ({ pathname: ctx.pathname }),
  useNavigate: () => ctx.navigate,
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: ctx.user }) }));
vi.mock("@/contexts/workspace-context", () => ({ WorkspaceProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/hooks/admin/use-admin-session-guard", () => ({ useAdminSessionGuard: () => ctx.guard() }));
vi.mock("@/components/sidebar", () => ({
  Sidebar: ({ scope }: { scope?: string }) => {
    ctx.sidebarScope(scope);
    return <aside data-testid="sidebar" data-scope={scope} />;
  },
}));
vi.mock("@/components/mobile-nav", () => ({
  MobileNav: ({ scope }: { scope?: string }) => {
    ctx.mobileScope(scope);
    return <nav data-testid="mobile-nav" data-scope={scope} />;
  },
}));
vi.mock("@/components/header", () => ({ Header: () => <div data-testid="header" /> }));

import { Route } from "@/screens/(private)/(admin)/_layout";

const Layout = (Route as unknown as { options: { component: () => ReactNode } }).options.component;

beforeEach(() => {
  ctx.pathname = "/admin/dashboard";
  ctx.user = { name: "Vini", email: "v@h.com", is_platform_admin: true };
  ctx.navigate.mockReset();
  ctx.sidebarScope.mockReset();
  ctx.mobileScope.mockReset();
  ctx.guard.mockReset();
  ctx.scrollTo.mockReset();
  HTMLElement.prototype.scrollTo = ctx.scrollTo as never;
});
afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
});

describe("(admin)/_layout", () => {
  it("monta a sidebar e a navegação do celular no escopo da plataforma, e a página", () => {
    render(createElement(Layout));
    expect(screen.getByTestId("sidebar")).toHaveAttribute("data-scope", "platform");
    expect(screen.getByTestId("mobile-nav")).toHaveAttribute("data-scope", "platform");
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });

  it("não leva o Header do app (sino e chat são do workspace, não da plataforma)", () => {
    render(createElement(Layout));
    expect(screen.queryByTestId("header")).not.toBeInTheDocument();
  });

  it("espelha o layout do app no celular: coluna única sem folga e espaço para a barra inferior", () => {
    const { container } = render(createElement(Layout));
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toContain("max-[900px]:grid-cols-1");
    expect(grid.className).toContain("max-[900px]:gap-0");
    expect(grid.className).toContain("max-[900px]:p-0");
    expect(grid.className).toContain("max-[1100px]:grid-cols-[84px_1fr]");
    const main = container.querySelector("main") as HTMLElement;
    expect(main.className).toContain("max-[900px]:pb-32");
    expect(main.className).toContain("overflow-y-auto");
  });

  it("o <main> não tem respiro em cima: o cabeçalho fixo das tabelas gruda na borda e nenhuma linha aparece por cima dele", () => {
    const { container } = render(createElement(Layout));
    const main = container.querySelector("main") as HTMLElement;
    expect(main.className).not.toMatch(/(^|\s)pt-/);
    // O respiro (o mesmo `pt-4` de antes) vem do div de dentro, que leva a página.
    const inner = main.firstElementChild as HTMLElement;
    expect(inner.className).toContain("pt-4");
    expect(inner).toContainElement(screen.getByTestId("outlet"));
  });

  it("liga o tratamento de sessão vencida", () => {
    render(createElement(Layout));
    expect(ctx.guard).toHaveBeenCalled();
  });

  it("quem não é admin da plataforma não vê nada e volta para o início", () => {
    ctx.user = { name: "Cliente", email: "c@m.com" };
    const { container } = render(createElement(Layout));
    expect(container).toBeEmptyDOMElement();
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/", replace: true });
  });

  it("sem usuário carregado não mostra nada (e não redireciona)", () => {
    ctx.user = null;
    const { container } = render(createElement(Layout));
    expect(container).toBeEmptyDOMElement();
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it("volta ao topo ao entrar em outra página", () => {
    const { rerender } = render(createElement(Layout));
    ctx.scrollTo.mockClear();
    ctx.pathname = "/admin/workspaces";
    rerender(createElement(Layout));
    expect(ctx.scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it("não volta ao topo ao abrir/fechar o diálogo da Comunidade por cima da lista", () => {
    ctx.pathname = "/admin/groups";
    const { rerender } = render(createElement(Layout));
    ctx.scrollTo.mockClear();

    ctx.pathname = "/admin/groups/new";
    rerender(createElement(Layout));
    expect(ctx.scrollTo).not.toHaveBeenCalled();

    ctx.pathname = "/admin/groups";
    rerender(createElement(Layout));
    expect(ctx.scrollTo).not.toHaveBeenCalled();
  });

  it("mas ao entrar na Comunidade vindo de outra página, volta ao topo", () => {
    const { rerender } = render(createElement(Layout));
    ctx.scrollTo.mockClear();
    ctx.pathname = "/admin/groups";
    rerender(createElement(Layout));
    expect(ctx.scrollTo).toHaveBeenCalledWith({ top: 0 });
  });
});

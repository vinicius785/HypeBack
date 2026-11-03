/**
 * Layout do app: o que o estado do workspace selecionado muda. Suspenso troca a página pela tela de bloqueio e
 * tira o topo; arquivado ganha a faixa de somente consulta; ativo fica como sempre. Fica em `src/test` e não ao
 * lado do layout: tudo dentro de `src/screens` é lido pelo gerador de rotas.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  pathname: "/",
  status: "active" as string | undefined,
  scrollTo: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: unknown }) => ({ options }),
  Outlet: () => <div data-testid="outlet" />,
  useLocation: () => ({ pathname: ctx.pathname }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  WorkspaceProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useWorkspaceContext: () => ({ selectedWorkspace: { id: "w1", name: "Acme", status: ctx.status } }),
}));
vi.mock("@/components/workspace-invites/my-invites", () => ({ MyInvitesPanel: () => null }));
vi.mock("@/components/sidebar", () => ({ Sidebar: () => <aside data-testid="sidebar" /> }));
vi.mock("@/components/mobile-nav", () => ({ MobileNav: () => <nav data-testid="mobile-nav" /> }));
vi.mock("@/components/header", () => ({ Header: ({ title }: { title?: string }) => <div data-testid="header" data-title={title} /> }));
vi.mock("@/components/workspace-state/workspace-suspended-state", () => ({ WorkspaceSuspendedState: () => <div data-testid="bloqueio" /> }));

import { Route } from "@/screens/(private)/(app)/_layout";

const Layout = (Route as unknown as { options: { component: () => ReactNode } }).options.component;

beforeEach(() => {
  ctx.pathname = "/";
  ctx.status = "active";
  ctx.scrollTo.mockReset();
  HTMLElement.prototype.scrollTo = ctx.scrollTo as never;
});
afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
});

const main = (container: HTMLElement) => container.querySelector("main") as HTMLElement;

describe("(app)/_layout e o estado do workspace", () => {
  it("ativo: menu, topo e página, sem faixa nem bloqueio", () => {
    const { container } = render(createElement(Layout));
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(within(main(container)).getByTestId("outlet")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bloqueio")).not.toBeInTheDocument();
  });

  it("arquivado: a faixa 'somente consulta' fica entre o topo e a página, que segue funcionando", () => {
    ctx.status = "archived";
    const { container } = render(createElement(Layout));
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Workspace arquivado — somente consulta");
    expect(screen.getByTestId("header").compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(banner.compareDocumentPosition(main(container)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main(container)).not.toContainElement(banner);
    expect(within(main(container)).getByTestId("outlet")).toBeInTheDocument();
  });

  it("suspenso: a tela de bloqueio ocupa a área de conteúdo, sem a página nem o topo (que chama a API do workspace)", () => {
    ctx.status = "suspended";
    const { container } = render(createElement(Layout));
    expect(within(main(container)).getByTestId("bloqueio")).toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("header")).not.toBeInTheDocument();
  });

  it("suspenso: o menu (e com ele o seletor de workspace) e a barra do celular continuam, para trocar de workspace", () => {
    ctx.status = "suspended";
    render(createElement(Layout));
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav")).toBeInTheDocument();
  });

  it("suspenso, em Meu perfil: a página abre (é da conta), o topo segue de fora", () => {
    ctx.status = "suspended";
    ctx.pathname = "/settings";
    const { container } = render(createElement(Layout));
    expect(within(main(container)).getByTestId("outlet")).toBeInTheDocument();
    expect(screen.queryByTestId("bloqueio")).not.toBeInTheDocument();
    expect(screen.queryByTestId("header")).not.toBeInTheDocument();
  });

  it("o detalhe da campanha traz a própria barra de topo: sem Header, mas a faixa de arquivado aparece", () => {
    ctx.pathname = "/campaigns/abc";
    ctx.status = "archived";
    const { container } = render(createElement(Layout));
    expect(screen.queryByTestId("header")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(within(main(container)).getByTestId("outlet")).toBeInTheDocument();
  });

  it("a rolagem ao topo a cada página nova segue como antes", () => {
    ctx.pathname = "/financial";
    const { rerender } = render(createElement(Layout));
    expect(screen.getByTestId("header")).toBeInTheDocument();
    ctx.scrollTo.mockClear();
    ctx.pathname = "/creators";
    rerender(createElement(Layout));
    expect(ctx.scrollTo).toHaveBeenCalledWith({ top: 0 });
  });
});

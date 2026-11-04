import type React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  Outlet: () => null,
  useLocation: () => ({ pathname: h.pathname }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  WorkspaceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWorkspaceContext: () => ({ selectedWorkspace: undefined }),
}));
vi.mock("@/components/workspace-invites/my-invites", () => ({ MyInvitesPanel: () => null }));
vi.mock("@/components/sidebar", () => ({ Sidebar: () => null }));
vi.mock("@/components/mobile-nav", () => ({ MobileNav: () => null }));
vi.mock("@/components/header", () => ({ Header: ({ title }: { title: string }) => <div data-testid="top-title">{title}</div> }));
vi.mock("@/components/team-chat/team-chat-provider", () => ({ TeamChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/workspace-state/workspace-state-slots", () => ({
  WorkspaceStateTop: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  WorkspaceStateContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { Route } from "./_layout";

const Layout = (Route as unknown as { component: () => React.JSX.Element }).component;
const topTitle = (path: string) => {
  h.pathname = path;
  const { unmount } = render(<Layout />);
  const text = screen.getByTestId("top-title").textContent;
  unmount();
  return text;
};

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
});

describe("título da barra do topo", () => {
  it("telas que trazem o próprio título não ganham um 'Início' por cima (Marcas, Elenco, Criadores, Início)", () => {
    for (const path of ["/brands", "/roster", "/creators", "/"]) expect(topTitle(path)).toBe("");
  });

  it("uma tela nova que ninguém listou também abre sem título falso", () => {
    expect(topTitle("/qualquer-tela-nova")).toBe("");
    expect(topTitle("/influencer/12")).toBe("");
  });
});

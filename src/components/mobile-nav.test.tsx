/** Menu do celular: no layout do Admin a barra e a gaveta levam as áreas do Admin e nada de workspace. */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  pathname: "/admin/dashboard",
  navigate: vi.fn(),
  selectWorkspace: vi.fn(),
  user: { name: "Vini", email: "vini@hype.com", is_platform_admin: true } as Record<string, unknown>,
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: ctx.pathname }),
  useNavigate: () => ctx.navigate,
}));
vi.mock("@tanstack/react-query", () => ({ useMutation: () => ({ mutate: vi.fn() }), useQueryClient: () => ({ clear: vi.fn() }) }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: ctx.user, setUser: vi.fn() }) }));
vi.mock("@/contexts/workspace-context", () => {
  const ws = { id: "w1", name: "Acme", role: "owner", photo: null };
  return {
    useWorkspaceContext: () => ({ workspaces: [ws], selectedWorkspace: ws, selectWorkspace: ctx.selectWorkspace }),
    useWorkspacePermissions: () => ({ campaigns_read: true, catalog_read: true, community_lives_read: true, financial_read: true }),
  };
});
vi.mock("@/hooks/use-campaigns", () => ({ useCampaigns: () => ({ data: [] }) }));
vi.mock("@/shared/services/auth", () => ({ logout: vi.fn() }));

import { MobileNav } from "./mobile-nav";

beforeEach(() => {
  ctx.pathname = "/admin/dashboard";
  ctx.navigate.mockReset();
  ctx.selectWorkspace.mockReset();
  ctx.user = { name: "Vini", email: "vini@hype.com", is_platform_admin: true };
});

describe("MobileNav no escopo da plataforma", () => {
  it("a barra leva Dashboard, Workspaces, Usuários e Financeiro (mais o 'Mais')", () => {
    render(<MobileNav scope="platform" />);
    const bar = within(screen.getByRole("navigation", { name: "Navegação principal" }));
    expect(bar.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Dashboard",
      "Workspaces",
      "Usuários",
      "Financeiro",
      "Mais opções",
    ]);
    expect(bar.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("a gaveta 'Mais' tem as duas áreas, só com o que a barra não mostra, sem workspaces e com 'Voltar ao app'", async () => {
    render(<MobileNav scope="platform" />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    const sheet = within(screen.getByRole("dialog", { name: "Mais opções" }));

    expect(sheet.getByText("Administração")).toBeInTheDocument();
    expect(sheet.getByText("Monitoramento")).toBeInTheDocument();
    for (const label of ["Campanhas", "Criadores", "Comunidade", "Atividades", "Notificações", "Saúde da plataforma"]) {
      expect(sheet.getByRole("button", { name: label })).toBeInTheDocument();
    }
    // o que está na barra não repete na gaveta
    for (const label of ["Dashboard", "Workspaces", "Usuários", "Financeiro"]) {
      expect(sheet.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
    // nada de workspace: escolher um mexeria no workspaceId guardado
    expect(sheet.queryByText("Workspace")).not.toBeInTheDocument();
    expect(sheet.queryByRole("button", { name: /Acme/ })).not.toBeInTheDocument();
    expect(sheet.queryByRole("button", { name: "Novo workspace" })).not.toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Voltar ao app" })).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Meu perfil" })).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(ctx.selectWorkspace).not.toHaveBeenCalled();
  });

  it("'Voltar ao app' e os itens da gaveta navegam", async () => {
    render(<MobileNav scope="platform" />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    const sheet = within(screen.getByRole("dialog", { name: "Mais opções" }));
    await userEvent.click(sheet.getByRole("button", { name: "Saúde da plataforma" }));
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/admin/health" });
    await userEvent.click(sheet.getByRole("button", { name: "Voltar ao app" }));
    expect(ctx.navigate).toHaveBeenLastCalledWith({ to: "/" });
  });

  it("estando numa página que só existe na gaveta, o 'Mais' fica ativo", () => {
    ctx.pathname = "/admin/notifications";
    render(<MobileNav scope="platform" />);
    expect(screen.getByRole("button", { name: "Mais opções" })).toHaveClass("on");
  });

  it("rota filha de um item da barra acende o item da barra", () => {
    ctx.pathname = "/admin/workspaces/abc";
    render(<MobileNav scope="platform" />);
    expect(screen.getByRole("button", { name: "Workspaces" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Mais opções" })).not.toHaveClass("on");
  });
});

describe("MobileNav no escopo do workspace (app)", () => {
  it("mantém a barra do app, a lista de workspaces e, na gaveta, só a entrada 'Backoffice' sob o divisor 'Administração'", async () => {
    ctx.pathname = "/";
    render(<MobileNav />);
    const bar = within(screen.getByRole("navigation", { name: "Navegação principal" }));
    expect(bar.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Início", "Campanhas", "Criadores", "Financeiro", "Mais opções"]);

    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    const sheet = within(screen.getByRole("dialog", { name: "Mais opções" }));
    // rótulo da lista de workspaces (o botão "Workspace" da conta tem o mesmo texto)
    expect(sheet.getAllByText("Workspace").some((el) => el.tagName === "SMALL")).toBe(true);
    expect(sheet.getByRole("button", { name: /Acme/ })).toBeInTheDocument();
    expect(sheet.getByText("Administração")).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Backoffice" })).toBeInTheDocument();
    // as páginas do Admin só aparecem dentro do Admin
    expect(sheet.queryByText("Monitoramento")).not.toBeInTheDocument();
    expect(sheet.queryByRole("button", { name: "Workspaces" })).not.toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Novo workspace" })).toBeInTheDocument();
    expect(sheet.queryByRole("button", { name: "Voltar ao app" })).not.toBeInTheDocument();
  });

  it("'Backoffice' na gaveta leva ao Admin", async () => {
    ctx.pathname = "/";
    render(<MobileNav />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Mais opções" })).getByRole("button", { name: "Backoffice" }));
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/admin/dashboard" });
  });

  it("quem não é admin da plataforma não vê o Admin na gaveta, nem a porta de entrada", async () => {
    ctx.pathname = "/";
    ctx.user = { name: "Cliente", email: "c@m.com" };
    render(<MobileNav />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
    expect(screen.queryByText("Backoffice")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Backoffice" })).not.toBeInTheDocument();
  });
});

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

  it("a gaveta 'Mais' tem os grupos de Operação e Monitoramento, só com o que a barra não mostra, sem workspaces e com 'Voltar ao app'", async () => {
    render(<MobileNav scope="platform" />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    const sheet = within(screen.getByRole("dialog", { name: "Mais opções" }));

    expect(sheet.getByText("Operação")).toBeInTheDocument();
    expect(sheet.getByText("Monitoramento")).toBeInTheDocument();
    // grupos cujos itens estão todos na barra não aparecem vazios
    expect(sheet.queryByText("Visão geral")).not.toBeInTheDocument();
    // "Gestão da plataforma" ficou só com a Equipe, que não está na barra
    expect(sheet.getByText("Gestão da plataforma")).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Equipe" })).toBeInTheDocument();
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
  it("mantém a barra do app, a lista de workspaces e, na gaveta, só o que a barra não mostra (com o Backoffice)", async () => {
    ctx.pathname = "/";
    render(<MobileNav />);
    const bar = within(screen.getByRole("navigation", { name: "Navegação principal" }));
    expect(bar.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Início", "Campanhas", "Criadores", "Financeiro", "Mais opções"]);

    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    const sheet = within(screen.getByRole("dialog", { name: "Mais opções" }));
    // rótulo da lista de workspaces (o botão "Workspace" da conta tem o mesmo texto)
    expect(sheet.getAllByText("Workspace").some((el) => el.tagName === "SMALL")).toBe(true);
    expect(sheet.getByRole("button", { name: /Acme/ })).toBeInTheDocument();
    expect(sheet.getByText("Gestão de campanhas")).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Lives" })).toBeInTheDocument();
    expect(sheet.getByText("Administração")).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Backoffice" })).toBeInTheDocument();
    // a estrutura do Admin não se replica no ambiente do cliente
    for (const label of ["Workspaces", "Usuários", "Saúde da plataforma"]) {
      expect(sheet.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
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

  it("quem não é admin da plataforma não vê o Admin na gaveta", async () => {
    ctx.pathname = "/";
    ctx.user = { name: "Cliente", email: "c@m.com" };
    render(<MobileNav />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Backoffice" })).not.toBeInTheDocument();
  });
});

describe("MobileNav: a gaveta 'Mais' se comporta como diálogo modal", () => {
  const sheetEl = () => document.querySelector<HTMLElement>(".bms")!;
  const firstNavButton = () => document.querySelector<HTMLElement>(".bms-sc button")!;

  it("fechada, a gaveta está inerte e oculta da leitura de tela (nada dela entra na ordem de tabulação)", () => {
    render(<MobileNav scope="platform" />);
    expect(sheetEl()).toHaveAttribute("inert");
    expect(sheetEl()).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("aberta, deixa de ser inerte e o foco vai para o primeiro item de navegação", async () => {
    render(<MobileNav scope="platform" />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    expect(sheetEl()).not.toHaveAttribute("inert");
    expect(sheetEl()).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("dialog", { name: "Mais opções" })).toBeInTheDocument();
    expect(document.activeElement).toBe(firstNavButton());
  });

  it("no app do cliente o foco inicial não cai no seletor de workspace", async () => {
    ctx.pathname = "/";
    render(<MobileNav />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    const active = document.activeElement as HTMLElement;
    expect(active.closest(".bms-ws")).toBeNull();
    expect(active).toBe(firstNavButton());
    expect(active).toHaveAttribute("data-adm-autofocus");
  });

  it("Tab e Shift+Tab ficam presos dentro da gaveta", async () => {
    render(<MobileNav scope="platform" />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    const buttons = within(screen.getByRole("dialog", { name: "Mais opções" })).getAllByRole("button");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    expect(last).toHaveAccessibleName("Sair");
    last.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(first);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(last);
    expect(sheetEl().contains(document.activeElement)).toBe(true);
  });

  it("Escape fecha a gaveta e devolve o foco ao botão 'Mais'", async () => {
    render(<MobileNav scope="platform" />);
    const more = screen.getByRole("button", { name: "Mais opções" });
    await userEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(sheetEl()).toHaveAttribute("inert");
    expect(document.activeElement).toBe(more);
  });

  it("fechar pelo fundo escurecido também devolve o foco ao botão 'Mais'", async () => {
    render(<MobileNav scope="platform" />);
    const more = screen.getByRole("button", { name: "Mais opções" });
    await userEvent.click(more);
    await userEvent.click(document.querySelector<HTMLElement>(".bms-bd")!);
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(more);
  });

  it("travar a rolagem da página só enquanto a gaveta está aberta", async () => {
    render(<MobileNav scope="platform" />);
    await userEvent.click(screen.getByRole("button", { name: "Mais opções" }));
    expect(document.body.style.overflow).toBe("hidden");
    await userEvent.keyboard("{Escape}");
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("montar a barra não rouba o foco da página (o foco só volta ao 'Mais' depois de ter aberto a gaveta)", () => {
    render(<MobileNav scope="platform" />);
    expect(document.activeElement).toBe(document.body);
  });
});

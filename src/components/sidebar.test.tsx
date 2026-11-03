/**
 * Menu lateral: o Admin da plataforma em duas áreas, e o que muda no escopo `platform` (layout do Admin):
 * o seletor de workspace não existe (não há como regravar o `workspaceId`), os itens do workspace saem e
 * entra o "Voltar ao app".
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  pathname: "/",
  navigate: vi.fn(),
  selectWorkspace: vi.fn(),
  useCampaigns: vi.fn(),
  user: { name: "Vini", email: "vini@hype.com", is_platform_admin: true } as Record<string, unknown>,
  campaigns: [] as Array<{ status: string }>,
  edges: { before: false, after: false },
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
    useWorkspaceContext: () => ({ workspaces: [ws, { id: "w2", name: "Beta", role: "member", photo: null }], selectedWorkspace: ws, selectWorkspace: ctx.selectWorkspace }),
    useWorkspacePermissions: () => ({ campaigns_read: true, catalog_read: true, community_lives_read: true, financial_read: true }),
  };
});
vi.mock("@/hooks/use-campaigns", () => ({
  useCampaigns: (opts: unknown) => {
    ctx.useCampaigns(opts);
    return { data: ctx.campaigns };
  },
}));
vi.mock("@/shared/services/auth", () => ({ logout: vi.fn() }));
// A geometria de rolagem não existe no jsdom: o teste diz se a lista continua além das bordas.
vi.mock("@/hooks/admin/use-scroll-edges", () => ({ useScrollEdges: () => ({ ref: { current: null }, edges: ctx.edges }) }));

import { ADMIN_NAV_GROUPS, BACKOFFICE_NAV_GROUP, LEAVE_MS, Sidebar } from "./sidebar";

beforeEach(() => {
  ctx.pathname = "/";
  ctx.navigate.mockReset();
  ctx.selectWorkspace.mockReset();
  ctx.useCampaigns.mockReset();
  ctx.user = { name: "Vini", email: "vini@hype.com", is_platform_admin: true };
  ctx.campaigns = [];
  ctx.edges = { before: false, after: false };
});

afterEach(() => {
  vi.useRealTimers();
  // O jsdom não tem `matchMedia`; os testes de movimento reduzido o definem e aqui ele sai de novo.
  Reflect.deleteProperty(window, "matchMedia");
});

const nav = () => screen.getByRole("navigation");
const aside = () => document.querySelector("aside") as HTMLElement;

describe("ADMIN_NAV_GROUPS", () => {
  it("duas áreas, na ordem pedida, com os destinos de cada página", () => {
    expect(ADMIN_NAV_GROUPS.map((g) => g.label)).toEqual(["Administração", "Monitoramento"]);
    expect(ADMIN_NAV_GROUPS[0].items.map((i) => [i.label, i.href])).toEqual([
      ["Dashboard", "/admin/dashboard"],
      ["Workspaces", "/admin/workspaces"],
      ["Usuários", "/admin/users"],
      ["Campanhas", "/admin/campaigns"],
      ["Criadores", "/admin/creators"],
      ["Financeiro", "/admin/financial"],
      ["Comunidade", "/admin/groups"],
    ]);
    expect(ADMIN_NAV_GROUPS[1].items.map((i) => [i.label, i.href])).toEqual([
      ["Atividades", "/admin/activity"],
      ["Notificações", "/admin/notifications"],
      ["Saúde da plataforma", "/admin/health"],
    ]);
  });

  it("todos os ícones são diferentes: Comunidade não reusa o de Criadores (nem o de Usuários)", () => {
    const icons = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.icon));
    expect(new Set(icons).size).toBe(icons.length);
    const iconOf = (label: string) => ADMIN_NAV_GROUPS.flatMap((g) => g.items).find((i) => i.label === label)?.icon;
    expect(iconOf("Comunidade")).not.toBe(iconOf("Criadores"));
    expect(iconOf("Comunidade")).not.toBe(iconOf("Usuários"));
  });

  it("todos os ícones existem no mapa do protótipo (`I`)", async () => {
    const src = (await import("@/components/prototype/ui?raw")).default as string;
    for (const { icon } of ADMIN_NAV_GROUPS.flatMap((g) => g.items)) {
      expect(src).toMatch(new RegExp(`\\b${icon}: "`));
    }
  });
});

describe("BACKOFFICE_NAV_GROUP", () => {
  it("um divisor 'Administração' com uma entrada só, 'Backoffice', que abre o Admin", () => {
    expect(BACKOFFICE_NAV_GROUP.label).toBe("Administração");
    expect(BACKOFFICE_NAV_GROUP.items.map((i) => [i.label, i.href])).toEqual([["Backoffice", "/admin/dashboard"]]);
  });

  it("o ícone existe no mapa do protótipo (`I`)", async () => {
    const src = (await import("@/components/prototype/ui?raw")).default as string;
    expect(src).toMatch(new RegExp(`\\b${BACKOFFICE_NAV_GROUP.items[0].icon}: "`));
  });
});

describe("Sidebar (escopo do workspace, como no app)", () => {
  it("mostra o seletor de workspace, os itens do workspace e, para quem é admin, só a entrada 'Backoffice' sob o divisor 'Administração'", () => {
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: /Acme/ })).toHaveAttribute("aria-haspopup", "listbox");
    const items = within(nav());
    for (const label of ["Início", "Campanhas", "Criadores", "Lives", "Financeiro"]) {
      expect(items.getAllByRole("button", { name: label }).length).toBeGreaterThan(0);
    }
    const door = within(items.getByRole("group", { name: "Administração" }));
    expect(door.getAllByRole("button")).toHaveLength(1);
    expect(door.getByRole("button", { name: "Backoffice" })).toBeInTheDocument();
  });

  it("as áreas do Admin só existem dentro do Admin: no app só aparece a porta de entrada, nenhuma das páginas", () => {
    render(<Sidebar />);
    const items = within(nav());
    expect(items.queryByRole("group", { name: "Monitoramento" })).not.toBeInTheDocument();
    for (const label of ["Dashboard", "Workspaces", "Usuários", "Comunidade", "Atividades", "Notificações", "Saúde da plataforma"]) {
      expect(items.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
  });

  it("'Backoffice' leva ao Admin", async () => {
    render(<Sidebar />);
    await userEvent.click(within(nav()).getByRole("button", { name: "Backoffice" }));
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/admin/dashboard" });
  });

  it("o menu do app aberto direto (sem vir do Admin) não anima: sem cascata e sem a classe da volta", () => {
    render(<Sidebar />);
    for (const el of within(nav()).getAllByRole("button")) expect(el.style.getPropertyValue("--i")).toBe("");
    expect(aside()).not.toHaveClass("adm-returning");
  });

  it("quem não é admin da plataforma não vê o Admin, nem a porta de entrada", () => {
    ctx.user = { name: "Cliente", email: "cliente@marca.com" };
    render(<Sidebar />);
    expect(screen.queryByRole("group", { name: "Administração" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Backoffice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Workspaces" })).not.toBeInTheDocument();
  });

  it("escolher outro workspace continua regravando o selecionado (só no app)", async () => {
    render(<Sidebar />);
    await userEvent.click(screen.getByRole("option", { name: /Beta/ }));
    expect(ctx.selectWorkspace).toHaveBeenCalledWith(expect.objectContaining({ id: "w2" }));
  });

  it("o número de campanhas ativas entra no nome acessível do botão (o rótulo some no trilho)", () => {
    ctx.campaigns = [{ status: "published" }, { status: "published" }, { status: "draft" }];
    render(<Sidebar />);
    expect(within(nav()).getByRole("button", { name: "Campanhas (2)" })).toBeInTheDocument();
  });

  it("busca as campanhas do workspace para o contador", () => {
    render(<Sidebar />);
    expect(ctx.useCampaigns).toHaveBeenCalledWith({ enabled: true });
  });
});

describe("Sidebar (escopo da plataforma, no layout do Admin)", () => {
  it("troca o seletor por um bloco fixo: nada que mexa no workspace guardado", () => {
    render(<Sidebar scope="platform" />);
    expect(screen.queryByRole("button", { name: /Acme/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Seus workspaces")).not.toBeInTheDocument();
    expect(screen.queryByText("Novo workspace")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Admin da plataforma/ })).toHaveTextContent("Visão global");
    expect(ctx.selectWorkspace).not.toHaveBeenCalled();
  });

  it("não mostra os itens do workspace (Início, Lives…), só o Admin em duas áreas", () => {
    render(<Sidebar scope="platform" />);
    const items = within(screen.getByRole("navigation", { name: "Navegação do Admin" }));
    for (const label of ["Início", "Lives"]) expect(items.queryByRole("button", { name: label })).not.toBeInTheDocument();
    expect(items.getAllByRole("button")).toHaveLength(10);
    // "Administração" aqui é a área com as 7 páginas, não o divisor da porta de entrada do app (que tem uma entrada só)
    expect(within(items.getByRole("group", { name: "Administração" })).getAllByRole("button")).toHaveLength(7);
    expect(items.getByRole("group", { name: "Monitoramento" })).toBeInTheDocument();
    // dentro do Admin a porta de entrada não faz sentido: já se está nele
    expect(items.queryByRole("button", { name: "Backoffice" })).not.toBeInTheDocument();
  });

  it("não busca as campanhas do workspace (o contador não existe no Admin)", () => {
    render(<Sidebar scope="platform" />);
    expect(ctx.useCampaigns).toHaveBeenCalledWith({ enabled: false });
  });

  it("títulos e itens levam a posição na cascata de entrada (`--i`), na ordem do menu, e 'Voltar ao app' fecha a sequência", () => {
    render(<Sidebar scope="platform" />);
    const position = (el: HTMLElement) => el.style.getPropertyValue("--i");
    expect(within(nav()).getAllByRole("heading", { level: 6 }).map(position)).toEqual(["0", "8"]);
    expect(within(nav()).getAllByRole("button").map(position)).toEqual(["1", "2", "3", "4", "5", "6", "7", "9", "10", "11"]);
    expect(position(screen.getByRole("button", { name: "Voltar ao app" }))).toBe("12");
  });

  it("o perfil mostra \"Administrador\" (curto, numa linha só; o bloco de cima já diz que é a plataforma), não o papel num workspace", () => {
    render(<Sidebar scope="platform" />);
    expect(screen.getByText("Administrador", { selector: ".me small" })).toBeInTheDocument();
    expect(screen.queryByText("Proprietário")).not.toBeInTheDocument();
  });

  it("cada botão tem nome acessível e dica (no trilho o texto some)", () => {
    render(<Sidebar scope="platform" />);
    const button = within(nav()).getByRole("button", { name: "Workspaces" });
    expect(button).toHaveAttribute("title", "Workspaces");
    expect(button).toHaveAccessibleName("Workspaces");
  });

  it("clicar leva para a rota da página", async () => {
    render(<Sidebar scope="platform" />);
    await userEvent.click(within(nav()).getByRole("button", { name: "Usuários" }));
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/admin/users" });
    await userEvent.click(within(nav()).getByRole("button", { name: "Comunidade" }));
    expect(ctx.navigate).toHaveBeenLastCalledWith({ to: "/admin/groups" });
  });

  it("rota filha acende o item do pai (e só ele)", () => {
    ctx.pathname = "/admin/workspaces/3f2a9c1e-0000-4000-8000-000000000000";
    render(<Sidebar scope="platform" />);
    const items = within(nav());
    const active = items.getAllByRole("button").filter((b) => b.getAttribute("aria-current") === "page");
    expect(active.map((b) => b.getAttribute("aria-label"))).toEqual(["Workspaces"]);
    expect(items.getByRole("button", { name: "Workspaces" })).toHaveClass("on");
  });

  it("a rota da Comunidade (/admin/groups/new) acende Comunidade", () => {
    ctx.pathname = "/admin/groups/new";
    render(<Sidebar scope="platform" />);
    expect(within(nav()).getByRole("button", { name: "Comunidade" })).toHaveAttribute("aria-current", "page");
  });

  it("um prefixo parecido não acende o item errado (/admin/campaigns-x não é Campanhas)", () => {
    ctx.pathname = "/admin/campaigns-x";
    render(<Sidebar scope="platform" />);
    expect(within(nav()).getAllByRole("button").filter((b) => b.getAttribute("aria-current") === "page")).toHaveLength(0);
  });
});

describe("Sidebar (cabe na tela e mostra que a lista rola)", () => {
  it("o item da grade do layout tem altura mínima 0: sem isso o menu estica a linha da grade acima da tela e a lista nunca rola", () => {
    for (const scope of ["workspace", "platform"] as const) {
      const { container, unmount } = render(<Sidebar scope={scope} />);
      const root = container.firstElementChild as HTMLElement;
      expect(root.style.height).toBe("100%");
      expect(Number.parseFloat(root.style.minHeight)).toBe(0);
      unmount();
    }
  });

  it("a lista de itens é a área que rola (a classe do CSS que limita e rola)", () => {
    render(<Sidebar scope="platform" />);
    expect(nav()).toHaveClass("adm-nav");
  });

  it("sem conteúdo escondido, a lista não leva marca de borda", () => {
    render(<Sidebar scope="platform" />);
    expect(nav()).not.toHaveAttribute("data-more-after");
    expect(nav()).not.toHaveAttribute("data-more-before");
  });

  it("a lista continua abaixo e/ou acima: marca a borda para o CSS desenhar a linha fina", () => {
    ctx.edges = { before: false, after: true };
    const { unmount } = render(<Sidebar scope="platform" />);
    expect(nav()).toHaveAttribute("data-more-after", "true");
    expect(nav()).not.toHaveAttribute("data-more-before");
    unmount();

    ctx.edges = { before: true, after: true };
    render(<Sidebar />);
    expect(nav()).toHaveAttribute("data-more-after", "true");
    expect(nav()).toHaveAttribute("data-more-before", "true");
  });
});

describe("Sidebar (volta ao app: o menu do Admin sai e o do app entra)", () => {
  const back = () => screen.getByRole("button", { name: "Voltar ao app" });
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it("'Voltar ao app' faz o menu do Admin sair e só então leva ao início do app", () => {
    vi.useFakeTimers();
    render(<Sidebar scope="platform" />);
    fireEvent.click(back());
    expect(aside()).toHaveClass("adm-leaving");
    expect(ctx.navigate).not.toHaveBeenCalled();
    advance(LEAVE_MS - 1);
    expect(ctx.navigate).not.toHaveBeenCalled();
    advance(1);
    expect(ctx.navigate).toHaveBeenCalledTimes(1);
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("a saída conta para trás a partir do 'Voltar ao app': `--n` é a vez dele na cascata", () => {
    render(<Sidebar scope="platform" />);
    expect(aside().style.getPropertyValue("--n")).toBe("12");
    expect(back().style.getPropertyValue("--i")).toBe("12");
  });

  it("enquanto o menu sai, outros cliques não navegam e um segundo clique não agenda outra volta", () => {
    vi.useFakeTimers();
    render(<Sidebar scope="platform" />);
    fireEvent.click(back());
    fireEvent.click(within(nav()).getByRole("button", { name: "Usuários" }));
    fireEvent.click(back());
    advance(LEAVE_MS * 3);
    expect(ctx.navigate).toHaveBeenCalledTimes(1);
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("se a rota não trocar (navegação recusada), o menu volta ao normal e os cliques voltam a valer", () => {
    vi.useFakeTimers();
    render(<Sidebar scope="platform" />);
    fireEvent.click(back());
    advance(LEAVE_MS);
    expect(aside()).toHaveClass("adm-leaving");
    advance(2000);
    expect(aside()).not.toHaveClass("adm-leaving");
    fireEvent.click(within(nav()).getByRole("button", { name: "Usuários" }));
    expect(ctx.navigate).toHaveBeenLastCalledWith({ to: "/admin/users" });
  });

  it("se o menu sai da tela no meio da saída (a rota mudou por outro caminho), a volta é cancelada", () => {
    vi.useFakeTimers();
    const { unmount } = render(<Sidebar scope="platform" />);
    fireEvent.click(back());
    unmount();
    advance(5000);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it("com movimento reduzido a volta é na hora, sem esperar a saída", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    render(<Sidebar scope="platform" />);
    fireEvent.click(back());
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/" });
    expect(aside()).not.toHaveClass("adm-leaving");
  });

  describe("o menu do app que chega do Admin", () => {
    // Os dois menus são de layouts diferentes: a troca desmonta um e monta o outro no mesmo instante.
    const Swap = ({ to }: { to: "admin" | "app" }) =>
      to === "admin" ? <Sidebar key="admin" scope="platform" /> : <Sidebar key="app" />;
    const position = (el: HTMLElement) => el.style.getPropertyValue("--i");

    it("entra animado: leva a classe da volta e a cascata (itens do workspace primeiro, depois a entrada 'Backoffice')", () => {
      const { rerender } = render(<Swap to="admin" />);
      rerender(<Swap to="app" />);
      expect(aside()).toHaveClass("adm-returning");
      expect(aside()).not.toHaveClass("adm-side");
      expect(within(nav()).getAllByRole("heading", { level: 6 }).map(position)).toEqual(["5"]);
      expect(within(nav()).getAllByRole("button").map(position)).toEqual(["0", "1", "2", "3", "4", "6"]);
    });

    it("anima a cada volta, não só na primeira", () => {
      const { rerender } = render(<Swap to="admin" />);
      rerender(<Swap to="app" />);
      rerender(<Swap to="admin" />);
      rerender(<Swap to="app" />);
      expect(aside()).toHaveClass("adm-returning");
    });

    it("se o Admin saiu por outro caminho (ex.: sair da conta), o app aberto depois não anima", () => {
      render(<Sidebar scope="platform" />).unmount();
      render(<Sidebar />);
      expect(aside()).not.toHaveClass("adm-returning");
    });
  });
});

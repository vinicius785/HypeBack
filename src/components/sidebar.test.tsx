/**
 * Menu lateral dos dois ambientes: a configuração de cada um (`nav-config.ts`), os grupos com título, o que cada
 * perfil enxerga e o que muda no escopo `platform` (layout do Admin): o seletor de workspace não existe (não há
 * como regravar o `workspaceId`), os itens do workspace saem e entra o "Voltar ao app".
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
  permissions: { campaigns_read: true, catalog_read: true, community_lives_read: true, financial_read: true } as Record<string, boolean>,
  accountType: "brand" as string,
  role: "owner" as string,
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
    useWorkspaceContext: () => ({ workspaces: [ws, { id: "w2", name: "Beta", role: "member", photo: null }], selectedWorkspace: { ...ws, role: ctx.role, account_type: ctx.accountType }, selectWorkspace: ctx.selectWorkspace }),
    useWorkspacePermissions: () => ctx.permissions,
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

import { PLATFORM_NAV, WORKSPACE_NAV } from "@/components/navigation/nav-config";

import { LEAVE_MS, Sidebar } from "./sidebar";

beforeEach(() => {
  ctx.pathname = "/";
  ctx.navigate.mockReset();
  ctx.selectWorkspace.mockReset();
  ctx.useCampaigns.mockReset();
  ctx.user = { name: "Vini", email: "vini@hype.com", is_platform_admin: true };
  ctx.campaigns = [];
  ctx.edges = { before: false, after: false };
  ctx.permissions = { campaigns_read: true, catalog_read: true, community_lives_read: true, financial_read: true };
  ctx.accountType = "brand";
  ctx.role = "owner";
});

afterEach(() => {
  vi.useRealTimers();
  // O jsdom não tem `matchMedia`; os testes de movimento reduzido o definem e aqui ele sai de novo.
  Reflect.deleteProperty(window, "matchMedia");
});

const nav = () => screen.getByRole("navigation");
const aside = () => document.querySelector("aside") as HTMLElement;

describe("PLATFORM_NAV (Admin da plataforma)", () => {
  it("quatro grupos, na ordem pedida, com os destinos de cada página", () => {
    expect(PLATFORM_NAV.map((g) => [g.label, g.items.map((i) => [i.label, i.href])])).toEqual([
      ["Visão geral", [["Dashboard", "/admin/dashboard"]]],
      [
        "Gestão da plataforma",
        [
          ["Pessoas", "/admin/users"],
          ["Campanhas", "/admin/campaigns"],
          ["Financeiro", "/admin/financial"],
          ["Comunidade", "/admin/groups"],
        ],
      ],
      [
        "Operação",
        [
          ["Atendimento", "/admin/support"],
          ["Notificações", "/admin/notifications"],
          ["Monitoramento", "/admin/activity"],
        ],
      ],
      ["Administração", [["Equipe", "/admin/team"]]],
    ]);
  });

  it("todos os ícones são diferentes: Comunidade não reusa o de Pessoas", () => {
    const icons = PLATFORM_NAV.flatMap((g) => g.items.map((i) => i.icon));
    expect(new Set(icons).size).toBe(icons.length);
    const iconOf = (label: string) => PLATFORM_NAV.flatMap((g) => g.items).find((i) => i.label === label)?.icon;
    expect(iconOf("Comunidade")).not.toBe(iconOf("Pessoas"));
  });
});

describe("WORKSPACE_NAV (clientes)", () => {
  it("quatro grupos simples; o Backoffice é a única porta para o Admin e só aparece para a equipe Hype", () => {
    expect(WORKSPACE_NAV.map((g) => [g.label, g.items.map((i) => [i.label, i.href])])).toEqual([
      ["Workspace", [["Início", "/"]]],
      [
        "Gestão de campanhas",
        [
          ["Marcas", "/brands"],
          ["Projetos", "/projects"],
          ["Campanhas", "/campaigns"],
          ["Criadores", "/creators"],
          ["Lives", "/lives"],
        ],
      ],
      ["Financeiro", [["Financeiro", "/financial"]]],
      ["Administração", [["Backoffice", "/admin/dashboard"]]],
    ]);
    const backoffice = WORKSPACE_NAV.flatMap((g) => g.items).find((i) => i.label === "Backoffice");
    expect(backoffice?.platformStaffOnly).toBe(true);
    // Marcas só existe para agência: nos demais workspaces o item nem aparece.
    expect(WORKSPACE_NAV.flatMap((g) => g.items).find((i) => i.label === "Marcas")?.agencyOnly).toBe(true);
    // Projetos também é só de agência e segue a permissão de leitura de campanhas.
    const projects = WORKSPACE_NAV.flatMap((g) => g.items).find((i) => i.label === "Projetos");
    expect(projects?.agencyOnly).toBe(true);
    expect(projects?.permission).toBe("campaigns_read");
    // O Elenco virou um recorte de Criadores: não há mais item próprio no menu.
    expect(WORKSPACE_NAV.flatMap((g) => g.items).find((i) => i.label === "Elenco")).toBeUndefined();
  });

  it("cada permissão de leitura continua no mesmo item de antes", () => {
    const perm = (label: string) => WORKSPACE_NAV.flatMap((g) => g.items).find((i) => i.label === label)?.permission;
    expect(perm("Campanhas")).toBe("campaigns_read");
    expect(perm("Criadores")).toBe("catalog_read");
    expect(perm("Lives")).toBe("community_lives_read");
    expect(perm("Financeiro")).toBe("financial_read");
    expect(perm("Início")).toBeUndefined();
  });
});

describe("as duas configurações", () => {
  const all = [...WORKSPACE_NAV, ...PLATFORM_NAV].flatMap((g) => g.items);

  it("todos os ícones existem no mapa do protótipo (`I`)", async () => {
    const src = (await import("@/components/prototype/ui?raw")).default as string;
    for (const { icon } of all) expect(src).toMatch(new RegExp(`\\b${icon}: "`));
  });

  it("todo destino é uma rota que existe na árvore de rotas", async () => {
    const tree = (await import("@/routeTree.gen?raw")).default as string;
    for (const { href } of all) {
      // `/` é a rota do Início; as demais aparecem como chave do mapa de rotas por caminho.
      expect(tree).toContain(href === "/" ? "'/': typeof" : `'${href}': typeof`);
    }
  });

  it("nenhum destino se repete dentro de um mesmo ambiente", () => {
    for (const nav of [WORKSPACE_NAV, PLATFORM_NAV]) {
      const hrefs = nav.flatMap((g) => g.items.map((i) => i.href));
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });
});

describe("Sidebar (escopo do workspace, como no app)", () => {
  it("mostra o seletor de workspace e os itens do cliente em grupos com título", () => {
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: /Acme/ })).toHaveAttribute("aria-haspopup", "listbox");
    const items = within(nav());
    for (const label of ["Início", "Campanhas", "Criadores", "Lives", "Financeiro"]) {
      expect(items.getByRole("button", { name: label })).toBeInTheDocument();
    }
    for (const group of ["Workspace", "Gestão de campanhas", "Financeiro"]) {
      expect(items.getByRole("group", { name: group })).toBeInTheDocument();
    }
    expect(within(items.getByRole("group", { name: "Gestão de campanhas" })).getAllByRole("button")).toHaveLength(3);
    expect(items.queryByRole("button", { name: "Marcas" })).not.toBeInTheDocument();
    expect(items.queryByRole("button", { name: "Projetos" })).not.toBeInTheDocument();
    expect(items.queryByRole("button", { name: "Elenco" })).not.toBeInTheDocument();
  });

  it("workspace de agência ganha os itens Marcas e Projetos, junto das campanhas (o elenco vive dentro de Criadores)", () => {
    ctx.accountType = "agency";
    render(<Sidebar />);
    const group = within(within(nav()).getByRole("group", { name: "Gestão de campanhas" }));
    expect(group.getByRole("button", { name: "Marcas" })).toBeInTheDocument();
    expect(group.getByRole("button", { name: "Projetos" })).toBeInTheDocument();
    expect(group.queryByRole("button", { name: "Elenco" })).not.toBeInTheDocument();
    expect(group.getAllByRole("button")).toHaveLength(5);
  });

  it("sem permissão de campanhas, agência também não vê Marcas nem Projetos", () => {
    ctx.accountType = "agency";
    ctx.permissions = { ...ctx.permissions, campaigns_read: false };
    render(<Sidebar />);
    expect(within(nav()).queryByRole("button", { name: "Marcas" })).not.toBeInTheDocument();
    expect(within(nav()).queryByRole("button", { name: "Projetos" })).not.toBeInTheDocument();
  });

  it("Cliente da agência vê só Início e Campanhas: nada de Marcas, Projetos, Criadores, Lives nem Financeiro", () => {
    ctx.accountType = "agency";
    ctx.role = "cliente";
    // O papel cliente só tem leitura de campanhas (o servidor não dá catálogo, lives nem financeiro).
    ctx.permissions = { campaigns_read: true, catalog_read: false, community_lives_read: false, financial_read: false };
    ctx.user = { name: "Cliente", email: "c@marca.com" };
    render(<Sidebar />);
    const items = within(nav());
    expect(items.getByRole("button", { name: "Início" })).toBeInTheDocument();
    expect(items.getByRole("button", { name: /Campanhas/ })).toBeInTheDocument();
    for (const hidden of ["Marcas", "Projetos", "Criadores", "Lives", "Financeiro", "Backoffice"]) {
      expect(items.queryByRole("button", { name: hidden })).not.toBeInTheDocument();
    }
  });

  it("Cliente não vê Criadores nem se a permissão de catálogo vier ligada (o papel manda, não só a permissão)", () => {
    ctx.accountType = "agency";
    ctx.role = "cliente";
    ctx.permissions = { campaigns_read: true, catalog_read: true, community_lives_read: false, financial_read: false };
    ctx.user = { name: "Cliente", email: "c@marca.com" };
    render(<Sidebar />);
    expect(within(nav()).queryByRole("button", { name: "Criadores" })).not.toBeInTheDocument();
  });

  it("a equipe Hype vê só o Backoffice (uma porta), não a estrutura inteira do Admin", async () => {
    render(<Sidebar />);
    const items = within(nav());
    const group = items.getByRole("group", { name: "Administração" });
    expect(within(group).getAllByRole("button")).toHaveLength(1);
    for (const label of ["Workspaces", "Usuários", "Saúde da plataforma", "Atividades", "Comunidade"]) {
      expect(items.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
    await userEvent.click(within(group).getByRole("button", { name: "Backoffice" }));
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/admin/dashboard" });
  });

  it.each(["support", "viewer"])("a equipe com papel '%s' também vê o Backoffice (a API valida o papel em cada rota)", (role) => {
    ctx.user = { name: "Equipe", email: "e@hype.com", platform_role: role };
    render(<Sidebar />);
    expect(within(nav()).getByRole("button", { name: "Backoffice" })).toBeInTheDocument();
  });

  it("quem não é admin da plataforma não vê o Backoffice, nem o título do grupo", () => {
    ctx.user = { name: "Cliente", email: "cliente@marca.com" };
    render(<Sidebar />);
    expect(screen.queryByRole("group", { name: "Administração" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Backoffice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pessoas" })).not.toBeInTheDocument();
  });

  it("sem a permissão, o item some e o grupo que ficou vazio não deixa título solto", () => {
    ctx.permissions = { campaigns_read: true, catalog_read: false, community_lives_read: false, financial_read: false };
    render(<Sidebar />);
    const items = within(nav());
    expect(items.queryByRole("button", { name: "Financeiro" })).not.toBeInTheDocument();
    expect(items.queryByRole("group", { name: "Financeiro" })).not.toBeInTheDocument();
    expect(items.queryByRole("button", { name: "Criadores" })).not.toBeInTheDocument();
    expect(items.queryByRole("button", { name: "Lives" })).not.toBeInTheDocument();
    expect(within(items.getByRole("group", { name: "Gestão de campanhas" })).getAllByRole("button")).toHaveLength(1);
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

  it("não mostra os itens do workspace (Início, Lives…), só o Admin em quatro grupos", () => {
    render(<Sidebar scope="platform" />);
    const items = within(screen.getByRole("navigation", { name: "Navegação do Admin" }));
    for (const label of ["Início", "Lives", "Backoffice"]) expect(items.queryByRole("button", { name: label })).not.toBeInTheDocument();
    expect(items.getAllByRole("button")).toHaveLength(9);
    for (const group of ["Visão geral", "Gestão da plataforma", "Operação", "Administração"]) {
      expect(items.getByRole("group", { name: group })).toBeInTheDocument();
    }
  });

  it("'Voltar ao app' fica numa faixa própria, separada do perfil", () => {
    render(<Sidebar scope="platform" />);
    const exit = screen.getByRole("button", { name: "Voltar ao app" });
    expect(exit).toHaveClass("sb-exit");
    expect(exit.parentElement).toHaveClass("sb-foot");
    expect(exit.parentElement?.querySelector("hr.sb-sep")).not.toBeNull();
  });

  it("não busca as campanhas do workspace (o contador não existe no Admin)", () => {
    render(<Sidebar scope="platform" />);
    expect(ctx.useCampaigns).toHaveBeenCalledWith({ enabled: false });
  });

  it("o perfil mostra \"Administrador\" (curto, numa linha só; o bloco de cima já diz que é a plataforma), não o papel num workspace", () => {
    render(<Sidebar scope="platform" />);
    expect(screen.getByText("Administrador", { selector: ".me small" })).toBeInTheDocument();
    expect(screen.queryByText("Proprietário")).not.toBeInTheDocument();
  });

  it("cada botão tem nome acessível e a dica do trilho (no trilho o texto some)", async () => {
    render(<Sidebar scope="platform" />);
    const button = within(nav()).getByRole("button", { name: "Pessoas" });
    expect(button).toHaveAttribute("data-tip", "Pessoas");
    expect(button).toHaveAccessibleName("Pessoas");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.hover(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Pessoas");
    await userEvent.unhover(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("a dica também abre com o foco do teclado e fecha com Esc", async () => {
    render(<Sidebar scope="platform" />);
    await userEvent.tab();
    const focused = document.activeElement as HTMLElement;
    expect(focused.dataset.tip).toBeTruthy();
    expect(screen.getByRole("tooltip")).toHaveTextContent(focused.dataset.tip as string);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("clicar leva para a rota da página", async () => {
    render(<Sidebar scope="platform" />);
    await userEvent.click(within(nav()).getByRole("button", { name: "Pessoas" }));
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/admin/users" });
    await userEvent.click(within(nav()).getByRole("button", { name: "Comunidade" }));
    expect(ctx.navigate).toHaveBeenLastCalledWith({ to: "/admin/groups" });
  });

  it("rota filha de uma tela do grupo acende a entrada do grupo (e só ela)", () => {
    ctx.pathname = "/admin/workspaces/3f2a9c1e-0000-4000-8000-000000000000";
    render(<Sidebar scope="platform" />);
    const items = within(nav());
    const active = items.getAllByRole("button").filter((b) => b.getAttribute("aria-current") === "page");
    expect(active.map((b) => b.getAttribute("aria-label"))).toEqual(["Pessoas"]);
    expect(items.getByRole("button", { name: "Pessoas" })).toHaveClass("on");
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

describe("Sidebar (rodapé: perfil e sair, nos dois ambientes)", () => {
  it.each(["workspace", "platform"] as const)("no escopo %s o perfil é um botão que leva às configurações e o Sair está ao lado", async (scope) => {
    render(<Sidebar scope={scope} />);
    await userEvent.click(screen.getByRole("button", { name: "Meu perfil" }));
    expect(ctx.navigate).toHaveBeenCalledWith({ to: "/settings" });
    expect(screen.getByRole("button", { name: "Sair da conta" })).toBeInTheDocument();
  });

  it.each([
    ["admin", "Administrador"],
    ["support", "Suporte"],
    ["viewer", "Somente leitura"],
  ])("no Admin o perfil mostra o papel na equipe: %s é \"%s\"", (role, label) => {
    ctx.user = { name: "Equipe", email: "e@hype.com", platform_role: role, is_platform_admin: role === "admin" };
    render(<Sidebar scope="platform" />);
    expect(screen.getByText(label, { selector: ".me small" })).toBeInTheDocument();
  });

  it("clicar em Sair não abre o perfil", async () => {
    render(<Sidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Sair da conta" }));
    expect(ctx.navigate).not.toHaveBeenCalledWith({ to: "/settings" });
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
    expect(nav()).toHaveClass("sb-nav");
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
    // 12 itens + 4 títulos de grupo + o "Voltar ao app"
    expect(aside().style.getPropertyValue("--n")).toBe("13");
    expect(back().style.getPropertyValue("--i")).toBe("13");
  });

  it("enquanto o menu sai, outros cliques não navegam e um segundo clique não agenda outra volta", () => {
    vi.useFakeTimers();
    render(<Sidebar scope="platform" />);
    fireEvent.click(back());
    fireEvent.click(within(nav()).getByRole("button", { name: "Pessoas" }));
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
    fireEvent.click(within(nav()).getByRole("button", { name: "Pessoas" }));
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

    it("entra animado: leva a classe da volta e a cascata (títulos e itens na ordem do menu, a entrada 'Backoffice' por último)", () => {
      const { rerender } = render(<Swap to="admin" />);
      rerender(<Swap to="app" />);
      expect(aside()).toHaveClass("adm-returning");
      expect(aside()).not.toHaveClass("adm-side");
      expect(within(nav()).getAllByRole("heading", { level: 6 }).map(position)).toEqual(["0", "2", "6", "8"]);
      expect(within(nav()).getAllByRole("button").map(position)).toEqual(["1", "3", "4", "5", "7", "9"]);
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

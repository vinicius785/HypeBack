import type React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/shared/services/agency-projects";

const h = vi.hoisted(() => {
  const store = { search: {} as Record<string, unknown>, listeners: new Set<() => void>() };
  return {
    store,
    pathname: "/projects",
    isAgency: true,
    role: "owner",
    can: { campaigns_read: true, campaigns_create: true, campaigns_write: true, campaigns_delete: true },
    loading: false,
    error: null as unknown,
    projects: [] as unknown[],
    refetch: vi.fn(),
    navigate: vi.fn(),
    setStatus: vi.fn(),
    duplicate: vi.fn(),
    deleteAsync: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
  };
});

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@tanstack/react-router", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    // A rota devolve `useSearch`/`useNavigate` como a real; a "URL" é um store que o `navigate` atualiza.
    createFileRoute: () => (opts: Record<string, unknown>) => ({
      ...opts,
      useSearch: () =>
        useSyncExternalStore(
          (cb) => {
            h.store.listeners.add(cb);
            return () => h.store.listeners.delete(cb);
          },
          () => h.store.search,
        ),
      useNavigate: () => h.navigate,
    }),
    useLocation: () => ({ pathname: h.pathname }),
    Outlet: () => <div>filha da rota</div>,
    Link: ({ children, to, params, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; params?: { projectId?: string } }) => (
      <a href="#" data-to={to} data-project={params?.projectId} {...rest}>
        {children}
      </a>
    ),
  };
});
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspacePermissions: () => h.can,
  useWorkspaceContext: () => ({ selectedWorkspace: { role: h.role } }),
}));
vi.mock("@/hooks/use-agency-brands", () => ({ useIsAgencyWorkspace: () => h.isAgency }));
vi.mock("@/hooks/use-agency-projects", () => ({
  useAgencyProjects: () => ({
    data: h.loading ? undefined : h.projects,
    isLoading: h.loading,
    error: h.error,
    refetch: h.refetch,
    isFetching: false,
  }),
  useSetAgencyProjectStatus: () => ({ mutate: h.setStatus, isPending: false }),
  useDuplicateAgencyProject: () => ({ mutate: h.duplicate, isPending: false }),
  useDeleteAgencyProject: () => ({ mutateAsync: h.deleteAsync, isPending: false }),
}));
vi.mock("@/components/agency-projects/project-form", () => ({
  ProjectForm: ({ project, onClose }: { project?: { name: string }; onClose: () => void }) => (
    <div role="dialog" aria-label="Formulário de projeto">
      {project ? `Editar ${project.name}` : "Novo projeto"}
      <button type="button" onClick={onClose}>
        fechar formulário
      </button>
    </div>
  ),
}));

import { Route } from "./projects";
import { AgencyProjectsUnavailableError } from "@/shared/services/agency-projects";

const Page = (Route as unknown as { component: () => React.JSX.Element }).component;

const person = (id: number, name: string) => ({ user_id: id, name, avatar: null });

const mk = (id: string, name: string, over: Omit<Partial<Project>, "stats"> & { stats?: Partial<Project["stats"]> } = {}): Project => {
  const { stats, ...rest } = over;
  return {
    id,
    name,
    description: null,
    cover_url: null,
    status: "ativo",
    created_at: "2026-11-01T12:00:00Z",
    updated_at: "2026-11-01T12:00:00Z",
    stats: {
      tasks_total: 8,
      tasks_done: 3,
      tasks_open: 5,
      tasks_overdue: 0,
      tasks_blocked: 0,
      progress: 0.375,
      deadline: "2026-12-03",
      next_due: "2026-11-20",
      last_activity_at: "2026-11-04T12:00:00Z",
      ...stats,
    },
    health: "saudavel",
    responsible: null,
    participants: [],
    ...rest,
  };
};

const cardOf = (name: string) => screen.getByText(name).closest("article") as HTMLElement;
const names = () => Array.from(document.querySelectorAll("article.apj-card")).map((a) => a.querySelector("b")?.textContent);
const openMenu = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(within(cardOf(name)).getByRole("button", { name: `Mais ações para ${name}` }));
const strip = () => within(screen.getByRole("group", { name: "Resumo de projetos" }));

const navigateTo = (arg: { search?: Record<string, unknown> }) => {
  h.store.search = { ...(arg.search ?? {}) };
  h.store.listeners.forEach((l) => l());
};

beforeEach(() => {
  vi.clearAllMocks();
  h.pathname = "/projects";
  h.isAgency = true;
  h.role = "owner";
  h.can = { campaigns_read: true, campaigns_create: true, campaigns_write: true, campaigns_delete: true };
  h.loading = false;
  h.error = null;
  h.store.search = {};
  h.navigate.mockImplementation(navigateTo);
  h.projects = [
    mk("p1", "Lançamento Verão", {
      description: "Coleção nova",
      responsible: person(7, "Ana Souza"),
      participants: [person(8, "Bruno"), person(9, "Carla")],
      stats: { tasks_overdue: 2, last_activity_at: "2026-11-04T12:00:00Z" },
      health: "atencao",
    }),
    mk("p2", "Black Friday", {
      responsible: person(8, "Bruno"),
      health: "em_risco",
      stats: { tasks_overdue: 3, last_activity_at: "2026-11-03T12:00:00Z" },
    }),
    mk("p3", "Rebranding", { status: "pausado", health: null, stats: { tasks_total: 0, tasks_done: 0, tasks_open: 0, progress: 0, deadline: null, last_activity_at: "2026-11-02T12:00:00Z" } }),
    mk("p4", "Campanha 2025", { status: "concluido", health: null, stats: { last_activity_at: "2026-10-01T12:00:00Z" } }),
    mk("p5", "Antigo", { status: "arquivado", health: null, stats: { last_activity_at: "2026-09-01T12:00:00Z" } }),
  ];
});

describe("rota", () => {
  it("rota filha (/projects/:id) vai para o Outlet e não desenha a lista", () => {
    h.pathname = "/projects/p1";
    render(<Page />);
    expect(screen.getByText("filha da rota")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Projetos" })).not.toBeInTheDocument();
  });

  it("barra final na URL ainda é a lista", () => {
    h.pathname = "/projects/";
    render(<Page />);
    expect(screen.getByRole("heading", { name: "Projetos" })).toBeInTheDocument();
  });
});

describe("bloqueios", () => {
  it("Cliente da agência tem campaigns_read, mas Projetos é interno: vê o aviso de sem acesso e nenhum projeto", () => {
    h.role = "cliente";
    h.projects = [mk("p1", "Lançamento Verão")];
    render(<Page />);
    expect(screen.getByText("Você não tem acesso a Projetos")).toBeInTheDocument();
    expect(screen.queryByText("Lançamento Verão")).not.toBeInTheDocument();
  });

  it("fora de agência explica que é exclusivo e não lista nada", () => {
    h.isAgency = false;
    render(<Page />);
    expect(screen.getByText("Projetos são exclusivos de agências")).toBeInTheDocument();
    expect(screen.queryByText("Lançamento Verão")).not.toBeInTheDocument();
  });

  it("sem permissão de leitura de campanhas não mostra projetos", () => {
    h.can = { ...h.can, campaigns_read: false };
    render(<Page />);
    expect(screen.getByText("Você não tem acesso a Projetos")).toBeInTheDocument();
    expect(screen.queryByText("Lançamento Verão")).not.toBeInTheDocument();
  });
});

describe("lista", () => {
  it("cabeçalho, indicadores e só os projetos em andamento (encerrados ficam recolhidos)", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { name: "Projetos" })).toBeInTheDocument();
    expect(screen.getByText("Organize tarefas e entregas do time.")).toBeInTheDocument();
    const value = (label: string) => within(strip().getByText(label).closest(".stat") as HTMLElement).getByText(/^\d+$/).textContent;
    expect(value("Projetos ativos")).toBe("2");
    expect(value("Em risco")).toBe("1");
    expect(value("Tarefas atrasadas")).toBe("5");
    expect(names()).toEqual(["Lançamento Verão", "Black Friday", "Rebranding"]);
    expect(screen.queryByText("Campanha 2025")).not.toBeInTheDocument();
  });

  it("o cartão mostra responsável com +N, selos, entrega e resumo das tarefas", () => {
    render(<Page />);
    const verao = within(cardOf("Lançamento Verão"));
    expect(verao.getByText("Ana Souza")).toBeInTheDocument();
    expect(verao.getByText("+2")).toHaveAttribute("title", "Bruno, Carla");
    expect(verao.getByText("Ativo")).toBeInTheDocument();
    expect(verao.getByText("Atenção")).toBeInTheDocument();
    expect(verao.getByText("Entrega 03/12")).toBeInTheDocument();
    expect(verao.getByText(/3 de 8 concluídas/)).toBeInTheDocument();
    expect(verao.getByText("2 atrasadas")).toBeInTheDocument();
    expect(verao.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "38");
    expect(verao.getByRole("link", { name: /Abrir projeto Lançamento Verão/ })).toHaveAttribute("data-project", "p1");

    const friday = within(cardOf("Black Friday"));
    expect(friday.getByText("Em risco")).toBeInTheDocument();
    expect(friday.queryByText(/^\+\d/)).not.toBeInTheDocument();

    const rebranding = within(cardOf("Rebranding"));
    expect(rebranding.getByText("Sem responsável")).toBeInTheDocument();
    expect(rebranding.getByText("Pausado")).toBeInTheDocument();
    expect(rebranding.getByText("Sem entrega definida")).toBeInTheDocument();
    expect(rebranding.getByText("Nenhuma tarefa cadastrada")).toBeInTheDocument();
    // Saudável (ou sem saúde) não ganha selo de saúde.
    expect(rebranding.queryByText("Saudável")).not.toBeInTheDocument();
    expect(rebranding.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("'1 atrasada' no singular e nada de atrasadas quando não há", () => {
    h.projects = [mk("a", "Um", { stats: { tasks_overdue: 1 } }), mk("b", "Dois")];
    render(<Page />);
    expect(within(cardOf("Um")).getByText("1 atrasada")).toBeInTheDocument();
    expect(within(cardOf("Dois")).queryByText(/atrasada/)).not.toBeInTheDocument();
  });

  it("ordenação padrão é por atualização recente", () => {
    render(<Page />);
    expect(names()).toEqual(["Lançamento Verão", "Black Friday", "Rebranding"]);
  });

  it("carregando: esqueleto no lugar dos cartões, sem indicadores", () => {
    h.loading = true;
    render(<Page />);
    expect(screen.getByLabelText("Carregando projetos")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("group", { name: "Resumo de projetos" })).not.toBeInTheDocument();
    expect(screen.queryByText("Seu primeiro projeto começa aqui")).not.toBeInTheDocument();
  });

  it("erro: mensagem e 'Tentar de novo'", async () => {
    h.error = new Error("Falha de rede");
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getByText("Erro ao carregar os projetos")).toBeInTheDocument();
    expect(screen.getByText("Falha de rede")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(h.refetch).toHaveBeenCalledTimes(1);
  });

  it("API antiga: 'ainda não está disponível' em vez de erro genérico", () => {
    h.error = new AgencyProjectsUnavailableError();
    render(<Page />);
    expect(screen.getByText("Projetos ainda não está disponível")).toBeInTheDocument();
    expect(screen.queryByText("Erro ao carregar os projetos")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });

  it("sem nenhum projeto: estado vazio com 'Novo projeto' (sem indicadores nem busca)", async () => {
    h.projects = [];
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getByText("Seu primeiro projeto começa aqui")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "O que um projeto reúne" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Resumo de projetos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    const empty = screen.getByText("Seu primeiro projeto começa aqui").closest(".pg-state") as HTMLElement;
    await user.click(within(empty).getByRole("button", { name: "Novo projeto" }));
    expect(screen.getByRole("dialog", { name: "Formulário de projeto" })).toHaveTextContent("Novo projeto");
  });

  it("só encerrados: avisa que não há projeto em andamento e mantém os encerrados à mão", async () => {
    h.projects = [mk("p4", "Campanha 2025", { status: "concluido", health: null })];
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getByText("Nenhum projeto em andamento")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Ver projetos encerrados \(1\)/ }));
    expect(screen.getByText("Campanha 2025")).toBeInTheDocument();
  });
});

describe("visão em lista", () => {
  it("alterna entre cartões e lista com os mesmos projetos e abre o projeto pela linha", async () => {
    h.projects = [mk("p1", "Black Friday"), mk("p2", "Rebranding")];
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getByRole("button", { name: "Ver em cartões" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("list", { name: "Projetos" }).querySelector(".apj-card")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Ver em lista" }));
    const list = screen.getByRole("list", { name: "Projetos" });
    expect(list.querySelectorAll(".apj-row")).toHaveLength(2);
    expect(list.querySelector(".apj-card")).toBeNull();
    expect(within(list).getByText("Black Friday")).toBeInTheDocument();
    expect(within(list).getAllByRole("link", { name: /^Abrir projeto/ })).toHaveLength(2);
  });
});

describe("encerrados", () => {
  it("'Ver projetos encerrados (N)' mostra e oculta, e os cartões ficam neutros", async () => {
    const user = userEvent.setup();
    render(<Page />);
    const toggle = screen.getByRole("button", { name: "Ver projetos encerrados (2)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Ocultar projetos encerrados" })).toHaveAttribute("aria-expanded", "true");
    expect(cardOf("Campanha 2025")).toHaveAttribute("data-closed", "true");
    expect(within(cardOf("Antigo")).getByText("Arquivado")).toBeInTheDocument();
    expect(cardOf("Lançamento Verão")).toHaveAttribute("data-closed", "false");
    await user.click(screen.getByRole("button", { name: "Ocultar projetos encerrados" }));
    expect(screen.queryByText("Campanha 2025")).not.toBeInTheDocument();
  });

  it("com um status escolhido no filtro, tudo aparece junto e não há seção recolhida", () => {
    h.store.search = { status: "arquivado" };
    render(<Page />);
    expect(names()).toEqual(["Antigo"]);
    expect(screen.queryByRole("button", { name: /encerrados/ })).not.toBeInTheDocument();
  });

  it("a busca vale também para os encerrados (o contador acompanha)", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.type(screen.getByRole("searchbox", { name: "Buscar projeto" }), "antigo");
    expect(screen.getByRole("button", { name: "Ver projetos encerrados (1)" })).toBeInTheDocument();
    expect(screen.getByText("Nenhum projeto em andamento")).toBeInTheDocument();
  });
});

describe("busca, filtros e ordenação", () => {
  it("busca por nome, descrição e responsável (inclui participantes); sem resultado, 'Limpar filtros'", async () => {
    const user = userEvent.setup();
    render(<Page />);
    const box = screen.getByRole("searchbox", { name: "Buscar projeto" });
    expect(box).toHaveAttribute("placeholder", "Buscar por projeto, descrição ou responsável");
    await user.type(box, "coleção");
    expect(names()).toEqual(["Lançamento Verão"]);
    await user.clear(box);
    await user.type(box, "carla");
    expect(names()).toEqual(["Lançamento Verão"]);
    await user.clear(box);
    await user.type(box, "bruno");
    expect(names()).toEqual(["Lançamento Verão", "Black Friday"]);
    await user.clear(box);
    await user.type(box, "xyz");
    expect(screen.getByText("Nenhum projeto encontrado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(names()).toEqual(["Lançamento Verão", "Black Friday", "Rebranding"]);
    expect(box).toHaveValue("");
  });

  it("filtros em popover com contador, chips e a URL como fonte (replace)", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    const pop = within(screen.getByRole("dialog", { name: "Filtrar projetos" }));
    await user.click(pop.getByRole("button", { name: "Em risco" }));
    expect(h.navigate).toHaveBeenLastCalledWith({ search: { status: undefined, health: "em_risco", owner: undefined, sort: undefined }, replace: true });
    expect(names()).toEqual(["Black Friday"]);
    // Contador no botão e chip removível.
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent("1");
    const chips = within(screen.getByRole("list", { name: "Filtros aplicados" }));
    expect(chips.getByText("Saúde: Em risco")).toBeInTheDocument();

    await user.click(pop.getByRole("button", { name: "Bruno" }));
    expect(h.navigate).toHaveBeenLastCalledWith({ search: { status: undefined, health: "em_risco", owner: "8", sort: undefined }, replace: true });
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent("2");
    expect(chips.getByText("Responsável: Bruno")).toBeInTheDocument();

    await user.click(chips.getByRole("button", { name: "Remover filtro: Saúde: Em risco" }));
    expect(names()).toEqual(["Lançamento Verão", "Black Friday"]);
    // O clique fora fechou o popover; "Limpar filtros" dos chips zera o que sobrou (a URL volta limpa).
    expect(screen.queryByRole("dialog", { name: "Filtrar projetos" })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole("list", { name: "Filtros aplicados" })).getByRole("button", { name: "Limpar filtros" }));
    expect(h.store.search).toEqual({});
    expect(names()).toEqual(["Lançamento Verão", "Black Friday", "Rebranding"]);
  });

  it("os filtros vêm da URL ao abrir a página", () => {
    h.store.search = { health: "em_risco", sort: "name" };
    render(<Page />);
    expect(names()).toEqual(["Black Friday"]);
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Ordenar: Nome \(A–Z\)/ })).toBeInTheDocument();
  });

  it("o filtro Responsável lista quem aparece nos projetos e filtra por pessoa", async () => {
    h.store.search = { owner: "9" };
    render(<Page />);
    expect(names()).toEqual(["Lançamento Verão"]);
  });

  it("ordenação pelo menu vai para a URL e reordena; 'Limpar filtros' mantém a ordenação", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: /Ordenar: Atualizados recentemente/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "Mais tarefas atrasadas" }));
    expect(h.navigate).toHaveBeenLastCalledWith({ search: { status: undefined, health: undefined, owner: undefined, sort: "overdue" }, replace: true });
    expect(names()).toEqual(["Black Friday", "Lançamento Verão", "Rebranding"]);
    await user.click(screen.getByRole("button", { name: /Ordenar: Mais tarefas atrasadas/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "Nome (A–Z)" }));
    expect(names()).toEqual(["Black Friday", "Lançamento Verão", "Rebranding"]);
  });
});

describe("menu do cartão e permissões", () => {
  it("com todas as permissões: Abrir, Editar, Duplicar, Pausar, Arquivar e Excluir", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await openMenu(user, "Lançamento Verão");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Abrir", "Editar", "Duplicar", "Pausar", "Arquivar", "Excluir"]);
  });

  it("projeto pausado oferece Reativar em vez de Pausar; arquivado não oferece Arquivar", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await openMenu(user, "Rebranding");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Abrir", "Editar", "Duplicar", "Reativar", "Arquivar", "Excluir"]);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /Ver projetos encerrados/ }));
    await openMenu(user, "Antigo");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Abrir", "Editar", "Duplicar", "Reativar", "Excluir"]);
  });

  it("só leitura: só 'Abrir' e sem 'Novo projeto'", async () => {
    h.can = { campaigns_read: true, campaigns_create: false, campaigns_write: false, campaigns_delete: false };
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.queryByRole("button", { name: "Novo projeto" })).not.toBeInTheDocument();
    await openMenu(user, "Lançamento Verão");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Abrir"]);
  });

  it("cada permissão libera a sua ação: criar duplica, editar muda o projeto, excluir só com delete", async () => {
    h.can = { campaigns_read: true, campaigns_create: true, campaigns_write: false, campaigns_delete: false };
    const user = userEvent.setup();
    const { unmount } = render(<Page />);
    await openMenu(user, "Lançamento Verão");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Abrir", "Duplicar"]);
    unmount();

    h.can = { campaigns_read: true, campaigns_create: false, campaigns_write: true, campaigns_delete: false };
    render(<Page />);
    await openMenu(user, "Lançamento Verão");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Abrir", "Editar", "Pausar", "Arquivar"]);
  });

  it("Abrir leva ao detalhe do projeto", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await openMenu(user, "Lançamento Verão");
    await user.click(screen.getByRole("menuitem", { name: "Abrir" }));
    expect(h.navigate).toHaveBeenCalledWith({ to: "/projects/$projectId", params: { projectId: "p1" } });
  });

  it("Pausar e Reativar chamam a API com o novo status e avisam", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await openMenu(user, "Lançamento Verão");
    await user.click(screen.getByRole("menuitem", { name: "Pausar" }));
    expect(h.setStatus).toHaveBeenCalledWith({ projectId: "p1", status: "pausado" }, expect.any(Object));
    h.setStatus.mock.calls[0][1].onSuccess();
    expect(h.toast.success).toHaveBeenCalledWith("“Lançamento Verão” foi pausado");

    await openMenu(user, "Rebranding");
    await user.click(screen.getByRole("menuitem", { name: "Reativar" }));
    expect(h.setStatus).toHaveBeenLastCalledWith({ projectId: "p3", status: "ativo" }, expect.any(Object));
  });

  it("erro ao mudar o status vira toast de erro", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await openMenu(user, "Lançamento Verão");
    await user.click(screen.getByRole("menuitem", { name: "Pausar" }));
    h.setStatus.mock.calls[0][1].onError(new Error("Sem permissão"));
    expect(h.toast.error).toHaveBeenCalledWith("Sem permissão");
  });

  it("Arquivar pede confirmação: só depois de confirmar chama a API", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await openMenu(user, "Lançamento Verão");
    await user.click(screen.getByRole("menuitem", { name: "Arquivar" }));
    const dialog = within(screen.getByRole("dialog", { name: "Arquivar projeto?" }));
    expect(dialog.getByText(/sai das listas ativas, mas nada é apagado/)).toBeInTheDocument();
    expect(h.setStatus).not.toHaveBeenCalled();
    await user.click(dialog.getByRole("button", { name: "Cancelar" }));
    expect(h.setStatus).not.toHaveBeenCalled();

    await openMenu(user, "Lançamento Verão");
    await user.click(screen.getByRole("menuitem", { name: "Arquivar" }));
    await user.click(within(screen.getByRole("dialog", { name: "Arquivar projeto?" })).getByRole("button", { name: "Arquivar" }));
    expect(h.setStatus).toHaveBeenCalledWith({ projectId: "p1", status: "arquivado" }, expect.any(Object));
  });

  it("Excluir explica o que será apagado e só exclui depois de confirmar", async () => {
    h.deleteAsync.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Page />);
    await openMenu(user, "Lançamento Verão");
    await user.click(screen.getByRole("menuitem", { name: "Excluir" }));
    const dialog = within(screen.getByRole("alertdialog", { name: "Excluir projeto?" }));
    expect(dialog.getByText(/As tarefas, os comentários, os anexos e os documentos do projeto serão apagados/)).toBeInTheDocument();
    expect(dialog.getByText(/não pode ser desfeita/)).toBeInTheDocument();
    expect(h.deleteAsync).not.toHaveBeenCalled();
    await user.click(dialog.getByRole("button", { name: "Excluir projeto" }));
    expect(h.deleteAsync).toHaveBeenCalledWith("p1");
    await vi.waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("“Lançamento Verão” foi excluído"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("exclusão recusada mantém o diálogo aberto com o erro (nada de toast de sucesso)", async () => {
    h.deleteAsync.mockRejectedValue(Object.assign(new Error("Sem permissão para excluir"), { status: 403 }));
    const user = userEvent.setup();
    render(<Page />);
    await openMenu(user, "Lançamento Verão");
    await user.click(screen.getByRole("menuitem", { name: "Excluir" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir projeto" }));
    expect(await screen.findByText("Sem permissão para excluir")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(h.toast.success).not.toHaveBeenCalled();
  });

  it("Duplicar chama a API e leva para a cópia", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await openMenu(user, "Lançamento Verão");
    await user.click(screen.getByRole("menuitem", { name: "Duplicar" }));
    expect(h.duplicate).toHaveBeenCalledWith("p1", expect.any(Object));
    h.duplicate.mock.calls[0][1].onSuccess(mk("p9", "Lançamento Verão (cópia)"));
    expect(h.toast.success).toHaveBeenCalledWith("“Lançamento Verão (cópia)” foi criado");
    expect(h.navigate).toHaveBeenCalledWith({ to: "/projects/$projectId", params: { projectId: "p9" } });
  });
});

describe("formulário", () => {
  it("Novo projeto abre o formulário em branco", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getAllByRole("button", { name: "Novo projeto" })[0]);
    expect(screen.getByRole("dialog", { name: "Formulário de projeto" })).toHaveTextContent("Novo projeto");
    await user.click(screen.getByRole("button", { name: "fechar formulário" }));
    expect(screen.queryByRole("dialog", { name: "Formulário de projeto" })).not.toBeInTheDocument();
  });

  it("Editar pelo menu abre o formulário do projeto", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await openMenu(user, "Lançamento Verão");
    await user.click(screen.getByRole("menuitem", { name: "Editar" }));
    expect(screen.getByRole("dialog", { name: "Formulário de projeto" })).toHaveTextContent("Editar Lançamento Verão");
  });
});

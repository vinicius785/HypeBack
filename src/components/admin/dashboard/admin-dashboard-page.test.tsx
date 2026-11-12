import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminGetEnvelope: vi.fn(),
  adminFeed: vi.fn(),
  adminList: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: api.adminGet, adminGetEnvelope: api.adminGetEnvelope, adminFeed: api.adminFeed, adminList: api.adminList };
});

// A URL é um estado de teste: `navigate` aplica a busca funcional e avisa quem lê (`useSearch`), como o roteador.
const router = vi.hoisted(() => {
  let search: Record<string, unknown> = {};
  const listeners = new Set<() => void>();
  return {
    navigate: vi.fn(),
    get search() {
      return search;
    },
    setSearch(next: Record<string, unknown>) {
      search = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  const toHref = (to: string, params?: Record<string, string | number>, search?: Record<string, unknown>) => {
    const path = to.replace(/\$(\w+)/g, (_match, key: string) => encodeURIComponent(String(params?.[key] ?? "")));
    const query = new URLSearchParams(
      Object.entries(search ?? {})
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    ).toString();
    return query ? `${path}?${query}` : path;
  };
  return {
    Link: ({
      to,
      params,
      search,
      children,
      ...rest
    }: {
      to: string;
      params?: Record<string, string | number>;
      search?: Record<string, unknown>;
      children?: React.ReactNode;
    }) => (
      <a href={toHref(to, params, search)} {...rest}>
        {children}
      </a>
    ),
    useNavigate: () => router.navigate,
    useSearch: () => React.useSyncExternalStore(router.subscribe, () => router.search),
  };
});

import { toAdminApiError } from "@/lib/admin/admin-client";
import type { AdminActivityEvent, AdminOverview } from "@/shared/admin-platform.types";

import { AdminDashboardPage } from "./admin-dashboard-page";
import { ALERTS, EVENTS, figure, OVERVIEW } from "./dashboard-fixtures";

// 2026-10-31 12:00 em São Paulo.
const NOW = Date.UTC(2026, 9, 31, 15, 0, 0);

const FEED_META = { next_cursor: null, has_more: false };

interface Source {
  overview?: (params: { from: string; to: string }) => Promise<AdminOverview> | AdminOverview;
  alerts?: () => Promise<{ data: unknown; meta?: unknown }> | { data: unknown; meta?: unknown };
  activity?: () => Promise<{ data: AdminActivityEvent[]; meta: typeof FEED_META }> | { data: AdminActivityEvent[]; meta: typeof FEED_META };
}

const NOW_ISO = new Date(NOW).toISOString();
const page = (data: object[], total = data.length, extra: object = {}) => ({ data, meta: { page: 1, per_page: 1, total, total_pages: total, ...extra } });

/** O que o servidor responde às consultas auxiliares: sessões de hoje, inscrições e os rostos dos carrosséis. */
function serveLists() {
  api.adminList.mockImplementation(async (path: string, params: Record<string, unknown>) => {
    if (path === "/admin/campaigns") {
      return page([{ id: "c1", title: "Festival de Verão", created_at: "2026-10-01T12:00:00.000Z" }], 460, { applications: { today: 5, last_7_days: 21, month_to_date: 55 } });
    }
    if (path === "/admin/workspaces") {
      return page([
        { id: "7a1e0000-0000-4000-8000-000000000001", name: "Café Serra Verde", photo: "uploads/cafe.png", created_at: "2026-10-30T12:00:00.000Z" },
        { id: "7a1e0000-0000-4000-8000-000000000002", name: "Studio Lume", photo: null, created_at: "2026-10-29T12:00:00.000Z" },
      ]);
    }
    if (path === "/admin/users" && params.sort_by === "last_session") {
      return page([
        { id: 1, name: "Ana", last_session_at: NOW_ISO },
        { id: 2, name: "Bia", last_session_at: new Date(NOW - 3600_000).toISOString() },
        { id: 3, name: "Caio", last_session_at: "2026-10-01T12:00:00.000Z" },
      ]);
    }
    if (path === "/admin/users" && params.kind === "creator" && params.status === "active" && params.per_page === 1) {
      return page([{ id: 11, name: "Duda Criadora" }], 3292);
    }
    if (path === "/admin/users" && params.kind === "creator") {
      return page([
        { id: 11, name: "Duda Criadora", photo: "uploads/duda.png", created_at: "2026-10-30T10:00:00.000Z" },
        { id: 12, name: "Edu Criador", photo: null, created_at: "2026-10-29T10:00:00.000Z" },
      ]);
    }
    return page([{ id: 21, name: "Fabi", photo: null, created_at: "2026-10-28T10:00:00.000Z", last_session_at: null }]);
  });
}

/** O que o servidor responde a cada uma das três consultas da tela. */
function serve(source: Source = {}) {
  serveLists();
  api.adminGet.mockImplementation(async (path: string, params: { from: string; to: string }) => {
    if (path !== "/admin/overview") throw new Error(`rota inesperada: ${path}`);
    return source.overview ? source.overview(params) : OVERVIEW;
  });
  api.adminGetEnvelope.mockImplementation(async (path: string) => {
    if (path !== "/admin/health/alerts") throw new Error(`rota inesperada: ${path}`);
    return source.alerts ? source.alerts() : { data: ALERTS, meta: { computed_at: "2026-10-31T15:00:00.000Z" } };
  });
  api.adminFeed.mockImplementation(async (path: string) => {
    if (path !== "/admin/activity") throw new Error(`rota inesperada: ${path}`);
    return source.activity ? source.activity() : { data: EVENTS, meta: FEED_META };
  });
}

const never = () => new Promise<never>(() => {});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminDashboardPage />
    </QueryClientProvider>,
  );
}

const region = (name: string | RegExp) => screen.getByRole("region", { name });
/** "Precisa de atenção · N": o N (total do servidor) vai no título. */
const ATTENTION = /^Precisa de atenção/;

/** O cartão de número pelo rótulo, dentro de um painel. */
function card(panel: HTMLElement, label: string): HTMLElement {
  const labelElement = within(panel)
    .getAllByText(label)
    .find((element) => element.classList.contains("adm-fig-label"));
  if (!labelElement) throw new Error(`cartão "${label}" não encontrado`);
  return labelElement.closest(".adm-fig") as HTMLElement;
}
// O dinheiro sai com espaço sem quebra entre "R$" e o valor: aqui vira espaço comum para comparar.
const valueOf = (element: HTMLElement) => element.querySelector(".adm-fig-value")?.textContent?.replace(/\u00a0/g, " ");
/** O tipo do número (Realizado, Posição atual…) vive só no popover do "i" do rótulo, na linha "Tipo: X" da descrição do botão. */
const kindOf = (element: HTMLElement) => {
  const info = element.querySelector<HTMLButtonElement>(".adm-info");
  const description = info ? document.getElementById(info.getAttribute("aria-describedby") ?? "") : null;
  return description?.querySelector(".adm-fig-kindline")?.textContent?.replace(/^Tipo: /, "");
};

/** O erro que o cliente real devolve para o status (429: "Muitas tentativas…", 403: "Sem permissão"). */
const apiError = (status: number) => toAdminApiError(status, undefined);
const routeMissing = (path: string) => toAdminApiError(404, { message: `Cannot GET /api/backoffice${path}` });

async function loaded() {
  await waitFor(() => expect(valueOf(card(region("Clientes"), "Ativos"))).toBe("27"));
  await screen.findByText("Saques de criadores travados");
  await screen.findByText("Workspace suspenso: Aurora Beauty Studio");
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  api.adminGet.mockReset();
  api.adminGetEnvelope.mockReset();
  api.adminFeed.mockReset();
  api.adminList.mockReset();
  router.navigate.mockReset();
  router.navigate.mockImplementation((options: { search: (prev: Record<string, unknown>) => Record<string, unknown> }) => {
    router.setSearch(options.search(router.search));
  });
  router.setSearch({});
  serve();
});

afterEach(() => {
  vi.mocked(Date.now).mockRestore();
});

describe("cabeçalho", () => {
  it("é o Dashboard, com o subtítulo; uma só linha de apoio junta o período, o fuso e quando os números foram calculados", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Saúde da plataforma em um relance.")).toBeInTheDocument();
    expect(
      await screen.findByText("01/10/2026 – 31/10/2026 · Dias de São Paulo · Atualizado em 31/10/2026 12:00"),
    ).toBeInTheDocument();
    // não há mais "Atualizado em" solto nem nota de período repetida
    expect(screen.getAllByText(/Atualizado em/)).toHaveLength(1);
    expect(screen.getAllByText(/Dias de São Paulo/)).toHaveLength(1);
  });

  it("o 'i' da linha de apoio diz o que segue o período e o que é a posição de agora (e a janela de atividade)", async () => {
    renderPage();
    await loaded();
    // o "i" não explica um cálculo: o nome acessível é só "Como ler o período" (sem o prefixo "Como é calculado")
    const info = screen.getByRole("button", { name: "Como ler o período" });
    expect(within(info.closest(".adm-period-summary") as HTMLElement).queryByRole("button", { name: /Como é calculado/ })).not.toBeInTheDocument();
    expect(info).toHaveAccessibleDescription(/Seguem o período escolhido: .*aportes.*PIX/);
    expect(info).toHaveAccessibleDescription(/posição de agora.*custódia.*cobranças pendentes/);
    expect(info).toHaveAccessibleDescription(/atividade nos últimos 30 dias/);
    // uma frase por parágrafo do kit (blocos seguros dentro do `<div aria-live>` do resumo)
    const paragraphs = info.parentElement!.querySelectorAll(".adm-info-p");
    expect(paragraphs).toHaveLength(3);
    expect(info.closest(".adm-period-summary")).not.toBeNull();
  });

  it("as seções de números têm só o título (sem a descrição longa que repetia a regra do período)", async () => {
    renderPage();
    await loaded();
    for (const name of ["Clientes", "Usuários", "Criadores", "Campanhas"]) {
      const section = region(name);
      expect(section.querySelector(".adm-card-h p")).toBeNull();
    }
  });

  it("não tem botão Atualizar no cabeçalho (o Dashboard não tinha e continua sem)", async () => {
    renderPage();
    await loaded();
    expect(screen.queryByRole("button", { name: /Atualizar/ })).not.toBeInTheDocument();
  });

  it("só consulta as rotas novas do contrato (nada de /admin/dashboard/*)", async () => {
    renderPage();
    await loaded();
    expect(api.adminGet.mock.calls.map((call) => call[0])).toEqual(["/admin/overview"]);
    expect(api.adminGetEnvelope.mock.calls.map((call) => call[0])).toEqual(["/admin/health/alerts"]);
    expect(api.adminFeed.mock.calls.map((call) => call[0])).toEqual(["/admin/activity"]);
  });
});

describe("carregando", () => {
  it("enquanto nada responde: cartões em esqueleto com os mesmos rótulos, sem erro e sem 'Não apurado'", () => {
    api.adminGet.mockImplementation(never);
    api.adminGetEnvelope.mockImplementation(never);
    api.adminFeed.mockImplementation(never);
    api.adminList.mockImplementation(never);
    const { container } = renderPage();

    for (const name of ["Clientes", "Usuários", "Criadores", "Campanhas", ATTENTION, "Atividade recente"]) {
      expect(region(name)).toBeInTheDocument();
    }
    // quatro cartões, dois números cada: todos em esqueleto
    const busy = container.querySelectorAll('.adm-fig[aria-busy="true"]');
    expect(busy).toHaveLength(8);
    expect(screen.queryByText("Não apurado")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Carregando alertas…")).toBeInTheDocument();
    expect(screen.getByText("Carregando atividade…")).toBeInTheDocument();
    // a atividade usa o esqueleto do kit; o "Precisa de atenção", o do cartão preto (mesmo do "Meu trabalho")
    expect(container.querySelector('.adm-lsk[data-variant="timeline"]')).not.toBeNull();
    expect(region(ATTENTION).querySelectorAll(".mw-sk")).toHaveLength(3);
    // as faixas de fotos também esperam (círculos de esqueleto do mesmo tamanho)
    expect(container.querySelectorAll('.adm-dash-car-face[data-skeleton="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("Tudo em ordem")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhuma atividade ainda")).not.toBeInTheDocument();
    // o cartão em esqueleto já é clicável
    expect(within(region("Clientes")).getByRole("link", { name: "Ver Ativos" })).toBeInTheDocument();
  });

  it("cada seção carrega por conta própria: a que já respondeu aparece enquanto as outras esperam", async () => {
    api.adminGetEnvelope.mockImplementation(never);
    api.adminFeed.mockImplementation(never);
    renderPage();
    await waitFor(() => expect(valueOf(card(region("Clientes"), "Ativos"))).toBe("27"));
    expect(screen.getByText("Carregando alertas…")).toBeInTheDocument();
    expect(screen.getByText("Carregando atividade…")).toBeInTheDocument();
  });
});

describe("números", () => {
  it("clientes: total e ativos, valor exato, tipo do número e '+N no período'", async () => {
    renderPage();
    await loaded();
    const clients = region("Clientes");
    expect(valueOf(card(clients, "Clientes"))).toBe("50");
    expect(kindOf(card(clients, "Clientes"))).toBe("Posição atual");
    // o tipo não é selo no corpo do cartão: só no "i"
    expect(clients.querySelector(".adm-kind")).toBeNull();
    expect(card(clients, "Clientes")).toHaveTextContent("+6 no período");
    expect(valueOf(card(clients, "Ativos"))).toBe("27");
    expect(kindOf(card(clients, "Ativos"))).toBe("Calculado");
    expect(card(clients, "Ativos")).toHaveTextContent("com atividade nos últimos 30 dias");
    // só dois números por cartão: os outros (inativos, suspensos…) ficam nas listas
    expect(within(clients).queryByText("Inativos")).not.toBeInTheDocument();
    expect(within(clients).queryByText("Em teste")).not.toBeInTheDocument();
  });

  it("usuários: total e ativos hoje (sessões de hoje, lidas da lista de usuários)", async () => {
    renderPage();
    await loaded();
    const users = region("Usuários");
    expect(valueOf(card(users, "Usuários"))).toBe("36");
    expect(card(users, "Usuários")).toHaveTextContent("+7 no período");
    await waitFor(() => expect(valueOf(card(users, "Ativos hoje"))).toBe("2"));
    expect(kindOf(card(users, "Ativos hoje"))).toBe("Aproximado");
    expect(card(users, "Ativos hoje")).toHaveTextContent("com sessão hoje");
    // a leitura pede as 100 contas ativas com sessão mais recente, ordenadas por sessão
    expect(api.adminList).toHaveBeenCalledWith("/admin/users", expect.objectContaining({ sort_by: "last_session", order: "desc", per_page: 100, status: "active" }), expect.anything());
  });

  it("criadores: total e criados no período", async () => {
    renderPage();
    await loaded();
    const creators = region("Criadores");
    expect(valueOf(card(creators, "Criadores"))).toBe("3.292");
    expect(valueOf(card(creators, "Criados no período"))).toBe("9");
    expect(card(creators, "Criados no período")).toHaveTextContent("contas novas de criador");
  });

  it("campanhas: publicadas e inscrições de hoje (do meta da lista), com 7 dias e o mês no apoio", async () => {
    renderPage();
    await loaded();
    const campaigns = region("Campanhas");
    expect(valueOf(card(campaigns, "Publicadas"))).toBe("39");
    expect(card(campaigns, "Publicadas")).toHaveTextContent(/^.*de 116 campanhas/);
    await waitFor(() => expect(valueOf(card(campaigns, "Inscrições hoje"))).toBe("5"));
    expect(card(campaigns, "Inscrições hoje")).toHaveTextContent("21 em 7 dias · 55 no mês");
    expect(within(campaigns).getByRole("link", { name: "Ver Inscrições hoje" })).toHaveAttribute("href", "/admin/campaigns");
  });

  it("o dinheiro saiu do Dashboard (está em Financeiro)", async () => {
    renderPage();
    await loaded();
    expect(screen.queryByRole("region", { name: "Dinheiro" })).not.toBeInTheDocument();
    expect(screen.queryByText("Saldo em custódia")).not.toBeInTheDocument();
    expect(screen.queryByText("Receita da plataforma")).not.toBeInTheDocument();
  });

  it("cada número leva a definição do servidor, no 'i' ao lado do rótulo", async () => {
    renderPage();
    await loaded();
    const button = within(card(region("Clientes"), "Ativos")).getByRole("button", { name: "Como é calculado: Ativos" });
    expect(button).toHaveAccessibleDescription(/Definição de clientes ativos\./);
    expect(button).toHaveAccessibleDescription(/Calculado a partir de outros números/);
  });

  it("o texto de apoio não tem um segundo 'i': a definição do número citado entra no 'i' do rótulo, com o nome dele", async () => {
    renderPage();
    await loaded();
    const clients = card(region("Clientes"), "Clientes");
    expect(clients.querySelectorAll(".adm-info")).toHaveLength(1);
    expect(within(clients).getByRole("button", { name: "Como é calculado: Clientes" })).toHaveAccessibleDescription(
      /Novos clientes no período: Definição de novos clientes\./,
    );
    expect(screen.queryByRole("button", { name: "Como é calculado: Novos clientes no período" })).not.toBeInTheDocument();
  });

  it("zero que existe no banco aparece como zero (não é 'não apurado')", async () => {
    serve({ overview: () => ({ ...OVERVIEW, workspaces: { ...OVERVIEW.workspaces, active: figure(0, "stock", "x") } }) });
    renderPage();
    await waitFor(() => expect(valueOf(card(region("Clientes"), "Ativos"))).toBe("0"));
    expect(card(region("Clientes"), "Ativos").querySelector(".adm-fig-value")).not.toHaveAttribute("data-unavailable");
  });

  it("os carrosséis de fotos (clientes e criadores) mostram os mais recentes, um laço sem salto e levam ao detalhe", async () => {
    renderPage();
    await loaded();
    await waitFor(() => expect(within(region("Clientes")).getByRole("group", { name: "Clientes mais recentes" })).toBeInTheDocument());
    const clients = within(region("Clientes")).getByRole("group", { name: "Clientes mais recentes" });
    // a lista vem duas vezes na faixa (a segunda volta é só visual e fica escondida do leitor de tela)
    const halves = clients.querySelectorAll(".adm-dash-car-half");
    expect(halves).toHaveLength(2);
    expect(halves[1]).toHaveAttribute("aria-hidden", "true");
    expect(within(halves[0] as HTMLElement).getAllByRole("link").length).toBeGreaterThanOrEqual(2);
    expect(within(clients).getAllByRole("link", { name: "Café Serra Verde" })[0]).toHaveAttribute("href", "/admin/workspaces/7a1e0000-0000-4000-8000-000000000001");
    const creators = within(region("Criadores")).getByRole("group", { name: "Criadores mais recentes" });
    expect(within(creators).getAllByRole("link", { name: "Duda Criadora" })[0]).toHaveAttribute("href", "/admin/users/11");
    // quem tem foto vem antes de quem não tem
    const names = Array.from((halves[0] as HTMLElement).querySelectorAll("[title]")).map((el) => el.getAttribute("title"));
    expect(names.slice(0, 1)).toEqual(["Café Serra Verde"]);
  });
});

describe("cada número leva à lista com o mesmo filtro", () => {
  const TARGETS: ReadonlyArray<[panel: string, label: string, href: string]> = [
    ["Clientes", "Clientes", "/admin/workspaces"],
    ["Clientes", "Ativos", "/admin/workspaces?status=active&activity=active"],
    ["Usuários", "Usuários", "/admin/users"],
    ["Criadores", "Criadores", "/admin/creators?status=active"],
    ["Criadores", "Criados no período", "/admin/creators"],
    ["Campanhas", "Publicadas", "/admin/campaigns?status=published"],
  ];

  it.each(TARGETS)("%s › %s → %s", async (panel, label, href) => {
    renderPage();
    await loaded();
    expect(within(region(panel)).getByRole("link", { name: `Ver ${label}` })).toHaveAttribute("href", href);
  });

  it("'Ativos hoje' não é link (é uma aproximação sem lista equivalente)", async () => {
    renderPage();
    await loaded();
    await waitFor(() => expect(valueOf(card(region("Usuários"), "Ativos hoje"))).toBe("2"));
    expect(within(region("Usuários")).queryByRole("link", { name: "Ver Ativos hoje" })).not.toBeInTheDocument();
    expect(card(region("Usuários"), "Ativos hoje")).not.toHaveAttribute("data-link");
  });
});

describe("Precisa de atenção", () => {
  it("alertas de verdade primeiro (do mais grave ao menos), depois sugestões; no máximo 6, cada um só com gravidade, título e contagem", async () => {
    renderPage();
    await loaded();
    const panel = region(ATTENTION);
    const rows = within(panel).getAllByRole("listitem");
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.querySelector(".mw-tx b")?.textContent)).toEqual([
      "Saques de criadores travados",
      "Transferências PIX que falharam",
      "Cobranças PIX expiradas sem pagamento",
      "Workspaces de marca sem proprietário",
      "Alerta informativo sem destino",
      "Campanhas publicadas sem nenhuma participação",
    ]);
    // a gravidade é o único rótulo da linha (em texto, na cor dela); o tipo (alerta ou sugestão) vai para o detalhe recolhido
    expect(rows.map((row) => row.querySelector(".adm-att-sev")?.textContent)).toEqual(["Crítico", "Crítico", "Atenção", "Atenção", "Informativo", "Atenção"]);
    expect(rows.map((row) => row.getAttribute("data-severity"))).toEqual(["critical", "critical", "warning", "warning", "info", "warning"]);
    const kinds = rows.map((row) => row.querySelector("details")!.textContent);
    expect(kinds.map((text) => /Alerta \(fato registrado no banco\)|Sugestão \(heurística/.exec(text ?? "")?.[0])).toEqual([
      "Alerta (fato registrado no banco)",
      "Alerta (fato registrado no banco)",
      "Alerta (fato registrado no banco)",
      "Alerta (fato registrado no banco)",
      "Alerta (fato registrado no banco)",
      "Sugestão (heurística",
    ]);
    // as duas sugestões que não couberam ficam de fora
    expect(within(panel).queryByText("Clientes sem atividade há mais de 30 dias")).not.toBeInTheDocument();
    expect(within(panel).queryByText("Criadores com cadastro incompleto há mais de 14 dias")).not.toBeInTheDocument();
  });

  it("é o mesmo cartão do 'Meu trabalho' da Início (preto com luz roxa): classes tkcard mw, número grande, lista e rodapé", async () => {
    renderPage();
    await loaded();
    const panel = region(ATTENTION);
    expect(panel).toHaveClass("tkcard", "mw");
    expect(panel.querySelector(".mw-n b")).toHaveTextContent("8");
    expect(panel.querySelector(".mw-l")).not.toBeNull();
    expect(panel.querySelector(".mw-f")).not.toBeNull();
  });

  it("o número grande é o total do servidor (8), com o resumo por gravidade na linha de apoio; 'Mostrando N de M' não existe", async () => {
    renderPage();
    await loaded();
    const panel = region(ATTENTION);
    expect(within(panel).getByRole("heading", { level: 2, name: "Precisa de atenção" })).toBeInTheDocument();
    expect(panel.querySelector(".mw-n")).toHaveTextContent("8itens pedindo atenção");
    expect(panel.querySelector(".sub")?.textContent).toMatch(/crítico/);
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it("a regra exata de cada um fica recolhida em 'Como é calculado' (é o que separa fato registrado de heurística), sem sumir", async () => {
    renderPage();
    await loaded();
    const panel = region(ATTENTION);
    const rows = within(panel).getAllByRole("listitem");
    for (const row of rows) {
      const details = row.querySelector("details")!;
      expect(details).not.toHaveAttribute("open");
      expect(within(details).getByText("Como é calculado", { selector: "summary" })).toBeInTheDocument();
      expect(within(details).getByText("Regra")).toBeInTheDocument();
    }
    expect(
      within(panel).getByText("influencer_withdrawals com status pendente e requested_at anterior a 72 horas atrás."),
    ).toBeInTheDocument();
    expect(within(panel).getByText("Regra de Campanhas publicadas sem nenhuma participação.")).toBeInTheDocument();
    expect(within(panel).getAllByText("Regra")).toHaveLength(6);
    expect(within(panel).getByText("Descrição de Saques de criadores travados.")).toBeInTheDocument();

    // abrir o detalhe não leva a lugar nenhum (o link esticado fica por baixo dele)
    await userEvent.click(within(rows[0]).getByText("Como é calculado"));
    expect(rows[0].querySelector("details")).toHaveAttribute("open");
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("mostra quantas ocorrências, no singular e no plural", async () => {
    renderPage();
    await loaded();
    const rows = within(region(ATTENTION)).getAllByRole("listitem");
    expect(rows[0].querySelector(".mw-c")).toHaveTextContent(/^1\s*ocorrência$/);
    expect(rows[2].querySelector(".mw-c")).toHaveTextContent(/^5\s*ocorrências$/);
  });

  it("cada um leva ao destino que o servidor mandou (rota da tela + filtros); sem destino não é link", async () => {
    renderPage();
    await loaded();
    const panel = region(ATTENTION);
    expect(within(panel).getByRole("link", { name: /^Saques de criadores travados/ })).toHaveAttribute(
      "href",
      "/admin/financial?type=withdrawal",
    );
    expect(within(panel).getByRole("link", { name: /^Transferências PIX que falharam/ })).toHaveAttribute(
      "href",
      "/admin/financial?type=transfer",
    );
    expect(within(panel).getByRole("link", { name: /^Workspaces de marca sem proprietário/ })).toHaveAttribute("href", "/admin/workspaces");
    expect(within(panel).getByRole("link", { name: /^Campanhas publicadas sem nenhuma participação/ })).toHaveAttribute(
      "href",
      "/admin/campaigns?status=published",
    );
    expect(within(panel).queryByRole("link", { name: /^Alerta informativo sem destino/ })).not.toBeInTheDocument();
    expect(within(panel).getByText("Alerta informativo sem destino")).toBeInTheDocument();
  });

  it("'Ver todos' (rodapé do cartão) vai para o Monitoramento", async () => {
    renderPage();
    await loaded();
    expect(within(region(ATTENTION)).getByRole("link", { name: "Ver todos" })).toHaveAttribute("href", "/admin/activity");
  });

  it("com até 6, mostra todos e o número grande conta os mesmos", async () => {
    serve({ alerts: () => ({ data: ALERTS.slice(0, 3), meta: {} }) });
    renderPage();
    await screen.findByText("Cobranças PIX expiradas sem pagamento");
    const panel = region(ATTENTION);
    expect(within(panel).getAllByRole("listitem")).toHaveLength(3);
    expect(panel.querySelector(".mw-n")).toHaveTextContent("3itens pedindo atenção");
  });

  it("sem nenhum: 'Tudo em ordem', com a hora do cálculo, e 'Ver todos' segue disponível", async () => {
    serve({ alerts: () => ({ data: [], meta: { computed_at: "2026-10-31T15:00:00.000Z" } }) });
    renderPage();
    expect(await screen.findByText("Tudo em ordem")).toBeInTheDocument();
    const panel = region(ATTENTION);
    expect(within(panel).getByText(/Nenhum alerta nem sugestão no momento\. Calculado em 31\/10\/2026 12:00\./)).toBeInTheDocument();
    expect(within(panel).queryByRole("listitem")).not.toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Ver todos" })).toHaveAttribute("href", "/admin/activity");
  });

  it("falha: erro da própria seção com 'Tentar de novo' (que consulta de novo), sem derrubar o resto", async () => {
    let calls = 0;
    serve({
      alerts: () => {
        calls += 1;
        if (calls === 1) throw apiError(429);
        return { data: ALERTS, meta: {} };
      },
    });
    renderPage();
    const panel = region(ATTENTION);
    expect(await within(panel).findByRole("alert")).toHaveTextContent("Muitas tentativas em pouco tempo");
    // os números e a atividade seguem normais
    expect(valueOf(card(region("Clientes"), "Ativos"))).toBe("27");
    expect(await screen.findByText("Workspace suspenso: Aurora Beauty Studio")).toBeInTheDocument();
    expect(within(panel).queryByText("Tudo em ordem")).not.toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: "Tentar de novo" }));
    expect(await within(panel).findByText("Saques de criadores travados")).toBeInTheDocument();
    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument();
    expect(api.adminGetEnvelope).toHaveBeenCalledTimes(2);
  });

  it("rota ainda não publicada: 'recurso ainda não disponível', nunca 'tudo em ordem'", async () => {
    serve({
      alerts: () => {
        throw routeMissing("/admin/health/alerts");
      },
    });
    renderPage();
    const panel = region(ATTENTION);
    const alert = await within(panel).findByRole("alert");
    expect(alert).toHaveTextContent("Recurso indisponível");
    expect(alert).toHaveTextContent("Este recurso ainda não está disponível no servidor.");
    expect(within(panel).queryByText("Tudo em ordem")).not.toBeInTheDocument();
  });

  it("resposta fora do contrato (não é uma lista) é erro, não 'tudo em ordem'", async () => {
    serve({ alerts: () => ({ data: { alerts: [] }, meta: {} }) });
    renderPage();
    const alert = await within(region(ATTENTION)).findByRole("alert");
    expect(alert).toHaveTextContent("O servidor respondeu em um formato inesperado.");
    expect(screen.queryByText("Tudo em ordem")).not.toBeInTheDocument();
  });
});

describe("Atividade recente", () => {
  it("diz em uma linha que não é o log completo (o registro inteiro está em 'Ver tudo')", async () => {
    renderPage();
    await loaded();
    expect(within(region("Atividade recente")).getByText(/não é um log completo/)).toBeInTheDocument();
  });

  it("pede os 8 eventos mais recentes e mostra os 5 últimos, na ordem do servidor (o resto está em 'Ver tudo')", async () => {
    renderPage();
    await loaded();
    expect(api.adminFeed).toHaveBeenCalledWith("/admin/activity", { limit: 8 }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const rows = within(region("Atividade recente")).getAllByRole("listitem");
    expect(rows).toHaveLength(5); // o servidor mandou 9
    expect(rows[0]).toHaveTextContent("Workspace suspenso: Aurora Beauty Studio");
    expect(rows[1]).toHaveTextContent("Saque de R$ 200,00 pago a Diana Santana");
    expect(rows[4]).toHaveTextContent("Campanha");
    expect(within(region("Atividade recente")).queryByText(/Padaria Pão Dourado/)).not.toBeInTheDocument();
  });

  it("cada atividade é um cartão (ícone, frase, tipo) e os cartões se sobrepõem na pilha, em cascata", async () => {
    renderPage();
    await loaded();
    const rows = within(region("Atividade recente")).getAllByRole("listitem");
    for (const [index, row] of rows.entries()) {
      expect(row).toHaveClass("adm-dash-deck-card");
      expect(row.style.getPropertyValue("--i")).toBe(String(index));
      expect(row.style.getPropertyValue("--z")).toBe(String(index + 1));
    }
    expect(rows[rows.length - 1]).toHaveAttribute("data-last", "true");
  });

  it("mostra há quanto tempo (instante exato no title) e o tipo do evento", async () => {
    renderPage();
    await loaded();
    const rows = within(region("Atividade recente")).getAllByRole("listitem");
    const time = rows[0].querySelector("time")!;
    expect(time).toHaveTextContent("há 30 minutos");
    expect(time).toHaveAttribute("title", "31/10/2026 11:30");
    expect(time).toHaveAttribute("datetime", "2026-10-31T14:30:00.000Z");
    expect(within(rows[1]).getByText(/Saque pago/)).toBeInTheDocument();
  });

  it("ação do time mostra quem fez e o motivo; fato do sistema não repete quem aparece na frase", async () => {
    renderPage();
    await loaded();
    const rows = within(region("Atividade recente")).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Marina Albuquerque");
    expect(rows[0]).toHaveTextContent("Ação administrativa");
    expect(rows[0]).toHaveTextContent("Motivo: Pagamento em disputa com o financeiro; aguardando retorno do cliente.");
    // as ações do time ganham o ícone escuro (tom da marca), os fatos do sistema não
    expect(rows[0]).toHaveAttribute("data-tone", "brand");
    expect(rows[1]).toHaveAttribute("data-tone", "neutral");
    // saque pago: o criador está na frase e só nela
    expect(within(rows[1]).queryByText("Diana Santana")).not.toBeInTheDocument();
    expect(rows[1]).not.toHaveTextContent("Motivo");
  });

  it("cada evento leva ao que mudou (workspace, campanha, usuário); sem destino é só texto", async () => {
    renderPage();
    await loaded();
    const panel = region("Atividade recente");
    const href = (title: string) => within(panel).getByRole("link", { name: title }).getAttribute("href");
    expect(href("Workspace suspenso: Aurora Beauty Studio")).toBe("/admin/workspaces/7a1e0000-0000-4000-8000-000000000004");
    expect(href("Saque de R$ 200,00 pago a Diana Santana")).toBe("/admin/workspaces/7a1e0000-0000-4000-8000-000000000054");
    expect(href('Bernardo Medeiros Moraes entrou em "Surf Shop Onda Perfeita" como Proprietário')).toBe("/admin/users/9");
    expect(href('Campanha "Festival Café Serra Verde" criada em "Café Serra Verde"')).toBe(
      "/admin/campaigns/ca3b0000-0000-4000-8000-000000000006",
    );
  });

  it("'Ver tudo' vai para a tela de atividade", async () => {
    renderPage();
    await loaded();
    expect(within(region("Atividade recente")).getByRole("link", { name: "Ver tudo" })).toHaveAttribute("href", "/admin/activity");
  });

  it("'Ver tudo' fica no cabeçalho da atividade e a descrição é a linha de apoio do título", async () => {
    renderPage();
    await loaded();
    const header = region("Atividade recente").querySelector(".adm-dash-feed-h")!;
    expect(within(header as HTMLElement).getByRole("link", { name: "Ver tudo" })).toHaveAttribute("href", "/admin/activity");
    expect(header.querySelector("h2 + p")).toHaveTextContent("Ações do time e fatos que o sistema registra; não é um log completo.");
  });

  it("a atividade se adapta à altura do 'Precisa de atenção' (não conta para a altura da linha) e rola por dentro", async () => {
    renderPage();
    await loaded();
    expect(region("Atividade recente")).toHaveClass("adm-dash-feed");
    expect(region("Atividade recente").parentElement).toHaveClass("adm-dash-split");
    expect(region(ATTENTION).parentElement).toBe(region("Atividade recente").parentElement);
  });

  it("sem eventos: estado vazio com o que esperar", async () => {
    serve({ activity: () => ({ data: [], meta: FEED_META }) });
    renderPage();
    expect(await screen.findByText("Nenhuma atividade ainda")).toBeInTheDocument();
    expect(within(region("Atividade recente")).queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("falha: erro da própria seção com 'Tentar de novo'", async () => {
    let calls = 0;
    serve({
      activity: () => {
        calls += 1;
        if (calls === 1) throw apiError(429);
        return { data: EVENTS, meta: FEED_META };
      },
    });
    renderPage();
    const panel = region("Atividade recente");
    expect(await within(panel).findByRole("alert")).toHaveTextContent("Muitas tentativas");
    expect(await screen.findByText("Saques de criadores travados")).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Tentar de novo" }));
    expect(await within(panel).findByText("Workspace suspenso: Aurora Beauty Studio")).toBeInTheDocument();
    expect(api.adminFeed).toHaveBeenCalledTimes(2);
  });

  it("rota ainda não publicada: 'recurso ainda não disponível'", async () => {
    serve({
      activity: () => {
        throw routeMissing("/admin/activity");
      },
    });
    renderPage();
    const alert = await within(region("Atividade recente")).findByRole("alert");
    expect(alert).toHaveTextContent("Recurso indisponível");
    expect(alert).toHaveTextContent("ainda não está disponível no servidor");
  });
});

describe("falhas nos números", () => {
  it("erro: um só estado de erro no lugar dos painéis, com 'Tentar de novo'; as outras seções seguem", async () => {
    let calls = 0;
    serve({
      overview: () => {
        calls += 1;
        if (calls === 1) throw apiError(429);
        return OVERVIEW;
      },
    });
    renderPage();
    const panel = await screen.findByRole("region", { name: "Números da plataforma" });
    expect(within(panel).getByRole("alert")).toHaveTextContent("Muitas tentativas em pouco tempo");
    expect(screen.queryByRole("region", { name: "Clientes" })).not.toBeInTheDocument();
    expect(await screen.findByText("Saques de criadores travados")).toBeInTheDocument();
    expect(await screen.findByText("Workspace suspenso: Aurora Beauty Studio")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(valueOf(card(region("Clientes"), "Ativos"))).toBe("27"));
    expect(screen.queryByRole("region", { name: "Números da plataforma" })).not.toBeInTheDocument();
    expect(api.adminGet).toHaveBeenCalledTimes(2);
  });

  it("rota ainda não publicada: 'recurso ainda não disponível'", async () => {
    serve({
      overview: () => {
        throw routeMissing("/admin/overview");
      },
    });
    renderPage();
    const panel = await screen.findByRole("region", { name: "Números da plataforma" });
    const alert = within(panel).getByRole("alert");
    expect(alert).toHaveTextContent("Recurso indisponível");
    expect(alert).toHaveTextContent("Este recurso ainda não está disponível no servidor.");
    expect(await screen.findByText("Saques de criadores travados")).toBeInTheDocument();
  });

  it("tudo falhando ao mesmo tempo: nunca uma página em branco (cabeçalho, período e três estados de erro)", async () => {
    serve({
      overview: () => {
        throw apiError(403);
      },
      alerts: () => {
        throw apiError(429);
      },
      activity: () => {
        throw routeMissing("/admin/activity");
      },
    });
    renderPage();
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(3));
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Este mês", pressed: true })).toBeInTheDocument();
    // sem permissão não adianta tentar de novo: o botão só aparece onde adianta
    expect(within(region("Números da plataforma")).queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
    expect(within(region(ATTENTION)).getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(within(region("Atividade recente")).getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

describe("período", () => {
  const overviewCalls = () => api.adminGet.mock.calls.map((call) => call[1] as { from: string; to: string });

  it("padrão: este mês, em dias de São Paulo, e a linha de apoio diz isso", async () => {
    renderPage();
    await loaded();
    expect(overviewCalls()).toEqual([{ from: "2026-10-01", to: "2026-10-31" }]);
    expect(screen.getByRole("button", { name: "Este mês", pressed: true })).toBeInTheDocument();
    expect(screen.getByText(/^01\/10\/2026 – 31\/10\/2026 · Dias de São Paulo/)).toBeInTheDocument();
    expect(screen.queryByLabelText("De")).not.toBeInTheDocument();
  });

  it("o seletor tem os quatro períodos, na ordem do produto", () => {
    renderPage();
    const group = screen.getByRole("group", { name: "Período" });
    expect(within(group).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Hoje",
      "Esta semana",
      "Este mês",
      "Personalizado",
    ]);
  });

  it("o dia de hoje é o de São Paulo: às 23h de 31/10 lá (já 01/11 em UTC) o período termina em 31/10", async () => {
    vi.mocked(Date.now).mockReturnValue(Date.UTC(2026, 10, 1, 2, 0, 0));
    renderPage();
    await loaded();
    expect(overviewCalls()[0]).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("à meia-noite de São Paulo o período anda um dia", async () => {
    vi.mocked(Date.now).mockReturnValue(Date.UTC(2026, 10, 1, 3, 0, 0));
    renderPage();
    await loaded();
    expect(overviewCalls()[0]).toEqual({ from: "2026-11-01", to: "2026-11-01" });
  });

  it.each([
    ["Hoje", "today", { from: "2026-10-31", to: "2026-10-31" }, "31/10/2026"],
    ["Esta semana", "week", { from: "2026-10-26", to: "2026-10-31" }, "26/10/2026 – 31/10/2026"],
  ] as const)("trocar para '%s' consulta de novo com o from/to certo e põe o período na URL", async (name, key, range, text) => {
    renderPage();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name }));

    await waitFor(() => expect(overviewCalls().at(-1)).toEqual(range));
    expect(router.search).toEqual({ period: key });
    expect(screen.getByRole("button", { name, pressed: true })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^${text} · Dias de São Paulo`))).toBeInTheDocument();
    const [options] = router.navigate.mock.calls.at(-1)!;
    expect(options).toMatchObject({ to: ".", replace: true, resetScroll: false });
  });

  it("voltar ao padrão tira o período da URL (URL curta) e reaproveita o que já tinha consultado", async () => {
    renderPage();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Hoje" }));
    await waitFor(() => expect(overviewCalls()).toHaveLength(2));
    await userEvent.click(screen.getByRole("button", { name: "Este mês" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Este mês", pressed: true })).toBeInTheDocument());
    expect(router.search).toEqual({});
    expect(overviewCalls()).toHaveLength(2); // o de 30 dias ainda estava fresco no cache
  });

  it("abre já no período que está na URL", async () => {
    router.setSearch({ period: "week" });
    renderPage();
    await loaded();
    expect(overviewCalls()).toEqual([{ from: "2026-10-26", to: "2026-10-31" }]);
    expect(screen.getByRole("button", { name: "Esta semana", pressed: true })).toBeInTheDocument();
  });

  it("URL com período inválido volta ao padrão (a barra de endereço é entrada de usuário)", async () => {
    router.setSearch({ period: "decada", from: "x" });
    renderPage();
    await loaded();
    expect(overviewCalls()).toEqual([{ from: "2026-10-01", to: "2026-10-31" }]);
    expect(screen.getByRole("button", { name: "Este mês", pressed: true })).toBeInTheDocument();
  });

  it("enquanto o período novo carrega, a posição de agora fica na tela e só o que depende do período vira esqueleto", async () => {
    let resolveSeven!: (value: AdminOverview) => void;
    const seven = new Promise<AdminOverview>((resolve) => {
      resolveSeven = resolve;
    });
    serve({ overview: (params) => (params.from === "2026-10-31" ? seven : OVERVIEW) });
    renderPage();
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: "Hoje" }));
    await waitFor(() => expect(card(region("Criadores"), "Criados no período")).toHaveAttribute("aria-busy", "true"));
    // posição de agora: continua com o valor, sem piscar
    expect(valueOf(card(region("Clientes"), "Ativos"))).toBe("27");
    expect(card(region("Clientes"), "Ativos")).not.toHaveAttribute("aria-busy");
    expect(card(region("Campanhas"), "Publicadas")).not.toHaveAttribute("aria-busy");
    expect(card(region("Criadores"), "Criadores")).not.toHaveAttribute("aria-busy");
    // o '+6 no período' é do período anterior: some até chegar o novo
    expect(card(region("Clientes"), "Clientes")).not.toHaveTextContent("no período");

    resolveSeven({
      ...OVERVIEW,
      workspaces: { ...OVERVIEW.workspaces, new_in_period: figure(2, "realized", "Definição de novos clientes.") },
      creators: { ...OVERVIEW.creators, new_in_period: figure(12, "realized", "x") },
    });
    await waitFor(() => expect(valueOf(card(region("Criadores"), "Criados no período"))).toBe("12"));
    expect(card(region("Criadores"), "Criados no período")).not.toHaveAttribute("aria-busy");
    expect(card(region("Clientes"), "Clientes")).toHaveTextContent("+2 no período");
  });

  it("falha no período novo: erro, em vez de números do período anterior como se fossem do novo", async () => {
    serve({
      overview: (params) => {
        if (params.from === "2026-10-31") throw apiError(429);
        return OVERVIEW;
      },
    });
    renderPage();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Hoje" }));
    const panel = await screen.findByRole("region", { name: "Números da plataforma" });
    expect(within(panel).getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Clientes" })).not.toBeInTheDocument();
  });

  describe("personalizado", () => {
    it("'Personalizado' começa pelos dias que a pessoa já via (sem nova consulta) e mostra as duas datas", async () => {
      renderPage();
      await loaded();
      await userEvent.click(screen.getByRole("button", { name: "Personalizado" }));

      expect(screen.getByLabelText("De")).toHaveValue("2026-10-01");
      expect(screen.getByLabelText("Até")).toHaveValue("2026-10-31");
      expect(router.search).toEqual({ period: "custom", from: "2026-10-01", to: "2026-10-31" });
      expect(screen.getByRole("button", { name: "Personalizado", pressed: true })).toBeInTheDocument();
      expect(screen.getByText(/^Dias de São Paulo · até 366 dias/)).toBeInTheDocument();
      expect(overviewCalls()).toHaveLength(1);
    });

    it("as datas não passam de hoje (período futuro não existe)", async () => {
      renderPage();
      await loaded();
      await userEvent.click(screen.getByRole("button", { name: "Personalizado" }));
      expect(screen.getByLabelText("De")).toHaveAttribute("max", "2026-10-31");
      expect(screen.getByLabelText("Até")).toHaveAttribute("max", "2026-10-31");
    });

    it("mexer no início consulta de novo com o from/to novos", async () => {
      renderPage();
      await loaded();
      await userEvent.click(screen.getByRole("button", { name: "Personalizado" }));
      fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-09-01" } });

      await waitFor(() => expect(overviewCalls().at(-1)).toEqual({ from: "2026-09-01", to: "2026-10-31" }));
      expect(router.search).toEqual({ period: "custom", from: "2026-09-01", to: "2026-10-31" });
      expect(screen.getByLabelText("De")).toHaveValue("2026-09-01");
    });

    it("mexer no fim consulta de novo", async () => {
      renderPage();
      await loaded();
      await userEvent.click(screen.getByRole("button", { name: "Personalizado" }));
      fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-10-15" } });
      await waitFor(() => expect(overviewCalls().at(-1)).toEqual({ from: "2026-10-01", to: "2026-10-15" }));
    });

    it("fim antes do início: avisa e mantém o período anterior (não empurra a outra ponta)", async () => {
      router.setSearch({ period: "custom", from: "2026-09-01", to: "2026-10-31" });
      renderPage();
      await loaded();
      const navigations = router.navigate.mock.calls.length;
      fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-08-15" } });
      expect(await screen.findByRole("alert")).toHaveTextContent("A data inicial não pode ser depois da data final.");
      expect(screen.getByLabelText("De")).toHaveValue("2026-09-01");
      expect(router.navigate.mock.calls).toHaveLength(navigations);
      expect(overviewCalls()).toHaveLength(1);
      expect(router.search).toEqual({ period: "custom", from: "2026-09-01", to: "2026-10-31" });
    });

    it("início que estoura os 366 dias do contrato: avisa e mantém o período anterior", async () => {
      router.setSearch({ period: "custom", from: "2026-09-01", to: "2026-10-31" });
      renderPage();
      await loaded();
      fireEvent.change(screen.getByLabelText("De"), { target: { value: "2025-01-01" } });
      expect(await screen.findByRole("alert")).toHaveTextContent("O período pode ter no máximo 366 dias.");
      expect(overviewCalls()).toHaveLength(1);
      expect(router.search).toEqual({ period: "custom", from: "2026-09-01", to: "2026-10-31" });
    });

    it("fim no futuro: avisa (o período nunca passa de hoje) e não consulta de novo", async () => {
      router.setSearch({ period: "custom", from: "2026-10-01", to: "2026-10-31" });
      renderPage();
      await loaded();
      fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-12-31" } });
      expect(await screen.findByRole("alert")).toHaveTextContent("As datas não podem passar de 31/10/2026.");
      expect(overviewCalls()).toHaveLength(1);
      expect(router.search).toEqual({ period: "custom", from: "2026-10-01", to: "2026-10-31" });
    });

    it("campo apagado (digitando): avisa que faltam datas e nada é consultado", async () => {
      router.setSearch({ period: "custom", from: "2026-10-01", to: "2026-10-31" });
      renderPage();
      await loaded();
      const navigations = router.navigate.mock.calls.length;
      fireEvent.change(screen.getByLabelText("De"), { target: { value: "" } });
      expect(await screen.findByRole("alert")).toHaveTextContent("Informe as duas datas.");
      expect(router.navigate.mock.calls).toHaveLength(navigations);
      expect(overviewCalls()).toHaveLength(1);
    });

    it("abre com o personalizado da URL", async () => {
      router.setSearch({ period: "custom", from: "2026-09-01", to: "2026-09-15" });
      renderPage();
      await loaded();
      expect(overviewCalls()).toEqual([{ from: "2026-09-01", to: "2026-09-15" }]);
      expect(screen.getByLabelText("De")).toHaveValue("2026-09-01");
      expect(screen.getByLabelText("Até")).toHaveValue("2026-09-15");
    });

    it("sair do personalizado esconde as datas e tira as chaves da URL", async () => {
      router.setSearch({ period: "custom", from: "2026-09-01", to: "2026-09-15" });
      renderPage();
      await loaded();
      await userEvent.click(screen.getByRole("button", { name: "Hoje" }));
      await waitFor(() => expect(screen.queryByLabelText("De")).not.toBeInTheDocument());
      expect(router.search).toEqual({ period: "today" });
    });
  });

  it("trocar o período não mexe nos alertas nem na atividade (são o 'agora')", async () => {
    renderPage();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Esta semana" }));
    await waitFor(() => expect(overviewCalls()).toHaveLength(2));
    expect(api.adminGetEnvelope).toHaveBeenCalledTimes(1);
    expect(api.adminFeed).toHaveBeenCalledTimes(1);
  });

  it("mantém outras chaves da URL ao mudar o período", async () => {
    router.setSearch({ outra: "coisa" });
    renderPage();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(router.search).toEqual({ outra: "coisa", period: "today" });
  });
});

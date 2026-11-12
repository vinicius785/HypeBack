/**
 * Modelo do Dashboard do Admin: o que cada painel de números mostra, para onde cada número leva e quais alertas
 * entram em "Precisa de atenção". Só funções puras (sem React), para testar sem montar tela.
 *
 * Os destinos usam os NOMES DO CONTRATO nas buscas das listas (`status`, `activity`, `created_from`/`created_to`,
 * `type`, `from`/`to`): o filtro que o cartão leva é o mesmo que a tela de destino lê da URL.
 *
 * Número que não existe no banco (`unavailable`: clientes em teste, receita da plataforma) fica no painel como
 * "Não apurado" e NÃO leva a lugar nenhum: não há lista para ele.
 */
import type { AdminLinkTarget } from "@/components/admin/platform";
import { formatInt, isFigureAvailable } from "@/lib/admin/format";
import { createdInPeriodFilter } from "@/lib/admin/period";
import type {
  AdminActivityEvent,
  AdminAlert,
  AdminCampaignApplicationsMeta,
  AdminDateRange,
  AdminFigure,
  AdminOverview,
} from "@/shared/admin-platform.types";

// ---------------------------------------------------------------------------
// Painéis de números
// ---------------------------------------------------------------------------

export type DashboardAreaId = "workspaces" | "users" | "creators" | "campaigns";

/** Texto de apoio ao lado do tipo do número. Com `label` e `definition`, ganha o "i" com a regra do número que cita. */
export interface DashboardHint {
  text: string;
  /** Nome do número que o texto cita ("Novos clientes no período"): vai no botão "Como é calculado". */
  label?: string;
  definition?: string;
  /** O texto depende do período escolhido: some enquanto o período novo carrega. */
  periodic?: boolean;
}

export interface DashboardStat {
  id: string;
  label: string;
  figure?: AdminFigure;
  /** Sem destino = o número só informa (não existe lista para ele). */
  to?: AdminLinkTarget;
  hint?: DashboardHint;
  /** O número depende do período escolhido (não é a posição de agora): vira esqueleto enquanto o período novo carrega. */
  periodic?: boolean;
}

export interface DashboardArea {
  id: DashboardAreaId;
  title: string;
  /** Colunas do painel por largura útil: larga, média e estreita (no celular estreito é sempre uma). */
  columns: { lg: number; md: number; sm: number };
  stats: DashboardStat[];
}

/** Os quatro cartões por id; a ordem na tela é decidida por quem desenha. */
export type DashboardAreas = Record<DashboardAreaId, DashboardArea>;

const WORKSPACES = "/admin/workspaces";
const USERS = "/admin/users";
const CREATORS = "/admin/creators";
const CAMPAIGNS = "/admin/campaigns";

function link(to: string, search?: Record<string, string>): AdminLinkTarget {
  return search ? { to, search } : { to };
}

/** "+7 no período" (zero: "nenhum novo no período"). Número ausente ou "não apurado" não vira texto. */
function newInPeriodHint(figure: AdminFigure | undefined, label: string): DashboardHint | undefined {
  if (!isFigureAvailable(figure)) return undefined;
  const text = figure.value === 0 ? "nenhum novo no período" : `+${formatInt(figure.value)} no período`;
  return { text, label, definition: figure.definition, periodic: true };
}

/** O que o Dashboard acrescenta ao `/admin/overview`: números de outras rotas (sessões de hoje e inscrições). */
export interface DashboardExtras {
  /** Usuários com sessão hoje; `null` enquanto a leitura não chegou. `capped`: bateu no limite de 100 ("ou mais"). */
  activeToday?: { value: number; capped: boolean } | null;
  /** `meta.applications` de `GET /admin/campaigns`: inscrições de criadores em campanhas. */
  applications?: AdminCampaignApplicationsMeta | null;
  /** Criadores ATIVOS (`meta.total` de `GET /admin/users?kind=creator&status=active`): sem suspensos nem contas em cadastro. */
  creatorsActive?: number | null;
}

function extraFigure(value: number, kind: AdminFigure["kind"], definition: string): AdminFigure {
  return { value, unit: "count", kind, definition };
}

/**
 * Os quatro cartões do Dashboard (Clientes, Usuários, Criadores, Campanhas), cada um com DOIS números: o total e o que
 * conta de verdade (ativos, ativos hoje, criados no período, publicadas e inscrições). O dinheiro saiu do Dashboard (fica
 * em Financeiro) e o "Precisa de atenção" continua à parte. Sem `overview` (carregando) os cartões saem com os mesmos
 * rótulos e sem número: a tela mostra esqueleto no lugar, sem pular de tamanho quando os números chegam.
 */
export function buildDashboardAreas(overview: AdminOverview | undefined, range: AdminDateRange, extras: DashboardExtras = {}): DashboardAreas {
  const workspaces = overview?.workspaces;
  const users = overview?.users;
  const creators = overview?.creators;
  const campaigns = overview?.campaigns;
  const windowDays = overview?.activity_window_days;
  const created = createdInPeriodFilter(range);
  void created;

  const activeToday = extras.activeToday;
  const applications = extras.applications;
  const creatorsActive = extras.creatorsActive;

  return {
    workspaces: {
      id: "workspaces",
      title: "Clientes",
      columns: { lg: 2, md: 2, sm: 2 },
      stats: [
        {
          id: "workspaces.total",
          label: "Clientes",
          figure: workspaces?.total,
          to: link(WORKSPACES),
          hint: newInPeriodHint(workspaces?.new_in_period, "Novos clientes no período"),
        },
        {
          id: "workspaces.active",
          label: "Ativos",
          figure: workspaces?.active,
          to: link(WORKSPACES, { status: "active", activity: "active" }),
          hint: windowDays ? { text: `com atividade nos últimos ${windowDays} dias` } : undefined,
        },
      ],
    },
    users: {
      id: "users",
      title: "Usuários",
      columns: { lg: 2, md: 2, sm: 2 },
      stats: [
        {
          id: "users.brand-total",
          label: "Usuários",
          figure: users?.brand_total,
          to: link(USERS),
          hint: newInPeriodHint(users?.brand_new_in_period, "Novos usuários no período"),
        },
        {
          // Sessão aberta hoje (dia de São Paulo): a API não conta por sessão, então vem da leitura das 100 contas mais recentes.
          id: "users.active-today",
          label: "Ativos hoje",
          figure: activeToday
            ? extraFigure(activeToday.value, "proxy", "Usuários de marca com sessão aberta hoje (dia de São Paulo). Lido das 100 contas com sessão mais recente: acima de 100, o número é um mínimo.")
            : undefined,
          hint: activeToday?.capped ? { text: "100 ou mais" } : { text: "com sessão hoje" },
        },
      ],
    },
    creators: {
      id: "creators",
      title: "Criadores",
      columns: { lg: 2, md: 2, sm: 2 },
      stats: [
        {
          id: "creators.total",
          label: "Criadores",
          figure:
            creatorsActive == null
              ? undefined
              : extraFigure(creatorsActive, "stock", "Criadores com conta ativa (sem suspensos nem contas ainda em cadastro). É o mesmo número da aba Criadores em Pessoas."),
          to: link(CREATORS, { status: "active" }),
        },
        {
          id: "creators.new",
          label: "Criados no período",
          figure: creators?.new_in_period,
          to: link(CREATORS),
          hint: { text: "contas novas de criador" },
          periodic: true,
        },
      ],
    },
    campaigns: {
      id: "campaigns",
      title: "Campanhas",
      columns: { lg: 2, md: 2, sm: 2 },
      stats: [
        {
          id: "campaigns.published",
          label: "Publicadas",
          figure: campaigns?.published,
          to: link(CAMPAIGNS, { status: "published" }),
          hint: campaigns?.total && isFigureAvailable(campaigns.total) ? { text: `de ${formatInt(campaigns.total.value)} campanhas` } : undefined,
        },
        {
          id: "campaigns.applications",
          label: "Inscrições hoje",
          figure: applications ? extraFigure(applications.today, "realized", "Criadores que se inscreveram em campanhas hoje (dia de São Paulo). Convites da marca não contam.") : undefined,
          to: link(CAMPAIGNS),
          hint: applications ? { text: `${formatInt(applications.last_7_days)} em 7 dias · ${formatInt(applications.month_to_date)} no mês` } : undefined,
        },
      ],
    },
  };
}

/**
 * A regra do período em frases curtas (vai no "i" ao lado do seletor, no lugar da descrição que cada painel repetia):
 * o que segue o período escolhido, o que é a posição de agora e, com a janela do servidor, o que é "ativo".
 * Sem `windowDays` (carregando) a frase da janela não aparece, em vez de inventar um número.
 */
export function dashboardPeriodRule(windowDays?: number): string[] {
  const lines = [
    "Seguem o período escolhido: novos no período, campanhas criadas, aportes, liberações a criadores e PIX pagos.",
    "São a posição de agora, sem período: totais por situação, saldo em custódia e cobranças pendentes.",
  ];
  if (windowDays) lines.push(`Cliente ativo é quem teve atividade nos últimos ${windowDays} dias.`);
  return lines;
}

// ---------------------------------------------------------------------------
// Precisa de atenção
// ---------------------------------------------------------------------------

/** No máximo isto no Dashboard; o resto está em "Ver todos" (Saúde da plataforma). */
export const ATTENTION_LIMIT = 6;

// Valor novo do backend (fora destas listas) vai para o fim, sem quebrar a ordenação.
const KIND_RANK: Record<string, number> = { alert: 0, suggestion: 1 };
const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 };

function rank(table: Record<string, number>, value: string): number {
  return table[value] ?? Object.keys(table).length;
}

/**
 * Os que entram em "Precisa de atenção": alertas de verdade (fatos) primeiro, depois as sugestões (heurísticas); em
 * cada grupo, do mais grave ao menos grave; empate mantém a ordem do servidor. No máximo `limit`.
 */
export function pickAttentionAlerts(alerts: readonly AdminAlert[], limit: number = ATTENTION_LIMIT): AdminAlert[] {
  return alerts
    .map((alert, index) => ({ alert, index }))
    .sort(
      (a, b) =>
        rank(KIND_RANK, a.alert.kind) - rank(KIND_RANK, b.alert.kind) ||
        rank(SEVERITY_RANK, a.alert.severity) - rank(SEVERITY_RANK, b.alert.severity) ||
        a.index - b.index,
    )
    .slice(0, Math.max(0, limit))
    .map((item) => item.alert);
}

// ---------------------------------------------------------------------------
// Atividade recente
// ---------------------------------------------------------------------------

/**
 * Para onde o evento leva: o alvo, quando é um workspace, uma campanha ou um usuário (as telas de detalhe existem);
 * senão o workspace do evento (aporte, saque, ação sobre membro); sem nenhum dos dois, para lugar nenhum.
 */
export function activityLink(event: AdminActivityEvent): AdminLinkTarget | undefined {
  const target = event.target;
  if (target?.type === "workspace" && target.id) {
    return { to: "/admin/workspaces/$workspaceId", params: { workspaceId: target.id } };
  }
  if (target?.type === "campaign" && target.id) {
    return { to: "/admin/campaigns/$campaignId", params: { campaignId: target.id } };
  }
  if (target?.type === "user" && target.id) {
    return { to: "/admin/users/$userId", params: { userId: target.id } };
  }
  if (event.workspace) {
    return { to: "/admin/workspaces/$workspaceId", params: { workspaceId: event.workspace.id } };
  }
  return undefined;
}

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
import { figureText, formatInt, isFigureAvailable } from "@/lib/admin/format";
import { createdInPeriodFilter, periodQuery } from "@/lib/admin/period";
import type {
  AdminActivityEvent,
  AdminAlert,
  AdminDateRange,
  AdminFigure,
  AdminOverview,
} from "@/shared/admin-platform.types";

// ---------------------------------------------------------------------------
// Painéis de números
// ---------------------------------------------------------------------------

export type DashboardAreaId = "workspaces" | "users" | "creators" | "campaigns" | "financial";

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

/** Os cinco painéis por id; a ordem na tela é decidida por quem desenha. */
export type DashboardAreas = Record<DashboardAreaId, DashboardArea>;

const WORKSPACES = "/admin/workspaces";
const USERS = "/admin/users";
const CREATORS = "/admin/creators";
const CAMPAIGNS = "/admin/campaigns";
const FINANCIAL = "/admin/financial";

function link(to: string, search?: Record<string, string>): AdminLinkTarget {
  return search ? { to, search } : { to };
}

/** "+7 no período" (zero: "nenhum novo no período"). Número ausente ou "não apurado" não vira texto. */
function newInPeriodHint(figure: AdminFigure | undefined, label: string): DashboardHint | undefined {
  if (!isFigureAvailable(figure)) return undefined;
  const text = figure.value === 0 ? "nenhum novo no período" : `+${formatInt(figure.value)} no período`;
  return { text, label, definition: figure.definition, periodic: true };
}

/** O comprometido é PARTE da custódia, não se soma a ela: aparece como "dos quais ... comprometidos". */
function committedHint(figure: AdminFigure | undefined): DashboardHint | undefined {
  if (!isFigureAvailable(figure)) return undefined;
  return { text: `dos quais ${figureText(figure)} comprometidos`, label: "Comprometido", definition: figure.definition };
}

/**
 * Os cinco painéis do Dashboard. Sem `overview` (carregando) os painéis saem com os mesmos rótulos e sem número: a tela
 * mostra esqueleto no lugar, sem pular de tamanho quando os números chegam.
 */
export function buildDashboardAreas(overview: AdminOverview | undefined, range: AdminDateRange): DashboardAreas {
  const workspaces = overview?.workspaces;
  const users = overview?.users;
  const creators = overview?.creators;
  const campaigns = overview?.campaigns;
  const financial = overview?.financial;
  const windowDays = overview?.activity_window_days;

  const created = createdInPeriodFilter(range);
  const period = periodQuery(range);

  return {
    workspaces: {
      id: "workspaces",
      title: "Clientes",
      columns: { lg: 6, md: 3, sm: 2 },
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
        },
        {
          id: "workspaces.inactive",
          label: "Inativos",
          figure: workspaces?.inactive,
          to: link(WORKSPACES, { status: "active", activity: "inactive" }),
        },
        {
          id: "workspaces.suspended",
          label: "Suspensos",
          figure: workspaces?.suspended,
          to: link(WORKSPACES, { status: "suspended" }),
        },
        {
          id: "workspaces.archived",
          label: "Arquivados",
          figure: workspaces?.archived,
          to: link(WORKSPACES, { status: "archived" }),
        },
        // Não existe teste/plano no banco: aparece como "Não apurado", sem link e sem zero.
        { id: "workspaces.trial", label: "Em teste", figure: workspaces?.trial },
      ],
    },
    users: {
      id: "users",
      title: "Usuários",
      columns: { lg: 3, md: 3, sm: 2 },
      stats: [
        {
          id: "users.brand-total",
          label: "Usuários",
          figure: users?.brand_total,
          to: link(USERS),
          hint: newInPeriodHint(users?.brand_new_in_period, "Novos usuários no período"),
        },
        {
          id: "users.suspended",
          label: "Suspensos",
          figure: users?.suspended,
          to: link(USERS, { status: "suspended" }),
        },
        {
          // Aproximação (a sessão some quando a pessoa sai) e sem filtro equivalente na lista: não leva a lugar nenhum.
          id: "users.recent-session",
          label: "Sessão recente",
          figure: users?.recent_session,
          hint: windowDays ? { text: `últimos ${windowDays} dias` } : undefined,
        },
      ],
    },
    creators: {
      id: "creators",
      title: "Criadores",
      columns: { lg: 1, md: 1, sm: 1 },
      stats: [
        {
          id: "creators.total",
          label: "Criadores",
          figure: creators?.total,
          to: link(CREATORS),
          hint: newInPeriodHint(creators?.new_in_period, "Novos criadores no período"),
        },
      ],
    },
    campaigns: {
      id: "campaigns",
      title: "Campanhas",
      columns: { lg: 5, md: 3, sm: 2 },
      stats: [
        { id: "campaigns.total", label: "Campanhas", figure: campaigns?.total, to: link(CAMPAIGNS) },
        {
          id: "campaigns.published",
          label: "Publicadas",
          figure: campaigns?.published,
          to: link(CAMPAIGNS, { status: "published" }),
        },
        {
          id: "campaigns.finished",
          label: "Finalizadas",
          figure: campaigns?.finished,
          to: link(CAMPAIGNS, { status: "finished" }),
        },
        {
          id: "campaigns.draft",
          label: "Rascunhos",
          figure: campaigns?.draft,
          to: link(CAMPAIGNS, { status: "draft" }),
        },
        {
          id: "campaigns.created",
          label: "Criadas no período",
          figure: campaigns?.created_in_period,
          to: link(CAMPAIGNS, created),
          periodic: true,
        },
      ],
    },
    financial: {
      id: "financial",
      title: "Dinheiro",
      columns: { lg: 3, md: 3, sm: 2 },
      stats: [
        {
          id: "financial.funded",
          label: "Aportes no período",
          figure: financial?.funded_in_period,
          to: link(FINANCIAL, { type: "charge", ...period }),
          periodic: true,
        },
        {
          id: "financial.custody",
          label: "Saldo em custódia",
          figure: financial?.custody,
          to: link(FINANCIAL),
          hint: committedHint(financial?.committed),
        },
        {
          // Liberado é o valor que foi para o saldo do criador; "pago" é só o PIX concluído (o próximo cartão).
          id: "financial.released",
          label: "Liberado a criadores no período",
          figure: financial?.released_in_period,
          to: link(FINANCIAL, { type: "ledger_entry", ...period }),
          hint: { text: "vai ao saldo do criador" },
          periodic: true,
        },
        {
          id: "financial.paid-pix",
          label: "Pago via PIX no período",
          figure: financial?.paid_pix_in_period,
          to: link(FINANCIAL, { type: "transfer", ...period }),
          periodic: true,
        },
        {
          id: "financial.pending",
          label: "Cobranças pendentes",
          figure: financial?.pending_charges,
          to: link(FINANCIAL, { type: "charge" }),
        },
        // Não há modelo de taxa/comissão no banco: "Não apurado", sem link e sem zero.
        { id: "financial.revenue", label: "Receita da plataforma", figure: financial?.platform_revenue },
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

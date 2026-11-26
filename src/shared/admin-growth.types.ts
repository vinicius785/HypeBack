/**
 * Dashboard de crescimento do Admin: `GET /backoffice/admin/dashboard/growth/*`.
 *
 * Só staff, só contagens (nenhum criador individual), números inteiros, percentuais de 0 a 100 com 1 casa e datas ISO.
 * Dia em America/Sao_Paulo e semana começando na segunda. Toda resposta vem como `{ data, generated_at, cached }`
 * (`cached` é informativo).
 */

/** O envelope de todas as respostas do crescimento. */
export interface GrowthStamped<T> {
  data: T;
  generated_at: string | null;
  cached: boolean;
}

/** `growth/base`: a base de criadores de agora. */
export interface GrowthBase {
  accounts_created: number;
  /** Total da lista de Criadores do Admin. */
  visible_in_admin: number;
  /** E-mail confirmado. */
  signup_completed: number;
  signup_completed_pct: number;
  /** Usou o app em 30 dias. */
  active_30d: number;
  active_pct: number;
}

export type GrowthActiveDays = 1 | 7 | 15 | 30 | 90;

/** `growth/active`: quem usou o app em cada janela. `history` vem vazio até o registro diário rodar. */
export interface GrowthActive {
  accounts: number;
  windows: Array<{ days: GrowthActiveDays; count: number; pct_of_accounts: number }>;
  /** Usou em 90 dias e não nos últimos 30. */
  churned_30_90: number;
  history: Array<{
    date: string;
    active_1d: number;
    active_7d: number;
    active_15d: number;
    active_30d: number;
    active_90d: number;
  }>;
}

export type GrowthGranularity = "month" | "week";

export interface GrowthTimelinePeriod {
  /** `YYYY-MM-DD` (primeiro dia do mês ou segunda da semana). */
  start: string;
  /** O período em andamento (o último). */
  partial: boolean;
  accounts_new: number;
  /** Por coorte: das contas criadas NESTE período, % que já confirmou o e-mail. */
  confirmed_pct: number;
  applications: number;
  applicants_distinct: number;
  campaigns_created: number;
  deposits_count: number;
  deposits_amount_cents: number;
}

/** `growth/timeline?granularity&periods`: do mais antigo ao mais novo. */
export interface GrowthTimeline {
  granularity: GrowthGranularity;
  periods: GrowthTimelinePeriod[];
}

export type GrowthVerdict = "melhorando" | "estavel" | "piorando";

/** `growth/trend`: quatro semanas fechadas, a mais antiga primeiro. */
export interface GrowthTrend {
  weeks: Array<{
    start: string;
    accounts_new: number;
    confirmed_pct: number;
    applications: number;
    applications_per_day: number;
    campaigns_new: number;
  }>;
  /** Última semana fechada contra a anterior; `null` quando a anterior é 0. */
  delta_vs_prev: {
    accounts_new_pct: number | null;
    confirmed_pct_points: number | null;
    applications_pct: number | null;
    applications_per_day_pct: number | null;
    campaigns_new_pct: number | null;
  };
  verdict: GrowthVerdict;
  /** O critério do veredito, em texto, para mostrar na tela. */
  rule: string;
}

export type GrowthFunnelKey = "signups" | "accounts_active" | "email_confirmed" | "applied" | "used_app_30d";

/** `growth/funnel`. */
export interface GrowthFunnel {
  /** E-mails com código pendente que ainda não viraram conta confirmada. */
  started_not_finished: number;
  /** Contas de criador excluídas. */
  deleted_anonymized: number;
  /** Contas ativas sem e-mail confirmado. */
  email_unconfirmed: number;
  steps: Array<{ key: GrowthFunnelKey | (string & {}); count: number }>;
}

/** `growth/applications`: inscrição do próprio criador (sem convite), de criadores ativos. */
export interface GrowthApplications {
  total: number;
  last_7d: number;
  last_30d: number;
  applicants_distinct: number;
  avg_per_applicant: number;
  applied_of_completed_pct: number;
}

export type GrowthEngagementAction =
  | "app_open"
  | "application"
  | "script"
  | "content"
  | "chat"
  | "post"
  | "like"
  | "comment"
  | "group"
  | "live"
  | "course"
  | "check_in"
  | "referral"
  | "withdrawal";

/** `growth/engagement?days=1..90`: criadores DISTINTOS por ação. `history` só com `days=30` e depois do registro diário. */
export interface GrowthEngagement {
  days: number;
  accounts: number;
  by_action: Record<GrowthEngagementAction | (string & {}), number>;
  engaged_any: number;
  engaged_3plus: number;
  engaged_5plus: number;
  engaged_any_pct: number;
  history: Array<{ date: string; engaged_any: number; engaged_3plus: number; engaged_5plus: number }>;
}

export type GrowthNetwork = "instagram" | "tiktok" | "youtube";

/** `growth/never-applied`: só contagens de quem nunca se candidatou. */
export interface GrowthNeverApplied {
  total: number;
  /** Completo = rede conectada + cidade + nicho principal; vazio = nenhum dos três; parcial = o resto. */
  profile: { complete: number; partial: number; empty: number };
  by_network: Array<{ network: GrowthNetwork | (string & {}); count: number }>;
  /** Top 15, nicho principal; `parent_id` preenchido quando é subnicho. */
  by_niche: Array<{ niche_id: number; name: string; parent_id: number | null; count: number }>;
  /** Top 15. */
  by_city: Array<{ city: string; state: string; count: number }>;
}

export type GrowthFollowerBand = "0-1k" | "1k-5k" | "5k-10k" | "10k-50k" | "50k-100k" | "100k-500k" | "500k-1M" | "1M+";

/** `growth/profile`: o perfil das contas ativas. */
export interface GrowthProfile {
  accounts: number;
  /** `key` é o texto do cadastro em minúsculas; `not_informed` quando vazio. */
  gender: Array<{ key: string; count: number }>;
  /** Top 20, nicho principal; `parent_id` preenchido quando é subnicho. */
  niches: Array<{ id: number; name: string; parent_id: number | null; count: number }>;
  no_niche: number;
  /** Top 20. */
  states: Array<{ uf: string; count: number }>;
  /** Top 20. */
  cities_top: Array<{ city: string; uf: string; count: number }>;
  no_address: number;
  /** Sempre as 8 faixas na ordem; 1 contagem por criador, pelo maior perfil da rede. */
  followers: Record<GrowthNetwork, Array<{ band: GrowthFollowerBand | (string & {}); count: number }>>;
  with_network: { instagram: number; tiktok: number; youtube: number; any: number };
  /** Sobre as contas ativas. */
  with_network_pct: number;
}

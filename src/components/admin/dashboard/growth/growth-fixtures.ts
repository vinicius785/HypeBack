/** Respostas de exemplo do dashboard de crescimento, no formato do contrato (testes e desenvolvimento sem a API). */
import type {
  GrowthActive,
  GrowthApplications,
  GrowthBase,
  GrowthEngagement,
  GrowthFunnel,
  GrowthNeverApplied,
  GrowthProfile,
  GrowthTimeline,
  GrowthTrend,
} from "@/shared/admin-growth.types";

export const BASE: GrowthBase = {
  accounts_created: 12345,
  visible_in_admin: 9800,
  signup_completed: 8000,
  signup_completed_pct: 64.8,
  active_30d: 3100,
  active_pct: 25.1,
};

export const ACTIVE: GrowthActive = {
  accounts: 9800,
  windows: [
    { days: 1, count: 410, pct_of_accounts: 4.2 },
    { days: 7, count: 1500, pct_of_accounts: 15.3 },
    { days: 15, count: 2300, pct_of_accounts: 23.5 },
    { days: 30, count: 3100, pct_of_accounts: 31.6 },
    { days: 90, count: 4800, pct_of_accounts: 49 },
  ],
  churned_30_90: 1700,
  history: [],
};

export const ACTIVE_WITH_HISTORY: GrowthActive = {
  ...ACTIVE,
  history: [
    { date: "2026-11-23", active_1d: 400, active_7d: 1400, active_15d: 2200, active_30d: 3000, active_90d: 4700 },
    { date: "2026-11-24", active_1d: 410, active_7d: 1500, active_15d: 2300, active_30d: 3100, active_90d: 4800 },
  ],
};

export const TIMELINE_MONTH: GrowthTimeline = {
  granularity: "month",
  periods: [
    { start: "2026-09-01", partial: false, accounts_new: 300, confirmed_pct: 70.5, applications: 120, applicants_distinct: 80, campaigns_created: 9, deposits_count: 4, deposits_amount_cents: 1000000 },
    { start: "2026-10-01", partial: false, accounts_new: 420, confirmed_pct: 66.1, applications: 180, applicants_distinct: 110, campaigns_created: 12, deposits_count: 6, deposits_amount_cents: 1500000 },
    { start: "2026-11-01", partial: true, accounts_new: 150, confirmed_pct: 40, applications: 60, applicants_distinct: 40, campaigns_created: 5, deposits_count: 2, deposits_amount_cents: 500000 },
  ],
};

export const TIMELINE_WEEK: GrowthTimeline = {
  granularity: "week",
  periods: [
    { start: "2026-11-16", partial: false, accounts_new: 90, confirmed_pct: 61, applications: 40, applicants_distinct: 30, campaigns_created: 3, deposits_count: 1, deposits_amount_cents: 100000 },
    { start: "2026-11-23", partial: true, accounts_new: 20, confirmed_pct: 30, applications: 8, applicants_distinct: 6, campaigns_created: 1, deposits_count: 0, deposits_amount_cents: 0 },
  ],
};

export const TREND: GrowthTrend = {
  weeks: [
    { start: "2026-10-26", accounts_new: 100, confirmed_pct: 65, applications: 50, applications_per_day: 7.1, campaigns_new: 4 },
    { start: "2026-11-02", accounts_new: 110, confirmed_pct: 66, applications: 55, applications_per_day: 7.9, campaigns_new: 4 },
    { start: "2026-11-09", accounts_new: 105, confirmed_pct: 64, applications: 52, applications_per_day: 7.4, campaigns_new: 5 },
    { start: "2026-11-16", accounts_new: 80, confirmed_pct: 60, applications: 30, applications_per_day: 4.3, campaigns_new: 0 },
  ],
  delta_vs_prev: {
    accounts_new_pct: -23.8,
    confirmed_pct_points: -4,
    applications_pct: -42.3,
    applications_per_day_pct: -41.9,
    campaigns_new_pct: null,
  },
  verdict: "piorando",
  rule: "Última semana fechada contra a média das 3 anteriores em contas novas, candidaturas e campanhas novas: ±10% por métrica; 2 de 3 na mesma direção decidem.",
};

export const FUNNEL: GrowthFunnel = {
  started_not_finished: 2100,
  deleted_anonymized: 340,
  email_unconfirmed: 1800,
  steps: [
    { key: "signups", count: 12345 },
    { key: "accounts_active", count: 9800 },
    { key: "email_confirmed", count: 8000 },
    { key: "applied", count: 2500 },
    { key: "used_app_30d", count: 3100 },
  ],
};

export const APPLICATIONS: GrowthApplications = {
  total: 6400,
  last_7d: 310,
  last_30d: 1250,
  applicants_distinct: 2500,
  avg_per_applicant: 2.6,
  applied_of_completed_pct: 31.3,
};

export const ENGAGEMENT: GrowthEngagement = {
  days: 30,
  accounts: 9800,
  by_action: {
    app_open: 3100,
    application: 900,
    script: 120,
    content: 300,
    chat: 450,
    post: 80,
    like: 700,
    comment: 400,
    group: 60,
    live: 90,
    course: 40,
    check_in: 220,
    referral: 15,
    withdrawal: 5,
  },
  engaged_any: 3100,
  engaged_3plus: 1100,
  engaged_5plus: 300,
  engaged_any_pct: 31.6,
  history: [],
};

export const NEVER_APPLIED: GrowthNeverApplied = {
  total: 6000,
  profile: { complete: 1200, partial: 3000, empty: 1800 },
  by_network: [
    { network: "instagram", count: 4000 },
    { network: "tiktok", count: 2500 },
    { network: "youtube", count: 300 },
  ],
  by_niche: [
    { niche_id: 1, name: "Beleza", parent_id: null, count: 800 },
    { niche_id: 11, name: "Maquiagem", parent_id: 1, count: 300 },
  ],
  by_city: [
    { city: "São Paulo", state: "SP", count: 900 },
    { city: "Recife", state: "PE", count: 200 },
  ],
};

const BANDS = ["0-1k", "1k-5k", "5k-10k", "10k-50k", "50k-100k", "100k-500k", "500k-1M", "1M+"];
const bands = (counts: number[]) => BANDS.map((band, i) => ({ band, count: counts[i] ?? 0 }));

export const PROFILE: GrowthProfile = {
  accounts: 9800,
  gender: [
    { key: "female", count: 6000 },
    { key: "male", count: 2500 },
    { key: "nao-binario", count: 40 },
    { key: "not_informed", count: 1260 },
  ],
  niches: [
    { id: 1, name: "Beleza", parent_id: null, count: 1500 },
    { id: 11, name: "Maquiagem", parent_id: 1, count: 600 },
  ],
  no_niche: 6100,
  states: [
    { uf: "SP", count: 3000 },
    { uf: "RJ", count: 1200 },
  ],
  cities_top: [{ city: "São Paulo", uf: "SP", count: 1800 }],
  no_address: 2000,
  followers: {
    instagram: bands([100, 900, 700, 400, 80, 20, 3, 1]),
    tiktok: bands([200, 600, 300, 100, 20, 5, 1, 0]),
    youtube: bands([50, 100, 40, 10, 2, 1, 0, 0]),
  },
  with_network: { instagram: 5000, tiktok: 3000, youtube: 400, any: 6500 },
  with_network_pct: 66.3,
};

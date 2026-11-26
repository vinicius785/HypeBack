/**
 * Textos e formatos do dashboard de crescimento: rótulos em português para as chaves da API (uma chave nova aparece como
 * veio), datas de período em dia de São Paulo e a montagem de um `AdminFigure` para o `AdminFigureCard`.
 */
import { formatCivilDate, formatInt, formatPercent } from "@/lib/admin/format";
import type { AdminFigure, AdminFigureKind, AdminFigureUnit } from "@/shared/admin-platform.types";
import type { GrowthGranularity, GrowthVerdict } from "@/shared/admin-growth.types";

/** Um número do crescimento com a regra que o explica (o "i" do cartão). */
export function growthFigure(
  value: number | null | undefined,
  unit: AdminFigureUnit,
  definition: string,
  kind: AdminFigureKind = "stock",
): AdminFigure {
  return { value: typeof value === "number" && Number.isFinite(value) ? value : null, unit, kind, definition };
}

export const ENGAGEMENT_LABEL: Record<string, string> = {
  app_open: "Abriu o app",
  application: "Candidatura",
  script: "Roteiro",
  content: "Conteúdo",
  chat: "Chat da campanha",
  post: "Post",
  like: "Curtida",
  comment: "Comentário",
  group: "Grupo",
  live: "Live (ver, comentar ou curtir)",
  course: "Aula (desbloqueou)",
  check_in: "Check-in",
  referral: "Indicação",
  withdrawal: "Saque",
};

export const GENDER_LABEL: Record<string, string> = {
  male: "Masculino",
  female: "Feminino",
  other: "Outro",
  prefer_not_to_say: "Prefere não informar",
  not_informed: "Não informado",
};

export const NETWORK_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const FUNNEL_LABEL: Record<string, string> = {
  signups: "Cadastros",
  accounts_active: "Contas ativas",
  email_confirmed: "E-mail confirmado",
  applied: "Já se candidataram",
  used_app_30d: "Usaram o app em 30 dias",
};

export const VERDICT_LABEL: Record<GrowthVerdict, string> = {
  melhorando: "Melhorando",
  estavel: "Estável",
  piorando: "Piorando",
};

export const ACTIVE_WINDOW_LABEL: Record<number, string> = {
  1: "24 horas",
  7: "7 dias",
  15: "15 dias",
  30: "30 dias",
  90: "90 dias",
};

export const FOLLOWER_BAND_LABEL: Record<string, string> = {
  "0-1k": "0–1 mil",
  "1k-5k": "1–5 mil",
  "5k-10k": "5–10 mil",
  "10k-50k": "10–50 mil",
  "50k-100k": "50–100 mil",
  "100k-500k": "100–500 mil",
  "500k-1M": "500 mil–1 mi",
  "1M+": "1 mi+",
};

/** O rótulo da tabela: chave conhecida em português, desconhecida como veio. */
export function labelOf(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

const SHORT_MONTH = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** `2026-11-17` na granularidade: semana → "17/11"; mês → "nov/2026". Data torta aparece como veio. */
export function periodLabel(start: string, granularity: GrowthGranularity): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  if (!match) return start;
  if (granularity === "month") return `${SHORT_MONTH[Number(match[2]) - 1] ?? match[2]}/${match[1]}`;
  return `${match[3]}/${match[2]}`;
}

/** Nome completo do período para leitor de tela e tooltip: "Semana de 17/11/2026" ou "nov/2026". */
export function periodTitle(start: string, granularity: GrowthGranularity): string {
  return granularity === "month" ? periodLabel(start, "month") : `Semana de ${formatCivilDate(start)}`;
}

/** Variação em %: `null` (a anterior era 0) é "—", nunca "0%". Sinal explícito. */
export function formatDeltaPct(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${formatPercent(value)}`;
}

/** Variação em pontos percentuais (a confirmação já é um %). */
export function formatDeltaPoints(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${formatPercent(value).replace("%", "")} p.p.`;
}

/** Média com 1 casa ("2,4"). */
export function formatOneDecimal(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

/** Nicho ou subnicho: `parent_id` preenchido marca o subnicho. */
export function nicheName(name: string, parentId: number | null | undefined): string {
  const text = name.trim() || "Sem nome";
  return parentId ? `Subnicho · ${text}` : text;
}

/** "São Paulo/SP"; sem UF só a cidade. */
export function cityName(city: string, uf: string | null | undefined): string {
  const name = city.trim() || "Sem nome";
  return uf ? `${name}/${uf}` : name;
}

export { formatInt };

import { getNetworkLabel } from "@/shared/constants/network-labels";
import type { ExtendedInfluencer } from "../management-kanban-config";
import { enrolledAt } from "./card-info";

/** Filtros "de perfil" do quadro (além de situação, origem, rede e busca): audiência, engajamento, nicho e data de inscrição. */
export interface AdvancedFilters {
  /** Seguidores: mínimo e máximo (ou `null` = sem limite). */
  folMin: number | null;
  folMax: number | null;
  /** Engajamento mínimo, em %. */
  engMin: number | null;
  /** Nicho exato (`null` = todos). */
  niche: string | null;
  /** Inscrito nos últimos N dias (`null` = qualquer data). */
  sinceDays: number | null;
}

export const NO_ADVANCED: AdvancedFilters = { folMin: null, folMax: null, engMin: null, niche: null, sinceDays: null };

/** Atalhos de seguidores mínimos e de engajamento mínimo, e janelas de inscrição. */
export const FOLLOWER_PRESETS: ReadonlyArray<readonly [number, string]> = [
  [10_000, "10 mil+"],
  [50_000, "50 mil+"],
  [100_000, "100 mil+"],
  [500_000, "500 mil+"],
];
export const ENGAGEMENT_PRESETS: ReadonlyArray<readonly [number, string]> = [
  [1, "1%+"],
  [3, "3%+"],
  [5, "5%+"],
  [10, "10%+"],
];
export const SINCE_PRESETS: ReadonlyArray<readonly [number, string]> = [
  [1, "Hoje"],
  [7, "7 dias"],
  [30, "30 dias"],
];

/** Quantos dos filtros de perfil estão ligados (cada grupo conta uma vez; seguidores mín. e máx. contam juntos). */
export function advancedCount(a: AdvancedFilters): number {
  return (
    (a.folMin != null || a.folMax != null ? 1 : 0) +
    (a.engMin != null ? 1 : 0) +
    (a.niche != null ? 1 : 0) +
    (a.sinceDays != null ? 1 : 0)
  );
}

/**
 * Lê "50k", "50 mil", "1,5m", "1.2 milhão", "120000" → número. Vazio ou inválido → `null`.
 * Com ponto ou vírgula e sem sufixo ("1.500") entende como milhar pt-BR quando há exatamente 3 dígitos depois.
 */
export function parseCompact(input: string): number | null {
  const raw = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return null;
  const m = raw.match(/^(\d+(?:[.,]\d+)?)(k|mil|m|mi|milhao|milhão|milhoes|milhões)?$/);
  if (!m) return null;
  const [, num, suffix] = m;
  if (!suffix && /^\d{1,3}([.,]\d{3})+$/.test(num)) return Number(num.replace(/[.,]/g, ""));
  const n = Number(num.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const mult = !suffix ? 1 : suffix === "k" || suffix === "mil" ? 1_000 : 1_000_000;
  return Math.round(n * mult);
}

/** Formata para o campo e os chips: 50000 → "50 mil", 1500000 → "1,5 mi". */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return String(n);
}

/** Seguidores considerados: os da rede escolhida no filtro de rede; sem rede, o total do criador. */
export function followersFor(inf: ExtendedInfluencer, net: string): number {
  if (net !== "all") {
    const hit = (inf.social_networks ?? []).find((n) => getNetworkLabel(n.type, n.type) === net);
    if (hit && typeof hit.members === "number") return hit.members;
  }
  return inf.followers ?? 0;
}

export function matchesAdvanced(inf: ExtendedInfluencer, a: AdvancedFilters, net: string, now: Date = new Date()): boolean {
  if (a.folMin != null || a.folMax != null) {
    const f = followersFor(inf, net);
    if (a.folMin != null && f < a.folMin) return false;
    if (a.folMax != null && f > a.folMax) return false;
  }
  if (a.engMin != null && (inf.engagement ?? 0) < a.engMin) return false;
  if (a.niche != null && (inf.nicheName ?? "") !== a.niche) return false;
  if (a.sinceDays != null) {
    const d = enrolledAt(inf);
    if (!d) return false;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const from = startOfToday - (a.sinceDays - 1) * 86_400_000;
    if (d.getTime() < from) return false;
  }
  return true;
}

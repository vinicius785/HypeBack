import type { AdminBadgeTone } from "@/components/admin/platform";
import type { SupportPriority, SupportSource, SupportStatus } from "@/shared/services/admin-support";

export const STATUS_TONE: Record<SupportStatus, AdminBadgeTone> = { open: "warn", in_progress: "brand", waiting: "neutral", resolved: "ok", closed: "muted" };
export const PRIORITY_TONE: Record<SupportPriority, AdminBadgeTone> = { low: "muted", normal: "neutral", high: "warn", urgent: "bad" };
export const SOURCE_TONE: Record<SupportSource, AdminBadgeTone> = { platform: "brand", app: "ok", site: "outline" };

export const ticketNumber = (n: number) => `#${n}`;

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "agora", "há 5 min", "há 3 h", "há 2 d" e, passado de uma semana, a data. */
export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.max(0, Math.round((now - t) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 8) return `há ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

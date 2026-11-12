/** Textos e contas do Boost da campanha (destaque de 24 horas). Todos os horários em Brasília. */
import type { CampaignBoost } from "@/shared/types";

export type CampaignBoostState = "available" | "active" | "used";

const TIME_ZONE = "America/Sao_Paulo";

/** O estado do cartão: um Boost "ativo" cujo fim já passou conta como usado (o servidor volta ao normal sozinho). */
export function campaignBoostState(boost: CampaignBoost, now: number = Date.now()): CampaignBoostState {
  if (boost.active && boost.ends_at && Date.parse(boost.ends_at) > now) return "active";
  if (boost.available && !boost.active) return "available";
  return "used";
}

/** "14:30", no fuso de Brasília. */
export function formatBoostTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/** "13/11/2026", no fuso de Brasília. */
export function formatBoostDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

/** "hoje às 14:30" ou "amanhã às 14:30" ou "13/11/2026 às 14:30": quando o Boost termina, no fuso de Brasília. */
export function formatBoostEnd(iso: string, now: number = Date.now()): string {
  const day = (ms: number) => formatBoostDate(new Date(ms).toISOString());
  const target = formatBoostDate(iso);
  const time = formatBoostTime(iso);
  if (target === day(now)) return `hoje às ${time}`;
  if (target === day(now + 86_400_000)) return `amanhã às ${time}`;
  return `${target} às ${time}`;
}

/** Tempo que falta: "5 h 20 min", "42 min" ou "menos de 1 min". */
export function formatBoostRemaining(endsAt: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 60_000));
  if (minutes < 1) return "menos de 1 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Texto de um erro da API (a mensagem que ela devolve), com um texto padrão para quando não vier nada. */
export function boostErrorText(error: unknown): string {
  const e = error as { message?: string | string[] } | null;
  const text = Array.isArray(e?.message) ? e.message.join(" ") : e?.message;
  return text?.trim() || "Não foi possível usar o Boost agora. Tente novamente.";
}

/** Cronômetro do que falta: "23:59:41" (horas, minutos e segundos; "00:00:00" quando acabou). */
export function formatBoostCountdown(endsAt: string, now: number = Date.now()): string {
  const total = Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

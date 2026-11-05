/**
 * Base compartilhada da apresentação de Projetos: tom dos selos, comparação de texto sem acento e datas de São Paulo.
 * `project-ui.ts` (lista e cabeçalho), `task-ui.ts` (quadro) e `document-ui.ts` (arquivos e links) partem daqui.
 * Datas de prazo (`YYYY-MM-DD`) são dias de calendário de São Paulo, nunca o fuso do computador.
 */

/** Tom visual do selo (as classes `.apj-tone-*` do CSS): verde, âmbar, vermelho, azul, neutro, apagado e escuro. */
export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "muted" | "dark";

/** Sem acento e sem caixa, para comparar texto. */
export const normalizeText = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export interface ResponsibleOption {
  /** `user_id` como texto (valor do filtro). */
  id: string;
  name: string;
  avatar: string | null;
}

// ---------------------------------------------------------------------------
// Datas (dias de calendário de São Paulo)
// ---------------------------------------------------------------------------

export const SAO_PAULO_TZ = "America/Sao_Paulo";

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` de hoje (ou de `now`) em São Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SAO_PAULO_TZ }).format(now);
}

/** `YYYY-MM-DD` de um instante (timestamp ISO) em São Paulo; `null` quando a data não é válida. */
export function dayInSaoPaulo(timestamp: string): string | null {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : todayInSaoPaulo(date);
}

function utcDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Dias de calendário de `from` até `to` (negativo quando `to` é anterior). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcDay(to) - utcDay(from)) / DAY_MS);
}

/** Soma dias a uma data `YYYY-MM-DD`. */
export function addDaysIso(iso: string, days: number): string {
  return new Date(utcDay(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** `05/11` de `2026-11-05`. */
export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

/** `05/11/2026` de `2026-11-05`. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** `05/11/2026 14:30` de um timestamp ISO, no fuso de São Paulo (vazio quando a data não é válida). */
export function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

/** "hoje", "há 1 dia", "há 3 dias", "há 2 semanas", "há 4 meses", "há 1 ano": por dias de calendário de São Paulo. */
export function timeAgo(timestamp: string, now: Date = new Date()): string {
  const day = dayInSaoPaulo(timestamp);
  if (!day) return "sem data";
  const days = daysBetween(day, todayInSaoPaulo(now));
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "há 1 semana" : `há ${weeks} semanas`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "há 1 mês" : `há ${months} meses`;
  const years = Math.floor(days / 365);
  return years === 1 ? "há 1 ano" : `há ${years} anos`;
}

/** "Atualizado hoje", "Atualizado há 3 dias" (a última atividade do projeto). */
export function updatedLabel(timestamp: string | null | undefined, now: Date = new Date()): string {
  return timestamp ? `Atualizado ${timeAgo(timestamp, now)}` : "Sem atividade recente";
}

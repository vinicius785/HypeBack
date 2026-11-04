/** Horários do chat: sempre no fuso de São Paulo, 24 horas, a partir do timestamp real da mensagem. */
export const CHAT_TZ = "America/Sao_Paulo";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: CHAT_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const clockFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: CHAT_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const longDayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: CHAT_TZ, day: "numeric", month: "long", year: "numeric" });
const shortDayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: CHAT_TZ, day: "2-digit", month: "2-digit" });

const valid = (d: Date) => !Number.isNaN(d.getTime());

/** "2026-11-03": o dia da mensagem em São Paulo (serve de chave de agrupamento). */
export function dayKey(iso: string | Date): string {
  const d = new Date(iso);
  return valid(d) ? dayKeyFmt.format(d) : "";
}

function yesterdayKey(now: Date): string {
  const t = new Date(`${dayKey(now)}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

/** Horário curto da prévia da conversa: hora hoje, "ontem" ou dia/mês. */
export function fmtTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (!valid(d)) return "";
  const key = dayKey(d);
  if (key === dayKey(now)) return clockFmt.format(d);
  if (key === yesterdayKey(now)) return "ontem";
  return shortDayFmt.format(d);
}

/** Rótulo do separador de dia: Hoje, Ontem ou a data completa ("3 de novembro de 2026"). */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (!valid(d)) return "";
  const key = dayKey(d);
  if (key === dayKey(now)) return "Hoje";
  if (key === yesterdayKey(now)) return "Ontem";
  return longDayFmt.format(d);
}

/** Hora do balão (HH:mm, 24 h). */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  return valid(d) ? clockFmt.format(d) : "";
}

/** Data e hora completas para o tooltip do balão: "3 de novembro de 2026 às 14:32". */
export function fullStamp(iso: string): string {
  const d = new Date(iso);
  return valid(d) ? `${longDayFmt.format(d)} às ${clockFmt.format(d)}` : "";
}

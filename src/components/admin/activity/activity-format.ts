/**
 * Datas da linha do tempo: agrupa eventos por dia de São Paulo ("Hoje", "Ontem", "quinta-feira, 30/10/2026") e
 * mostra a hora no fuso do negócio, nunca no do navegador.
 */
import { addCivilDays } from "@/components/admin/financial/financial-period";
import { ADMIN_TIME_ZONE, civilDateInSaoPaulo, EMPTY_TEXT, formatCivilDate, parseInstant } from "@/lib/admin/format";

const TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: ADMIN_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const WEEKDAY = new Intl.DateTimeFormat("pt-BR", { timeZone: ADMIN_TIME_ZONE, weekday: "long" });

/** Instante → "14:05" (fuso de São Paulo); inválido → "—". */
export function formatTimeOfDay(value: string | null | undefined): string {
  const date = parseInstant(value);
  return date ? TIME.format(date) : EMPTY_TEXT;
}

/** Dia (`YYYY-MM-DD`) de São Paulo a que o instante pertence; inválido → `null`. */
export function civilDayOf(value: string | null | undefined): string | null {
  const date = parseInstant(value);
  return date ? civilDateInSaoPaulo(date) : null;
}

/** "Hoje", "Ontem" ou "quinta-feira, 30/10/2026". */
export function dayHeading(civil: string, today: string): string {
  if (civil === today) return "Hoje";
  if (civil === addCivilDays(today, -1)) return "Ontem";
  const [year, month, day] = civil.split("-").map(Number);
  const weekday = WEEKDAY.format(new Date(Date.UTC(year, month - 1, day, 12)));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${formatCivilDate(civil)}`;
}

export interface DayGroup<T> {
  /** `YYYY-MM-DD` de São Paulo (ou `''` quando a data do evento é inválida). */
  day: string;
  items: T[];
}

/** Agrupa mantendo a ordem de chegada (o feed já vem do mais recente para o mais antigo). */
export function groupByDay<T extends { occurred_at: string }>(rows: readonly T[]): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const row of rows) {
    const day = civilDayOf(row.occurred_at) ?? "";
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(row);
    else groups.push({ day, items: [row] });
  }
  return groups;
}

/**
 * Hora do evento no fuso do negócio (nunca no do navegador) e o dia de São Paulo a que ele pertence. O agrupamento
 * por dia da linha do tempo é do kit (`groupTimelineByDay`).
 */
import { ADMIN_TIME_ZONE, civilDateInSaoPaulo, EMPTY_TEXT, parseInstant } from "@/lib/admin/format";

const TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: ADMIN_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

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

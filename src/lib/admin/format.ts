/**
 * Formatação do Admin: dinheiro exato, números, datas em America/Sao_Paulo e `AdminFigure`.
 *
 * Regras:
 * - dinheiro é sempre centavos inteiros e sai por inteiro, com centavos (nada de "R$ 1,2 mi"): quem
 *   confere um saldo precisa ver o valor exato;
 * - valor ausente (`null`, `undefined`, `NaN`) nunca vira "0": é "—" (ainda carregando/sem dado) ou
 *   "Não apurado" (`AdminFigure` com `kind: 'unavailable'`, que não existe no banco);
 * - instantes (ISO com hora) são mostrados no fuso do negócio; datas civis (`YYYY-MM-DD`, como os
 *   períodos do contrato) são formatadas como texto, sem passar por `Date`, para não deslocar o dia.
 */
import { formatCivilDatePtBr } from "@/shared/utils/civil-date";
import type { AdminDateRange, AdminFigure } from "@/shared/admin-platform.types";

export const ADMIN_TIME_ZONE = "America/Sao_Paulo";

/** Texto de um número que não existe no banco. */
export const UNAVAILABLE_TEXT = "Não apurado";

/** Texto de um valor que ainda não chegou ou não se aplica. */
export const EMPTY_TEXT = "—";

const NBSP = " ";

const INT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const PERCENT = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const RELATIVE = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

const DATE_TIME_PARTS = new Intl.DateTimeFormat("pt-BR", {
  timeZone: ADMIN_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const CIVIL_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: ADMIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

/**
 * Centavos inteiros → "R$ 1.234,56". Exato (aritmética inteira, sem divisão em ponto flutuante), com
 * centavos e sinal: `-123456` → "-R$ 1.234,56". `null`/`undefined`/`NaN` → "—".
 */
export function formatBRLFromCents(cents: number | null | undefined): string {
  if (!isNumber(cents)) return EMPTY_TEXT;
  const rounded = Math.round(cents);
  const negative = rounded < 0;
  const absolute = BigInt(Math.abs(rounded));
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}R$${NBSP}${INT.format(whole)},${fraction}`;
}

/** Inteiro com separador de milhar: `1234567` → "1.234.567". */
export function formatInt(value: number | null | undefined): string {
  return isNumber(value) ? INT.format(Math.round(value)) : EMPTY_TEXT;
}

/** Percentual em pontos (12,5 → "12,5%"), no máximo 1 casa decimal. */
export function formatPercent(value: number | null | undefined): string {
  return isNumber(value) ? `${PERCENT.format(value)}%` : EMPTY_TEXT;
}

/** `1` → "1 dia", `30` → "30 dias". */
export function formatDays(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY_TEXT;
  return `${INT.format(Math.round(value))} ${Math.round(value) === 1 ? "dia" : "dias"}`;
}

/** Como o `AdminFigure` aparece na tela. `unavailable` nunca vira "0": é "Não apurado". */
export function figureText(figure: AdminFigure | null | undefined): string {
  if (!figure) return EMPTY_TEXT;
  if (figure.kind === "unavailable" || figure.value === null || !Number.isFinite(figure.value)) {
    return UNAVAILABLE_TEXT;
  }
  switch (figure.unit) {
    case "brl_cents":
      return formatBRLFromCents(figure.value);
    case "percent":
      return formatPercent(figure.value);
    case "days":
      return formatDays(figure.value);
    default:
      return formatInt(figure.value);
  }
}

/** `true` quando o número existe (a tela pode mostrá-lo como valor, ordená-lo, somá-lo). */
export function isFigureAvailable(figure: AdminFigure | null | undefined): figure is AdminFigure & { value: number } {
  return !!figure && figure.kind !== "unavailable" && figure.value !== null && Number.isFinite(figure.value);
}

// ---------------------------------------------------------------------------
// Datas e horas
// ---------------------------------------------------------------------------

/** Aceita ISO, timestamp ou `Date`; inválido → `null`. */
export function parseInstant(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateTimeParts(date: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of DATE_TIME_PARTS.formatToParts(date)) out[part.type] = part.value;
  return out;
}

/** Instante → "31/10/2026" (dia no fuso de São Paulo). */
export function formatDate(value: string | number | Date | null | undefined): string {
  const date = parseInstant(value);
  if (!date) return EMPTY_TEXT;
  const p = dateTimeParts(date);
  return `${p.day}/${p.month}/${p.year}`;
}

/** Instante → "31/10/2026 14:05" (fuso de São Paulo). */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const date = parseInstant(value);
  if (!date) return EMPTY_TEXT;
  const p = dateTimeParts(date);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** Data civil `YYYY-MM-DD` → "31/10/2026", sem converter fuso. */
export function formatCivilDate(value: string | null | undefined): string {
  return formatCivilDatePtBr(value) ?? EMPTY_TEXT;
}

/** `YYYY-MM-DD` vira data civil; qualquer outro texto é tratado como instante. */
export function formatDateOrInstant(value: string | null | undefined): string {
  return formatCivilDatePtBr(value) ?? formatDate(value);
}

/** Período do contrato → "01/10/2026 – 31/10/2026" (um dia só: "31/10/2026"). */
export function formatDateRange(range: AdminDateRange): string {
  const from = formatCivilDate(range.from);
  const to = formatCivilDate(range.to);
  return from === to ? from : `${from} – ${to}`;
}

/**
 * "agora", "há 5 minutos", "há 3 horas", "ontem", "há 12 dias"; passados 30 dias, a data. Use junto de
 * `title={formatDateTime(valor)}` para a pessoa ter o instante exato.
 */
export function formatRelativeTime(
  value: string | number | Date | null | undefined,
  now: number | Date = Date.now(),
): string {
  const date = parseInstant(value);
  if (!date) return EMPTY_TEXT;
  const diff = date.getTime() - (typeof now === "number" ? now : now.getTime());
  if (Math.abs(diff) < 45_000) return "agora";
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 60) return RELATIVE.format(minutes, "minute");
  const hours = Math.round(diff / 3_600_000);
  if (Math.abs(hours) < 24) return RELATIVE.format(hours, "hour");
  const days = Math.round(diff / 86_400_000);
  if (Math.abs(days) < 30) return RELATIVE.format(days, "day");
  return formatDate(date);
}

/** Dia civil (`YYYY-MM-DD`) de um instante, no fuso de São Paulo. */
export function civilDateInSaoPaulo(value: Date | number = Date.now()): string {
  const parts: Record<string, string> = {};
  for (const part of CIVIL_PARTS.formatToParts(value)) parts[part.type] = part.value;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Período do Financeiro e das Atividades: dias civis de São Paulo, no formato do contrato.
 *
 * Regras (as do contrato, `AdminDateRange`): `from`/`to` são `YYYY-MM-DD`, `to` inclusivo; sem nada o
 * servidor usa os últimos 30 dias CONTANDO hoje (de hoje-29 até hoje); o intervalo máximo é de 366 dias,
 * contando as duas pontas. A tela sempre manda `from` e `to` explícitos: nunca depende do padrão do servidor.
 *
 * A conta é feita sobre datas civis em UTC (`Date.UTC`), sem passar pelo fuso do navegador: "hoje" vem de
 * `civilDateInSaoPaulo()` e o resto é aritmética de calendário, então 31/10 às 22h em São Paulo é 31/10.
 */
import type { AdminDateRange } from "@/shared/admin-platform.types";

export const PERIOD_MAX_DAYS = 366;
export const PERIOD_DEFAULT_DAYS = 30;

const DAY_MS = 86_400_000;
const CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtc(civil: string): number | null {
  const match = CIVIL.exec(civil);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  // `Date.UTC` aceita 31/02 e rola para março: só vale a data que volta igual.
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return utc;
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** `true` para uma data civil real (`2026-02-30` não é). */
export function isCivilDate(value: unknown): value is string {
  return typeof value === "string" && toUtc(value) !== null;
}

/** Soma (ou subtrai) dias a uma data civil. */
export function addCivilDays(civil: string, days: number): string {
  const utc = toUtc(civil);
  if (utc === null) throw new RangeError(`Data civil inválida: ${civil}`);
  return fromUtc(utc + days * DAY_MS);
}

/** Quantos dias o período tem, contando as duas pontas (`01/10` a `01/10` = 1). */
export function periodDays(period: AdminDateRange): number {
  const from = toUtc(period.from);
  const to = toUtc(period.to);
  if (from === null || to === null) return 0;
  return Math.round((to - from) / DAY_MS) + 1;
}

function firstDayOfMonth(civil: string): string {
  return `${civil.slice(0, 7)}-01`;
}

function lastDayOfPreviousMonth(civil: string): string {
  return addCivilDays(firstDayOfMonth(civil), -1);
}

export type PeriodPresetId = "7d" | "30d" | "90d" | "month" | "last-month" | "year";

export interface PeriodPreset {
  id: PeriodPresetId;
  label: string;
  range: (today: string) => AdminDateRange;
}

/** Atalhos do seletor. Todos terminam hoje, menos "Mês passado". Nenhum passa de 366 dias. */
export const PERIOD_PRESETS: readonly PeriodPreset[] = [
  { id: "7d", label: "7 dias", range: (today) => ({ from: addCivilDays(today, -6), to: today }) },
  { id: "30d", label: "30 dias", range: (today) => defaultPeriod(today) },
  { id: "90d", label: "90 dias", range: (today) => ({ from: addCivilDays(today, -89), to: today }) },
  { id: "month", label: "Este mês", range: (today) => ({ from: firstDayOfMonth(today), to: today }) },
  {
    id: "last-month",
    label: "Mês passado",
    range: (today) => {
      const to = lastDayOfPreviousMonth(today);
      return { from: firstDayOfMonth(to), to };
    },
  },
  { id: "year", label: "Este ano", range: (today) => ({ from: `${today.slice(0, 4)}-01-01`, to: today }) },
];

/** O período que a tela abre: 30 dias terminando hoje (o mesmo padrão do servidor). */
export function defaultPeriod(today: string): AdminDateRange {
  return { from: addCivilDays(today, -(PERIOD_DEFAULT_DAYS - 1)), to: today };
}

export function isDefaultPeriod(period: AdminDateRange, today: string): boolean {
  const fallback = defaultPeriod(today);
  return period.from === fallback.from && period.to === fallback.to;
}

/** Qual atalho descreve este período; `null` quando é um intervalo personalizado. */
export function detectPreset(period: AdminDateRange, today: string): PeriodPresetId | null {
  for (const preset of PERIOD_PRESETS) {
    const range = preset.range(today);
    if (range.from === period.from && range.to === period.to) return preset.id;
  }
  return null;
}

/**
 * Período efetivo a partir do que a URL traz (a barra de endereço é entrada de usuário). As mesmas regras do
 * servidor: sem nada, os 30 dias que terminam hoje; só `to`, os 30 dias que terminam nele; só `from`, de
 * `from` até hoje. Data inválida, intervalo invertido ou mais de 366 dias voltam ao padrão. Nunca passa de hoje.
 */
export function resolvePeriod(raw: { from?: unknown; to?: unknown }, today: string): AdminDateRange {
  const rawTo = isCivilDate(raw.to) ? raw.to : undefined;
  const rawFrom = isCivilDate(raw.from) ? raw.from : undefined;
  const to = rawTo && rawTo < today ? rawTo : today;
  const from = rawFrom ?? addCivilDays(to, -(PERIOD_DEFAULT_DAYS - 1));
  const period = { from, to };
  if (from > to || periodDays(period) > PERIOD_MAX_DAYS) return defaultPeriod(today);
  return period;
}

/**
 * Edição dos campos de data do período personalizado. Devolve sempre um período válido: o outro limite
 * acompanha quando o intervalo ficaria invertido ou passaria de 366 dias, e nada passa de hoje.
 */
export function adjustCustomRange(
  change: { from?: string; to?: string },
  current: AdminDateRange,
  today: string,
): AdminDateRange {
  const cap = (date: string) => (date > today ? today : date);
  if (change.from !== undefined && isCivilDate(change.from)) {
    const from = cap(change.from);
    let to = current.to < from ? from : current.to;
    if (periodDays({ from, to }) > PERIOD_MAX_DAYS) to = cap(addCivilDays(from, PERIOD_MAX_DAYS - 1));
    return { from, to };
  }
  if (change.to !== undefined && isCivilDate(change.to)) {
    const to = cap(change.to);
    let from = current.from > to ? to : current.from;
    if (periodDays({ from, to }) > PERIOD_MAX_DAYS) from = addCivilDays(to, -(PERIOD_MAX_DAYS - 1));
    return { from, to };
  }
  return current;
}

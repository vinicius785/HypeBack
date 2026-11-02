/**
 * Período do Dashboard do Admin: os predefinidos (7 dias, 30 dias, 90 dias, 6 meses, Este ano) e o personalizado,
 * sempre em DIAS DE SÃO PAULO. O contrato manda `from`/`to` como `YYYY-MM-DD`, com `to` inclusivo.
 *
 * Regras:
 * - 7, 30 e 90 dias são os últimos N dias CONTANDO hoje (de hoje-(N-1) até hoje), o mesmo padrão do servidor, que
 *   sem `from`/`to` usa os últimos 30 dias contando hoje;
 * - 6 meses são os últimos 6 meses de calendário terminando hoje: do dia seguinte a "hoje menos 6 meses" até hoje
 *   (hoje 31/10 → 01/05 a 31/10; hoje 15/10 → 16/04 a 15/10). Mês que não tem o dia usa o último dia dele;
 * - Este ano é 1º de janeiro até hoje;
 * - personalizado vai no máximo até hoje (período futuro não existe) e tem no máximo 366 dias contando as duas pontas
 *   (o limite do contrato). Se a pessoa inverter as datas ou estourar o limite, a ponta que ela NÃO mexeu acompanha;
 * - toda a conta é feita sobre o texto `YYYY-MM-DD` (via UTC, sem `Date` local): o fuso da máquina nunca muda o dia.
 *   O "hoje" vem do relógio no fuso de São Paulo, então o dia vira à meia-noite de lá, não à da máquina.
 */
import type { AdminDateRange } from "@/shared/admin-platform.types";

import { civilDateInSaoPaulo, formatDateRange } from "./format";

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

export const PERIOD_PRESETS = ["7d", "30d", "90d", "6m", "year"] as const;
export type AdminPeriodPreset = (typeof PERIOD_PRESETS)[number];
export type AdminPeriodChoice = AdminPeriodPreset | "custom";

export const DEFAULT_PERIOD_PRESET: AdminPeriodPreset = "30d";

/** Limite do contrato: o intervalo máximo é de 366 dias, contando as duas pontas. */
export const MAX_PERIOD_DAYS = 366;

export const PERIOD_LABEL: Record<AdminPeriodChoice, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  "6m": "6 meses",
  year: "Este ano",
  custom: "Personalizado",
};

/** Opções na ordem em que aparecem no seletor. */
export const PERIOD_OPTIONS: ReadonlyArray<{ value: AdminPeriodChoice; label: string }> = [
  ...PERIOD_PRESETS.map((value) => ({ value, label: PERIOD_LABEL[value] })),
  { value: "custom", label: PERIOD_LABEL.custom },
];

/** Período já resolvido: o que a pessoa escolheu e os dias de São Paulo que isso vira. */
export interface AdminPeriod extends AdminDateRange {
  preset: AdminPeriodChoice;
}

export function isPeriodPreset(value: unknown): value is AdminPeriodPreset {
  return typeof value === "string" && (PERIOD_PRESETS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Conta com dias civis (`YYYY-MM-DD`)
// ---------------------------------------------------------------------------

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Meia-noite UTC do dia civil. `setUTCFullYear` evita que os anos 0–99 virem 1900–1999. */
function utcMs(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime();
}

function parseCivil(date: string): { year: number; month: number; day: number } | null {
  const match = CIVIL_DATE.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(utcMs(year, month, day));
  // 30/02 e afins "rolam" para o mês seguinte: não são datas.
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

function mustParse(date: string): { year: number; month: number; day: number } {
  const parts = parseCivil(date);
  if (!parts) throw new RangeError(`Data civil inválida: "${date}"`);
  return parts;
}

function formatCivil(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** `true` para uma data do calendário em `YYYY-MM-DD` (rejeita `2026-02-30` e `2026-1-5`). */
export function isCivilDate(value: unknown): value is string {
  return typeof value === "string" && parseCivil(value) !== null;
}

/** Soma (ou subtrai) dias a um dia civil. */
export function addCivilDays(date: string, days: number): string {
  const { year, month, day } = mustParse(date);
  return formatCivil(utcMs(year, month, day) + Math.round(days) * DAY_MS);
}

/** Soma (ou subtrai) meses a um dia civil; o dia que não existe no mês de destino vira o último dia dele. */
export function addCivilMonths(date: string, months: number): string {
  const parts = mustParse(date);
  const index = parts.year * 12 + (parts.month - 1) + Math.round(months);
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  const lastDay = new Date(utcMs(year, month + 1, 0)).getUTCDate();
  return formatCivil(utcMs(year, month, Math.min(parts.day, lastDay)));
}

/** Quantos dias o intervalo tem contando as duas pontas (mesmo dia → 1; `to` antes de `from` → 0 ou menos). */
export function countCivilDays(from: string, to: string): number {
  const a = mustParse(from);
  const b = mustParse(to);
  return Math.round((utcMs(b.year, b.month, b.day) - utcMs(a.year, a.month, a.day)) / DAY_MS) + 1;
}

// ---------------------------------------------------------------------------
// Predefinidos, personalizado e período resolvido
// ---------------------------------------------------------------------------

/** O dia de hoje em São Paulo (`YYYY-MM-DD`). */
export function todayInSaoPaulo(now: Date | number = Date.now()): string {
  return civilDateInSaoPaulo(now);
}

/** Dias de São Paulo de um predefinido, dado o dia de hoje. */
export function resolvePreset(preset: AdminPeriodPreset, today: string): AdminDateRange {
  switch (preset) {
    case "7d":
      return { from: addCivilDays(today, -6), to: today };
    case "30d":
      return { from: addCivilDays(today, -29), to: today };
    case "90d":
      return { from: addCivilDays(today, -89), to: today };
    case "6m":
      return { from: addCivilDays(addCivilMonths(today, -6), 1), to: today };
    case "year":
      return { from: `${mustParse(today).year.toString().padStart(4, "0")}-01-01`, to: today };
  }
}

/**
 * Intervalo personalizado dentro das regras (até hoje, no máximo 366 dias, `from` ≤ `to`), ou `null` se alguma das
 * datas não for uma data civil. `edited` é a ponta que a pessoa acabou de mexer: quando o intervalo fica invertido
 * ou longo demais, a outra ponta é que se ajusta.
 */
export function normalizeCustomRange(
  range: { from?: string | null; to?: string | null },
  today: string,
  edited: "from" | "to" = "to",
): AdminDateRange | null {
  if (!isCivilDate(range.from) || !isCivilDate(range.to) || !isCivilDate(today)) return null;
  let from = range.from;
  let to = range.to;
  if (to > today) to = today;
  if (from > today) from = today;
  if (from > to) {
    if (edited === "from") to = from;
    else from = to;
  }
  if (countCivilDays(from, to) > MAX_PERIOD_DAYS) {
    if (edited === "from") to = addCivilDays(from, MAX_PERIOD_DAYS - 1);
    else from = addCivilDays(to, -(MAX_PERIOD_DAYS - 1));
  }
  return { from, to };
}

export interface AdminPeriodSelection {
  preset?: AdminPeriodChoice | null;
  from?: string | null;
  to?: string | null;
}

/**
 * O período a consultar, dado o dia de hoje (`YYYY-MM-DD`, de São Paulo). Sem escolha (ou com um personalizado
 * inválido) é o padrão: 30 dias.
 */
export function resolvePeriodForDay(selection: AdminPeriodSelection, today: string): AdminPeriod {
  if (selection.preset === "custom") {
    const range = normalizeCustomRange({ from: selection.from, to: selection.to }, today);
    if (range) return { preset: "custom", ...range };
  } else if (isPeriodPreset(selection.preset)) {
    return { preset: selection.preset, ...resolvePreset(selection.preset, today) };
  }
  return { preset: DEFAULT_PERIOD_PRESET, ...resolvePreset(DEFAULT_PERIOD_PRESET, today) };
}

/** O mesmo, descobrindo o dia de hoje em São Paulo a partir de um instante (`now`). */
export function resolvePeriod(selection: AdminPeriodSelection = {}, now: Date | number = Date.now()): AdminPeriod {
  return resolvePeriodForDay(selection, todayInSaoPaulo(now));
}

// ---------------------------------------------------------------------------
// URL da tela (`?period=90d`, `?period=custom&from=2026-10-01&to=2026-10-15`)
// ---------------------------------------------------------------------------

/** O que a URL do Dashboard guarda do período. Ausente = padrão (30 dias), que não aparece na URL. */
export interface AdminPeriodSearch {
  period?: AdminPeriodChoice;
  from?: string;
  to?: string;
}

/** Lê o período da busca da URL, ignorando o que for inválido ou igual ao padrão (a barra de endereço é entrada de usuário). */
export function readPeriodSearch(raw: Record<string, unknown>): AdminPeriodSearch {
  const period = raw.period;
  if (period === "custom") {
    const from = raw.from;
    const to = raw.to;
    return isCivilDate(from) && isCivilDate(to) ? { period: "custom", from, to } : {};
  }
  return isPeriodPreset(period) && period !== DEFAULT_PERIOD_PRESET ? { period } : {};
}

/** O oposto de `readPeriodSearch`: o período vira o objeto de busca da URL, sem o que é padrão. */
export function periodToSearch(period: AdminPeriodSelection & { preset: AdminPeriodChoice }): AdminPeriodSearch {
  if (period.preset === "custom") {
    return isCivilDate(period.from) && isCivilDate(period.to) ? { period: "custom", from: period.from, to: period.to } : {};
  }
  return period.preset === DEFAULT_PERIOD_PRESET ? {} : { period: period.preset };
}

// ---------------------------------------------------------------------------
// Consultas e textos
// ---------------------------------------------------------------------------

/** Parâmetros `from`/`to` das consultas da API (`/admin/overview`, `/admin/financial/...`). */
export function periodQuery(range: AdminDateRange): { from: string; to: string } {
  return { from: range.from, to: range.to };
}

/** O mesmo em texto de URL, sem o `?`: `from=2026-10-01&to=2026-10-31`. */
export function periodQueryString(range: AdminDateRange): string {
  return new URLSearchParams(periodQuery(range)).toString();
}

/** Filtro "criado no período" das listas (`created_from`/`created_to`, os nomes do contrato). */
export function createdInPeriodFilter(range: AdminDateRange): { created_from: string; created_to: string } {
  return { created_from: range.from, created_to: range.to };
}

/** "01/10/2026 – 31/10/2026" (um dia só: "31/10/2026"). */
export function formatPeriodRange(range: AdminDateRange): string {
  return formatDateRange(range);
}

/** "Últimos 30 dias", "Últimos 6 meses", "Este ano (2026)", "Período personalizado". */
export function periodLabel(period: AdminPeriod): string {
  switch (period.preset) {
    case "7d":
    case "30d":
    case "90d":
      return `Últimos ${PERIOD_LABEL[period.preset]}`;
    case "6m":
      return "Últimos 6 meses";
    case "year":
      return `Este ano (${period.to.slice(0, 4)})`;
    case "custom":
      return "Período personalizado";
  }
}

/** Rótulo e dias juntos: "Últimos 30 dias: 02/10/2026 – 31/10/2026". */
export function describePeriod(period: AdminPeriod): string {
  return `${periodLabel(period)}: ${formatPeriodRange(period)}`;
}

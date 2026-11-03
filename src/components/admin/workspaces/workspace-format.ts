/**
 * Formatação e períodos da tela de Workspaces do Admin: CNPJ, CEP, endereço e dias civis de São Paulo.
 * Funções puras, sem React, para testar sem montar tela.
 */
import { formatDateTime } from "@/lib/admin/format";
import type { AdminDateRange, AdminWorkspaceAddress } from "@/shared/admin-platform.types";

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** 14 dígitos → "12.345.678/0001-90". Qualquer outro valor volta como veio: a tela não inventa máscara. */
export function formatCnpj(value: string | null | undefined): string {
  const digits = digitsOnly(value);
  if (digits.length !== 14) return (value ?? "").trim();
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** 8 dígitos → "12345-678". Qualquer outro valor volta como veio. */
export function formatCep(value: string | null | undefined): string {
  const digits = digitsOnly(value);
  if (digits.length !== 8) return (value ?? "").trim();
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Identificador curto para a lista: os 8 últimos caracteres do `public_id`. É um trecho do uuid, então a
 * busca da lista (que casa o `public_id`) o encontra; o uuid inteiro fica na dica do campo.
 */
export function shortPublicId(id: string): string {
  return id.replace(/-/g, "").slice(-8);
}

/** Linhas do endereço, só as que têm conteúdo: "Rua A, 123 · Sala 4", "Bairro", "Cidade/UF", "CEP 12345-678". */
export function addressLines(address: AdminWorkspaceAddress): string[] {
  const clean = (value: string | null) => value?.trim() ?? "";
  const street = [clean(address.street), clean(address.street_number)].filter(Boolean).join(", ");
  const first = [street, clean(address.unit)].filter(Boolean).join(" · ");
  const city = [clean(address.city), clean(address.state)].filter(Boolean).join("/");
  const cep = clean(address.postal_code) ? `CEP ${formatCep(address.postal_code)}` : "";
  return [first, clean(address.neighborhood), city, cep].filter(Boolean);
}

// ---------------------------------------------------------------------------
// Dias civis (YYYY-MM-DD, São Paulo)
// ---------------------------------------------------------------------------

/** O contrato limita o período a 366 dias, contando as duas pontas. */
export const MAX_PERIOD_DAYS = 366;

const CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidCivilDate(value: string | null | undefined): value is string {
  const match = CIVIL.exec(value ?? "");
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function toCivil(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Soma (ou subtrai) dias a um dia civil, sem passar por fuso: `("2026-03-01", -1)` → `"2026-02-28"`. */
export function shiftCivilDate(date: string, days: number): string {
  const match = CIVIL.exec(date);
  if (!match) return date;
  return toCivil(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days)));
}

export type PeriodPreset = "7d" | "30d" | "90d";

export const PERIOD_PRESET_DAYS: Record<PeriodPreset, number> = { "7d": 7, "30d": 30, "90d": 90 };

/** Últimos N dias contando hoje (o mesmo critério do servidor quando `from`/`to` são omitidos: 30 dias). */
export function presetRange(preset: PeriodPreset, today: string): AdminDateRange {
  return { from: shiftCivilDate(today, -(PERIOD_PRESET_DAYS[preset] - 1)), to: today };
}

/** Qual atalho descreve o período; `null` quando é um intervalo personalizado. */
export function detectPreset(range: AdminDateRange, today: string): PeriodPreset | null {
  for (const preset of Object.keys(PERIOD_PRESET_DAYS) as PeriodPreset[]) {
    const candidate = presetRange(preset, today);
    if (candidate.from === range.from && candidate.to === range.to) return preset;
  }
  return null;
}

/** Instante → "14:05" (hora de São Paulo), para eventos já agrupados por dia; inválido → "—". */
export function timeOfDay(value: string | number | Date | null | undefined): string {
  const text = formatDateTime(value);
  return text.split(" ")[1] ?? text;
}

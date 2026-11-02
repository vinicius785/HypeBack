/**
 * Parâmetros da URL do Financeiro (`/admin/financial?tab=movements&type=withdrawal&from=…&to=…`).
 *
 * A barra de endereço é entrada de usuário (e a Saúde da plataforma linka para cá com `type`): tudo é
 * revalidado e o que não vale é descartado. Chaves que são o padrão não vão para a URL.
 */
import {
  createAdminListSearchValidator,
  type AdminListSearch,
  type AdminListStateConfig,
} from "@/lib/admin/list-query";
import type { AdminMovementType } from "@/shared/admin-platform.types";

import { isCivilDate } from "./financial-period";

export const FINANCIAL_TABS = ["overview", "movements", "by-workspace"] as const;
export type FinancialTab = (typeof FINANCIAL_TABS)[number];

export const FINANCIAL_TAB_LABEL: Record<FinancialTab, string> = {
  overview: "Visão geral",
  movements: "Movimentações",
  "by-workspace": "Por workspace",
};

/** Tipos de movimentação aceitos no filtro (o "todas" é a ausência do filtro). */
export const MOVEMENT_FILTER_TYPES = ["charge", "ledger_entry", "withdrawal", "transfer"] as const satisfies readonly AdminMovementType[];

export function isMovementType(value: unknown): value is AdminMovementType {
  return typeof value === "string" && (MOVEMENT_FILTER_TYPES as readonly string[]).includes(value);
}

/** Chaves de ordenação da distribuição por workspace (`sort_by` do contrato). */
export const BY_WORKSPACE_SORT_KEYS = ["funded", "custody", "committed", "released", "name"] as const;

/** Estado da lista "Por workspace" na URL: ordena por aportes, do maior para o menor. */
export const BY_WORKSPACE_LIST_CONFIG = {
  sortKeys: BY_WORKSPACE_SORT_KEYS,
  defaultSortBy: "funded",
  defaultOrder: "desc",
} as const satisfies AdminListStateConfig;

/** Filtros da aba Movimentações na URL (o período é de todas as abas). */
export const MOVEMENTS_FILTER_CONFIG = {
  filterKeys: ["type", "workspace_id"],
} as const satisfies AdminListStateConfig<"type" | "workspace_id">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isWorkspaceId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export type FinancialSearch = AdminListSearch & {
  tab?: Exclude<FinancialTab, "overview">;
  from?: string;
  to?: string;
  type?: AdminMovementType;
  workspace_id?: string;
};

const listValidator = createAdminListSearchValidator(BY_WORKSPACE_LIST_CONFIG);

function text(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/**
 * Aba da URL. Sem `tab` mas com filtro de movimentação (`type`/`workspace_id`, como no "Ver todos" dos alertas da
 * Saúde da plataforma), a aba é Movimentações: quem chega por um link de filtro quer a lista filtrada.
 */
export function readFinancialTab(raw: Record<string, unknown>): FinancialTab {
  const tab = text(raw.tab);
  if (tab && (FINANCIAL_TABS as readonly string[]).includes(tab)) return tab as FinancialTab;
  if (isMovementType(text(raw.type)) || isWorkspaceId(text(raw.workspace_id))) return "movements";
  return "overview";
}

/** `validateSearch` da rota: só o que é válido e diferente do padrão. */
export function validateFinancialSearch(raw: Record<string, unknown>): FinancialSearch {
  const out: FinancialSearch = { ...listValidator(raw) };
  const tab = readFinancialTab(raw);
  if (tab !== "overview") out.tab = tab;
  const from = text(raw.from);
  const to = text(raw.to);
  if (isCivilDate(from)) out.from = from;
  if (isCivilDate(to)) out.to = to;
  const type = text(raw.type);
  if (isMovementType(type)) out.type = type;
  const workspaceId = text(raw.workspace_id);
  if (isWorkspaceId(workspaceId)) out.workspace_id = workspaceId;
  return out;
}

/**
 * Consultas do Financeiro global (`/admin/financial/*`). A política de cache e de erro é a do Admin
 * (`use-admin-queries.ts`); aqui só ficam os caminhos, os parâmetros e a chave de cada consulta.
 *
 * Todas as chaves começam por `['admin', 'platform', 'financial', …]`: `adminKeys.resource('financial')`
 * invalida ou atualiza tudo do Financeiro de uma vez ("Atualizar").
 */
import { useMemo } from "react";

import type { AdminQuery } from "@/lib/admin/admin-client";
import type {
  AdminDateRange,
  AdminFinancialByWorkspaceRow,
  AdminFinancialMovement,
  AdminFinancialSummary,
  AdminMovementType,
} from "@/shared/admin-platform.types";

import { useAdminFeed, useAdminItem, useAdminList } from "./use-admin-queries";

export const ADMIN_FINANCIAL_RESOURCE = "financial";
/** Movimentações por página do feed (o contrato aceita até 100; o padrão do servidor é 50). */
export const ADMIN_MOVEMENTS_PAGE_SIZE = 50;

/** Números do período: aportes, custódia, criadores, PIX, plataforma e as conferências. */
export function useAdminFinancialSummary(period: AdminDateRange) {
  return useAdminItem<AdminFinancialSummary>({
    resource: ADMIN_FINANCIAL_RESOURCE,
    scope: ["summary"],
    path: "/admin/financial/summary",
    params: { from: period.from, to: period.to },
  });
}

export interface AdminMovementsFilters {
  /** `''` = todas (o filtro nem é enviado). */
  type: AdminMovementType | "";
  /** `public_id` do workspace; `''` = todos. */
  workspaceId: string;
  period: AdminDateRange;
}

/** Une as páginas do feed sem repetir o mesmo `id` (vale a primeira aparição). */
export function mergeFeedPages<T extends { id: string }>(pages: ReadonlyArray<{ data: readonly T[] }> | undefined): T[] {
  const seen = new Set<string>();
  const rows: T[] = [];
  for (const page of pages ?? []) {
    for (const row of page.data) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }
  return rows;
}

/** Feed de movimentações por cursor, mais recentes primeiro. `rows` já vem sem repetições. */
export function useAdminFinancialMovements(filters: AdminMovementsFilters) {
  const params: AdminQuery = {
    workspace_id: filters.workspaceId || undefined,
    type: filters.type || undefined,
    from: filters.period.from,
    to: filters.period.to,
    limit: ADMIN_MOVEMENTS_PAGE_SIZE,
  };
  const query = useAdminFeed<AdminFinancialMovement>({
    resource: ADMIN_FINANCIAL_RESOURCE,
    scope: ["movements"],
    path: "/admin/financial/movements",
    params,
  });
  const rows = useMemo(() => mergeFeedPages(query.data?.pages), [query.data]);
  return { query, rows };
}

/** Distribuição por workspace, com a linha "não atribuído" quando há valores sem workspace. */
export function useAdminFinancialByWorkspace(params: AdminQuery) {
  return useAdminList<AdminFinancialByWorkspaceRow>({
    resource: ADMIN_FINANCIAL_RESOURCE,
    scope: ["by-workspace"],
    path: "/admin/financial/by-workspace",
    params,
  });
}

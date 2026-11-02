/**
 * Consultas das Atividades: o feed global por cursor (`/admin/activity`) e o log de alterações administrativas
 * (`/admin/audit-log`). Política de cache e de erro do Admin (`use-admin-queries.ts`).
 *
 * Os dois são trilhas: o que acabou de acontecer precisa aparecer ao abrir a tela, então o `staleTime` é curto
 * (outra tela do Admin acabou de gravar uma alteração e a lista em cache não pode escondê-la).
 */
import { useMemo } from "react";

import type { AdminQuery } from "@/lib/admin/admin-client";
import type {
  AdminActivityEvent,
  AdminActivityKind,
  AdminAuditLogEntry,
  AdminDateRange,
} from "@/shared/admin-platform.types";

import { mergeFeedPages } from "./use-admin-financial";
import { useAdminFeed, useAdminList } from "./use-admin-queries";

export const ADMIN_ACTIVITY_RESOURCE = "activity";
export const ADMIN_AUDIT_RESOURCE = "audit";
/** Eventos por página do feed (o contrato aceita até 100; o padrão do servidor é 50). */
export const ADMIN_ACTIVITY_PAGE_SIZE = 50;
const TRAIL_STALE_MS = 5_000;

export interface AdminActivityFilters {
  /** `''` = todos os tipos (o filtro nem é enviado). */
  kind: AdminActivityKind | "";
  /** `public_id` do workspace; `''` = todos. */
  workspaceId: string;
  period: AdminDateRange;
}

/** Feed de atividade, mais recentes primeiro. `rows` já vem sem repetições. */
export function useAdminActivityFeed(filters: AdminActivityFilters) {
  const params: AdminQuery = {
    kind: filters.kind || undefined,
    workspace_id: filters.workspaceId || undefined,
    from: filters.period.from,
    to: filters.period.to,
    limit: ADMIN_ACTIVITY_PAGE_SIZE,
  };
  const query = useAdminFeed<AdminActivityEvent>({
    resource: ADMIN_ACTIVITY_RESOURCE,
    path: "/admin/activity",
    params,
    staleTime: TRAIL_STALE_MS,
  });
  const rows = useMemo(() => mergeFeedPages(query.data?.pages), [query.data]);
  return { query, rows };
}

/** Log de alterações administrativas, por página (`params` já leva página, filtros e período). */
export function useAdminAuditLog(params: AdminQuery) {
  return useAdminList<AdminAuditLogEntry>({
    resource: ADMIN_AUDIT_RESOURCE,
    path: "/admin/audit-log",
    params,
    staleTime: TRAIL_STALE_MS,
  });
}

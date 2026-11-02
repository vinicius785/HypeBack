/**
 * Consultas do módulo Workspaces do Admin (`/admin/workspaces*`). A política de cache e de erro é a de
 * `use-admin-queries.ts`; aqui só ficam os caminhos, as chaves e o que cada seção carrega.
 *
 * Todas as chaves começam por `['admin', 'platform', 'workspaces', ...]`, então
 * `adminKeys.resource('workspaces')` pega lista, detalhe, membros, campanhas, financeiro, atividade e impacto
 * de uma vez. As seções do detalhe só consultam quando a aba abre (`enabled`).
 */
import { useQuery } from "@tanstack/react-query";

import { adminGet, adminPath, type AdminQuery } from "@/lib/admin/admin-client";
import type {
  AdminActivityEvent,
  AdminAuditLogEntry,
  AdminCampaignListItem,
  AdminDateRange,
  AdminFinancialMovement,
  AdminMovementType,
  AdminWorkspaceDetail,
  AdminWorkspaceFinancial,
  AdminWorkspaceImpact,
  AdminWorkspaceListItem,
  AdminWorkspaceMember,
} from "@/shared/admin-platform.types";

import { adminKeys } from "./admin-query-keys";
import { adminRetry, useAdminFeed, useAdminItem, useAdminList } from "./use-admin-queries";

export const WORKSPACES_RESOURCE = "workspaces";

/** Chave do detalhe: as mutações gravam a resposta (o workspace já no novo estado) direto nela. */
export function workspaceDetailKey(workspaceId: string) {
  return adminKeys.detail(WORKSPACES_RESOURCE, workspaceId);
}

export function useAdminWorkspaceList(params: AdminQuery) {
  return useAdminList<AdminWorkspaceListItem>({
    resource: WORKSPACES_RESOURCE,
    path: "/admin/workspaces",
    params,
  });
}

export function useAdminWorkspace(workspaceId: string) {
  return useAdminItem<AdminWorkspaceDetail>({
    resource: WORKSPACES_RESOURCE,
    id: workspaceId,
    path: adminPath`/admin/workspaces/${workspaceId}`,
    queryKey: workspaceDetailKey(workspaceId),
  });
}

/** Membros do workspace (`per_page` padrão 100: a lista de um workspace é curta). */
export function useAdminWorkspaceMembers(workspaceId: string, params: AdminQuery, enabled = true) {
  return useAdminList<AdminWorkspaceMember>({
    resource: WORKSPACES_RESOURCE,
    scope: ["members", workspaceId],
    path: adminPath`/admin/workspaces/${workspaceId}/members`,
    params,
    enabled,
  });
}

export function useAdminWorkspaceCampaigns(workspaceId: string, params: AdminQuery, enabled = true) {
  return useAdminList<AdminCampaignListItem>({
    resource: WORKSPACES_RESOURCE,
    scope: ["campaigns", workspaceId],
    path: adminPath`/admin/workspaces/${workspaceId}/campaigns`,
    params,
    enabled,
  });
}

/** Números financeiros do workspace no período (dias de São Paulo, `to` inclusivo). */
export function useAdminWorkspaceFinancial(workspaceId: string, period: AdminDateRange, enabled = true) {
  return useAdminItem<AdminWorkspaceFinancial>({
    resource: WORKSPACES_RESOURCE,
    id: workspaceId,
    scope: ["financial"],
    path: adminPath`/admin/workspaces/${workspaceId}/financial`,
    params: { from: period.from, to: period.to },
    enabled,
  });
}

/** Movimentações do workspace no período, mais recentes primeiro, por cursor. */
export function useAdminWorkspaceMovements(
  workspaceId: string,
  period: AdminDateRange,
  type: AdminMovementType | "all",
  enabled = true,
) {
  return useAdminFeed<AdminFinancialMovement>({
    resource: WORKSPACES_RESOURCE,
    scope: ["movements", workspaceId],
    path: "/admin/financial/movements",
    params: { workspace_id: workspaceId, from: period.from, to: period.to, type: type === "all" ? undefined : type },
    enabled,
  });
}

/** Linha do tempo do workspace por cursor; `onlyAdminActions` pede só as ações administrativas. */
export function useAdminWorkspaceActivity(workspaceId: string, onlyAdminActions: boolean, enabled = true) {
  return useAdminFeed<AdminActivityEvent>({
    resource: WORKSPACES_RESOURCE,
    scope: ["activity", workspaceId],
    path: adminPath`/admin/workspaces/${workspaceId}/activity`,
    params: { kind: onlyAdminActions ? "admin_action" : undefined },
    enabled,
  });
}

/**
 * Registros da auditoria do workspace num dia de São Paulo: é de onde vem o "antes e depois" de uma ação
 * administrativa da linha do tempo. Só consulta quando alguém expande uma ação (`enabled`), e uma consulta
 * por dia serve a todas as ações daquele dia.
 */
export function useAdminWorkspaceAuditDay(workspaceId: string, day: string, enabled: boolean) {
  return useAdminList<AdminAuditLogEntry>({
    resource: "audit",
    scope: ["workspace", workspaceId],
    path: "/admin/audit-log",
    params: { workspace_id: workspaceId, from: day, to: day, per_page: 100 },
    enabled,
  });
}

/**
 * Resumo de impacto (contagens, dinheiro, impedimentos, consequências e `impact_token`). Sempre fresco:
 * não fica em cache depois que o diálogo fecha (`gcTime: 0`) e não é reaproveitado como "ainda válido"
 * (`staleTime: 0`), porque o token assina o estado de agora e vale 10 minutos.
 */
export function useAdminWorkspaceImpact(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.detail(WORKSPACES_RESOURCE, workspaceId, ["impact"]),
    queryFn: ({ signal }) =>
      adminGet<AdminWorkspaceImpact>(adminPath`/admin/workspaces/${workspaceId}/impact`, undefined, { signal }),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: adminRetry,
    refetchOnWindowFocus: false,
  });
}

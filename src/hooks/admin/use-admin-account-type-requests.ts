/**
 * Pedidos de troca do tipo de conta no Admin: lista (pendentes ou histórico), detalhe com o histórico do workspace
 * e as decisões (aprovar e rejeitar, cada uma com `Idempotency-Key`). Rotas: `/admin/workspace-account-type-requests`.
 */
import { adminPost, adminPath } from "@/lib/admin/admin-client";
import type { AccountTypeRequest } from "@/shared/services/account-type-requests";

import { adminKeys } from "./admin-query-keys";
import { useAdminMutation } from "./use-admin-mutation";
import { useAdminItem, useAdminList } from "./use-admin-queries";

export const ADMIN_ACCOUNT_REQUESTS_RESOURCE = "account-type-requests";
export type AccountRequestFilter = "pending" | "decided";

export function useAdminAccountTypeRequests(params: { status: AccountRequestFilter; q?: string; page: number; per_page: number }) {
  return useAdminList<AccountTypeRequest>({
    resource: ADMIN_ACCOUNT_REQUESTS_RESOURCE,
    path: "/admin/workspace-account-type-requests",
    params,
  });
}

export interface AccountTypeRequestDetail {
  request: AccountTypeRequest;
  history: AccountTypeRequest[];
}

export function useAdminAccountTypeRequest(requestId: string | null) {
  return useAdminItem<AccountTypeRequestDetail>({
    resource: ADMIN_ACCOUNT_REQUESTS_RESOURCE,
    id: requestId ?? "",
    path: requestId ? adminPath`/admin/workspace-account-type-requests/${requestId}` : "",
    enabled: !!requestId,
  });
}

const AFTER_DECISION = [
  adminKeys.resource(ADMIN_ACCOUNT_REQUESTS_RESOURCE),
  adminKeys.resource("workspaces"),
  adminKeys.resource("audit-log"),
  adminKeys.resource("activity"),
] as const;

export function useAdminDecideAccountTypeRequest(requestId: string) {
  return useAdminMutation<AccountTypeRequest, { decision: "approve" | "reject"; reason?: string }>({
    mutationFn: ({ decision, reason }, idempotencyKey) =>
      adminPost<AccountTypeRequest>(
        adminPath`/admin/workspace-account-type-requests/${requestId}/${decision}`,
        reason ? { reason } : {},
        { idempotencyKey },
      ),
    invalidate: AFTER_DECISION,
  });
}

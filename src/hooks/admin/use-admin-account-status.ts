/**
 * Muda a situação da conta do criador (`POST /admin/users/:userId/account-status`, corpo `{ status, reason? }`).
 * Mesma regra das outras ações do Admin: uma Idempotency-Key por intenção, e o detalhe é atualizado na hora com a resposta.
 */
import { useQueryClient } from "@tanstack/react-query";

import { adminPath, adminPost } from "@/lib/admin/admin-client";
import type { AdminAccountStatusBody, AdminUserDetail } from "@/shared/admin-platform.types";

import { adminKeys } from "./admin-query-keys";
import { useAdminMutation } from "./use-admin-mutation";
import { ADMIN_AUDIT_RESOURCE, ADMIN_USERS_RESOURCE } from "./use-admin-users";

const AFTER_ACCOUNT_STATUS = [
  [...adminKeys.resource(ADMIN_USERS_RESOURCE), "list"],
  adminKeys.resource(ADMIN_AUDIT_RESOURCE),
  adminKeys.resource("activity"),
  adminKeys.of("overview"),
] as const;

export function useAdminAccountStatus(userId: number) {
  const queryClient = useQueryClient();
  return useAdminMutation<AdminUserDetail, AdminAccountStatusBody>({
    mutationFn: async (body, idempotencyKey) => {
      const detail = await adminPost<AdminUserDetail>(adminPath`/admin/users/${userId}/account-status`, body, { idempotencyKey });
      queryClient.setQueryData(adminKeys.detail(ADMIN_USERS_RESOURCE, userId), detail);
      return detail;
    },
    invalidate: AFTER_ACCOUNT_STATUS,
  });
}

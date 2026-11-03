/**
 * Ações sobre a conta de um usuário (`POST /admin/users/:userId/suspend | /reactivate | /revoke-sessions`).
 *
 * Toda ação leva `reason` (5 a 500 caracteres, validado pelo diálogo de confirmação) e `Idempotency-Key`: a
 * chave é uma por intenção (`useAdminMutation`): repetir o envio com o mesmo motivo, depois de uma falha de
 * rede, reaproveita a chave e o servidor reconhece o repetido em vez de aplicar a ação duas vezes.
 */
import { useQueryClient } from "@tanstack/react-query";

import { adminPath, adminPost } from "@/lib/admin/admin-client";
import type { AdminUserActionBody, AdminUserDeleteBody, AdminUserDetail } from "@/shared/admin-platform.types";

import { adminKeys } from "./admin-query-keys";
import { useAdminMutation } from "./use-admin-mutation";
import { ADMIN_AUDIT_RESOURCE, ADMIN_USERS_RESOURCE } from "./use-admin-users";

/** `delete` anonimiza a conta, sem volta (`POST /admin/users/:userId/delete`, corpo com `confirm_email`). */
export type AdminUserActionName = "suspend" | "reactivate" | "revoke-sessions" | "delete";

export function adminUserActionPath(userId: number, action: AdminUserActionName): string {
  return adminPath`/admin/users/${userId}/${action}`;
}

/**
 * O que a ação muda e que pode estar aberto em outra tela: as listas de usuários, a trilha de auditoria, o feed
 * de atividades, os membros dos workspaces (mostram o estado e a última sessão de cada pessoa) e os números da
 * visão geral (usuários suspensos, com sessão recente). O detalhe do próprio usuário é atualizado na hora,
 * com a resposta da ação (já é o usuário no novo estado).
 */
const AFTER_USER_ACTION = [
  [...adminKeys.resource(ADMIN_USERS_RESOURCE), "list"],
  adminKeys.resource(ADMIN_AUDIT_RESOURCE),
  adminKeys.resource("activity"),
  adminKeys.resource("workspaces"),
  adminKeys.of("overview"),
] as const;

export function useAdminUserAction(userId: number, action: AdminUserActionName) {
  const queryClient = useQueryClient();
  return useAdminMutation<AdminUserDetail, AdminUserActionBody | AdminUserDeleteBody>({
    mutationFn: async (body, idempotencyKey) => {
      const detail = await adminPost<AdminUserDetail>(adminUserActionPath(userId, action), body, { idempotencyKey });
      queryClient.setQueryData(adminKeys.detail(ADMIN_USERS_RESOURCE, userId), detail);
      return detail;
    },
    invalidate: AFTER_USER_ACTION,
  });
}

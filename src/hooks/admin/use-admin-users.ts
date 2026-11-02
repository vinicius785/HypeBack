/**
 * Consultas de Usuários do Admin da plataforma: a lista global, o detalhe e o histórico de auditoria da conta.
 *
 * Contrato: `GET /admin/users`, `GET /admin/users/:userId` e `GET /admin/audit-log`
 * (`src/shared/admin-platform.types.ts`). A política de cache, de retry e de erro é a de `use-admin-queries`.
 */
import { adminPath, type AdminQuery } from "@/lib/admin/admin-client";
import type { AdminAuditLogEntry, AdminUserDetail, AdminUserListItem } from "@/shared/admin-platform.types";

import { useAdminItem, useAdminList } from "./use-admin-queries";

/** Prefixo de cache de usuários: `adminKeys.resource(ADMIN_USERS_RESOURCE)` invalida listas e detalhes. */
export const ADMIN_USERS_RESOURCE = "users";
export const ADMIN_AUDIT_RESOURCE = "audit-log";

/** A linha do tempo da conta é curta de ler: 10 por página. */
export const ADMIN_USER_AUDIT_PER_PAGE = 10;

/** Lista global de usuários. `params` sai de `useAdminListQueryState().params` (página, busca, filtros, ordenação). */
export function useAdminUsers(params: AdminQuery) {
  return useAdminList<AdminUserListItem>({ resource: ADMIN_USERS_RESOURCE, path: "/admin/users", params });
}

/** Detalhe de um usuário. Sem id (rota com id inválido), a consulta nem sai. */
export function useAdminUser(userId: string | number | undefined) {
  return useAdminItem<AdminUserDetail>({
    resource: ADMIN_USERS_RESOURCE,
    id: userId,
    path: adminPath`/admin/users/${userId ?? ""}`,
    enabled: userId !== undefined,
  });
}

/**
 * `target`: ações feitas SOBRE a conta (`target_type=user&target_id=:id`);
 * `actor`: ações feitas POR esta pessoa (`actor_user_id=:id`; só administradores agem pelo Admin, mas o
 * dono de um workspace também aparece como autor quando o próprio cliente o exclui pelo app).
 */
export type AdminUserAuditView = "target" | "actor";

export function adminUserAuditParams(userId: number, view: AdminUserAuditView, page: number): AdminQuery {
  return view === "target"
    ? { target_type: "user", target_id: String(userId), page, per_page: ADMIN_USER_AUDIT_PER_PAGE }
    : { actor_user_id: userId, page, per_page: ADMIN_USER_AUDIT_PER_PAGE };
}

/** Trilha de auditoria de um usuário (uma das duas visões), paginada por página. */
export function useAdminUserAudit(userId: number, view: AdminUserAuditView, page: number) {
  return useAdminList<AdminAuditLogEntry>({
    resource: ADMIN_AUDIT_RESOURCE,
    // O escopo separa as duas visões e cada usuário: trocar de visão nunca mostra as linhas da outra.
    scope: ["user", userId, view],
    path: "/admin/audit-log",
    params: adminUserAuditParams(userId, view, page),
  });
}

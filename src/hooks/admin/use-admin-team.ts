/**
 * Equipe da plataforma no Admin: quem sou eu e o que posso (`GET /admin/me`), os papéis e quem tem cada um
 * (`GET /admin/platform-team`) e a troca de papel (`PATCH /admin/users/:userId/platform-role`).
 *
 * Contrato: `src/shared/admin-platform.types.ts` (seção "Equipe da plataforma"). A política de cache, de retry e
 * de erro é a de `use-admin-queries`. Toda mutação leva `reason` e `Idempotency-Key` (`useAdminMutation`).
 */
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import type { User } from "@/shared/types";
import { adminPatch, adminPath } from "@/lib/admin/admin-client";
import type {
  AdminMe,
  AdminPlatformPermission,
  AdminPlatformRole,
  AdminPlatformRoleBody,
  AdminPlatformRoleChange,
  AdminPlatformTeam,
} from "@/shared/admin-platform.types";

import { adminKeys } from "./admin-query-keys";
import { useAdminMutation } from "./use-admin-mutation";
import { useAdminItem } from "./use-admin-queries";
import { ADMIN_AUDIT_RESOURCE, ADMIN_USERS_RESOURCE } from "./use-admin-users";

export const ADMIN_TEAM_RESOURCE = "team";

/** Papel e permissões de quem está logado no Admin. */
export function useAdminMe(options: { enabled?: boolean } = {}) {
  return useAdminItem<AdminMe>({
    resource: ADMIN_TEAM_RESOURCE,
    scope: ["me"],
    path: "/admin/me",
    enabled: options.enabled ?? true,
  });
}

/** Os papéis (com o que cada um pode) e as pessoas da equipe. */
export function useAdminPlatformTeam() {
  return useAdminItem<AdminPlatformTeam>({
    resource: ADMIN_TEAM_RESOURCE,
    scope: ["members"],
    path: "/admin/platform-team",
  });
}

export interface AdminCapabilities {
  role: AdminPlatformRole | null;
  /** Ainda não se sabe o papel (a consulta está a caminho). Os botões esperam em vez de piscar. */
  loading: boolean;
  isAdmin: boolean;
  can: (permission: AdminPlatformPermission) => boolean;
}

/**
 * O que a pessoa logada pode fazer no Admin. O administrador não precisa perguntar: tem tudo. Suporte e somente
 * leitura perguntam a `GET /admin/me`, que é a fonte da verdade (o frontend não copia a tabela de permissões).
 * Isto só decide o que aparece na tela: a API valida o papel em cada rota.
 */
export function useAdminCapabilities(): AdminCapabilities {
  const user = useOptionalUser();
  const isAdmin = user?.platform_role === "admin" || user?.is_platform_admin === true;
  const me = useAdminMe({ enabled: !!user && !isAdmin });

  // Sem usuário carregado (só acontece fora do layout do Admin, que nem renderiza sem ele) não há papel para
  // consultar: a tela não esconde nada e o servidor decide, como sempre.
  if (isAdmin || !user) return { role: isAdmin ? "admin" : null, loading: false, isAdmin: true, can: () => true };
  const permissions = me.data?.permissions ?? [];
  return {
    role: me.data?.role ?? null,
    loading: !!user && me.isLoading,
    isAdmin: false,
    can: (permission) => permissions.includes(permission),
  };
}

/** `useAuth` lança fora do provedor; aqui isso vira "sem usuário" (o contexto é sempre chamado: a ordem dos hooks não muda). */
function useOptionalUser(): User | null {
  try {
    return useAuth().user;
  } catch {
    return null;
  }
}

/** O que a troca de papel muda: a equipe, a conta (o selo de administrador), a trilha de auditoria. */
const AFTER_ROLE_CHANGE = [
  adminKeys.resource(ADMIN_TEAM_RESOURCE),
  adminKeys.resource(ADMIN_USERS_RESOURCE),
  adminKeys.resource(ADMIN_AUDIT_RESOURCE),
  adminKeys.resource("activity"),
] as const;

export function adminPlatformRolePath(userId: number): string {
  return adminPath`/admin/users/${userId}/platform-role`;
}

export function useAdminSetPlatformRole(userId: number) {
  const queryClient = useQueryClient();
  return useAdminMutation<AdminPlatformRoleChange, AdminPlatformRoleBody>({
    mutationFn: (body, idempotencyKey) =>
      adminPatch<AdminPlatformRoleChange>(adminPlatformRolePath(userId), body, { idempotencyKey }),
    invalidate: AFTER_ROLE_CHANGE,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.resource(ADMIN_TEAM_RESOURCE) });
    },
  });
}

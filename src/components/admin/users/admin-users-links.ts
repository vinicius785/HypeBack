/** Destinos de navegação do módulo de Usuários, em forma de dado (ver `AdminLinkTarget`). */
import type { AdminLinkTarget } from "@/components/admin/platform";
import { recalledListSearch } from "@/lib/admin/list-memory";

/** Chave com que a lista de Usuários guarda a sua busca (filtros, ordenação, página) para a volta do detalhe. */
export const USERS_LIST_MEMORY_KEY = "users";

/**
 * Volta para a lista de Usuários do jeito que a pessoa a deixou (filtros, ordenação, busca e página), não zerada. Sem nada
 * guardado, é a lista no padrão.
 */
export function usersListLink(): AdminLinkTarget {
  const search = recalledListSearch(USERS_LIST_MEMORY_KEY);
  return search ? { to: "/admin/users", search } : { to: "/admin/users" };
}

export function userDetailLink(userId: number | string, search?: Record<string, unknown>): AdminLinkTarget {
  return { to: "/admin/users/$userId", params: { userId: String(userId) }, search };
}

export function workspaceDetailLink(workspaceId: string): AdminLinkTarget {
  return { to: "/admin/workspaces/$workspaceId", params: { workspaceId } };
}

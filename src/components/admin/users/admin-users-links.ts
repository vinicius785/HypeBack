/** Destinos de navegação do módulo de Usuários, em forma de dado (ver `AdminLinkTarget`). */
import type { AdminLinkTarget } from "@/components/admin/platform";

export function usersListLink(): AdminLinkTarget {
  return { to: "/admin/users" };
}

export function userDetailLink(userId: number | string, search?: Record<string, unknown>): AdminLinkTarget {
  return { to: "/admin/users/$userId", params: { userId: String(userId) }, search };
}

export function workspaceDetailLink(workspaceId: string): AdminLinkTarget {
  return { to: "/admin/workspaces/$workspaceId", params: { workspaceId } };
}

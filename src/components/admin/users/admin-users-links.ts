/** Destinos de navegação do módulo de Usuários, em forma de dado (ver `AdminLinkTarget`). */
import type { AdminLinkTarget } from "@/components/admin/platform";
import { recalledListSearch } from "@/lib/admin/list-memory";

/** Chave com que a lista de Usuários guarda a sua busca (filtros, ordenação, página) para a volta do detalhe. */
export const USERS_LIST_MEMORY_KEY = "users";
/** O mesmo para a aba Criadores (a lista de usuários só com criadores). */
export const CREATORS_LIST_MEMORY_KEY = "creators";

/** Qual aba de Pessoas a pessoa viu por último: usada enquanto o detalhe ainda carrega (não se sabe o tipo da conta). */
let lastPeopleTab: "users" | "creators" = "users";
export function rememberPeopleTab(tab: "users" | "creators"): void {
  lastPeopleTab = tab;
}

/**
 * Volta para a lista de onde a pessoa veio, do jeito que a deixou (filtros, ordenação, busca e página), não zerada:
 * conta de criador volta para a aba Criadores, as demais para Usuários. Sem o tipo (detalhe ainda carregando ou com erro),
 * vale a última aba vista. Sem nada guardado, é a lista no padrão.
 */
export function usersListLink(kind?: string): AdminLinkTarget {
  const tab = kind ? (kind === "creator" ? "creators" : "users") : lastPeopleTab;
  const to = tab === "creators" ? "/admin/creators" : "/admin/users";
  const search = recalledListSearch(tab === "creators" ? CREATORS_LIST_MEMORY_KEY : USERS_LIST_MEMORY_KEY);
  return search ? { to, search } : { to };
}

/** Rótulo da migalha de volta (a aba de Pessoas de onde a pessoa veio). */
export function usersListLabel(kind?: string): string {
  return (kind ? kind === "creator" : lastPeopleTab === "creators") ? "Criadores" : "Usuários";
}

export function userDetailLink(userId: number | string, search?: Record<string, unknown>): AdminLinkTarget {
  return { to: "/admin/users/$userId", params: { userId: String(userId) }, search };
}

export function workspaceDetailLink(workspaceId: string): AdminLinkTarget {
  return { to: "/admin/workspaces/$workspaceId", params: { workspaceId } };
}

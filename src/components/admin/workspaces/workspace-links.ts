import type { AdminLinkTarget } from "@/components/admin/platform";
import { recalledListSearch } from "@/lib/admin/list-memory";

/** Chave com que a lista de Workspaces guarda a sua busca (filtros, ordenação, página) para a volta do detalhe. */
export const WORKSPACES_LIST_MEMORY_KEY = "workspaces";

/** Volta para a lista de Workspaces do jeito que a pessoa a deixou; sem nada guardado, é a lista no padrão. */
export function workspacesListLink(): AdminLinkTarget {
  const search = recalledListSearch(WORKSPACES_LIST_MEMORY_KEY);
  return search ? { to: "/admin/workspaces", search } : { to: "/admin/workspaces" };
}

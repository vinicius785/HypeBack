/** Destinos de navegação do módulo de Campanhas, em forma de dado (ver `AdminLinkTarget`). */
import type { AdminLinkTarget } from "@/components/admin/platform";

import { recalledListSearch } from "@/lib/admin/list-memory";

/** Chave com que a lista de Campanhas guarda a sua busca (filtros, ordenação, página) para a volta do detalhe. */
export const CAMPAIGNS_LIST_MEMORY_KEY = "campaigns";

/** Volta para a lista de Campanhas do jeito que a pessoa a deixou; sem nada guardado, é a lista no padrão. */
export function campaignsListLink(): AdminLinkTarget {
  const search = recalledListSearch(CAMPAIGNS_LIST_MEMORY_KEY);
  return search ? { to: "/admin/campaigns", search } : { to: "/admin/campaigns" };
}

export function campaignDetailLink(campaignId: string): AdminLinkTarget {
  return { to: "/admin/campaigns/$campaignId", params: { campaignId } };
}

export function campaignWorkspaceLink(workspaceId: string): AdminLinkTarget {
  return { to: "/admin/workspaces/$workspaceId", params: { workspaceId } };
}

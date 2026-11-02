/** Destinos de navegação do módulo de Campanhas, em forma de dado (ver `AdminLinkTarget`). */
import type { AdminLinkTarget } from "@/components/admin/platform";

export function campaignsListLink(): AdminLinkTarget {
  return { to: "/admin/campaigns" };
}

export function campaignDetailLink(campaignId: string): AdminLinkTarget {
  return { to: "/admin/campaigns/$campaignId", params: { campaignId } };
}

export function campaignWorkspaceLink(workspaceId: string): AdminLinkTarget {
  return { to: "/admin/workspaces/$workspaceId", params: { workspaceId } };
}

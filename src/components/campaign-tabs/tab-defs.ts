import type { WorkspacePermissions } from "@/shared/types";

/** Abas da campanha filtradas por `permissions` do workspace (@see API_BACKOFFICE_WORKSPACES_AND_PERMISSIONS.md). */
const CAMPAIGN_TAB_DEFS: Array<{
  id: string;
  label: string;
  visible: (p: WorkspacePermissions) => boolean;
  /** Parte de "Gestão" (Comunidade, Contratos, Métricas): é do time da agência, o Cliente não a vê. */
  gestao?: boolean;
}> = [
  { id: "dashboard", label: "Dashboard", visible: (p) => p.campaigns_read },
  { id: "selection", label: "Seleção de influenciadores", visible: (p) => p.influencers_read },
  { id: "management", label: "Gerenciamento", visible: (p) => p.campaigns_read },
  { id: "groups", label: "Comunidade", visible: (p) => p.campaigns_read, gestao: true },
  { id: "contracts", label: "Contratos", visible: (p) => p.contracts_read, gestao: true },
  { id: "metrics", label: "Métricas e conteúdos", visible: (p) => p.campaigns_read, gestao: true },
];

/** As abas que a pessoa vê: pela permissão e, para o Cliente da agência, sem a Gestão. */
export function campaignTabsFor(permissions: WorkspacePermissions, isClient: boolean): Array<{ id: string; label: string }> {
  return CAMPAIGN_TAB_DEFS.filter((t) => t.visible(permissions) && !(isClient && t.gestao)).map(({ id, label }) => ({
    id,
    label,
  }));
}

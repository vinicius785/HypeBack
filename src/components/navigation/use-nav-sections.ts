import { useLocation } from "@tanstack/react-router";

import { useAuth } from "@/contexts/auth-context";
import { useWorkspaceContext, useWorkspacePermissions } from "@/contexts/workspace-context";
import { useCampaigns } from "@/hooks/use-campaigns";
import { isPlatformStaff } from "@/lib/utils/platform-admin";
import { getCampaignStatusValue } from "@/shared/utils/campaign-status";

import { NAV_BY_SCOPE, type NavScope, type VisibleNavSection } from "./nav-config";

/**
 * As seções do ambiente já filtradas para o usuário (permissões do workspace, equipe da plataforma) e
 * o "está ativo" por rota. É o único lugar que decide o que aparece; a sidebar e o menu do celular só
 * desenham o resultado.
 */
export function useNavSections(scope: NavScope = "workspace") {
  const permissions = useWorkspacePermissions();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { selectedWorkspace } = useWorkspaceContext();
  const showPlatformStaff = isPlatformStaff(user);

  // O número de campanhas ativas é do workspace: no Admin nem se busca (nem com o workspace suspenso, que
  // recusa toda chamada).
  const { data: campaigns = [] } = useCampaigns({
    enabled:
      scope === "workspace" &&
      !!selectedWorkspace &&
      selectedWorkspace.status !== "suspended" &&
      permissions.campaigns_read,
  });
  const activeCampaigns = campaigns.filter((c: { status?: unknown }) => {
    const v = getCampaignStatusValue(c.status);
    return v === "active" || v === "published";
  }).length;

  // Ativo também nas rotas filhas (`/admin/workspaces/:id` acende "Workspaces").
  const isOn = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const sections: VisibleNavSection[] = NAV_BY_SCOPE[scope]
    .map((section) => ({
      id: section.id,
      label: section.label,
      items: section.items
        .filter((item) => {
          if (item.platformStaffOnly && !showPlatformStaff) return false;
          if (item.permission && !permissions[item.permission]) return false;
          return true;
        })
        .map((item) => ({ ...item, count: item.badge === "activeCampaigns" ? activeCampaigns : undefined })),
    }))
    // Seção sem nenhum item visível (ex.: "Administração" para um cliente) não deixa título solto.
    .filter((section) => section.items.length > 0);

  return { sections, showPlatformStaff, isOn };
}

import { createFileRoute } from "@tanstack/react-router";

import { WORKSPACE_TAB_IDS } from "@/components/admin/workspaces/workspace-constants";
import { WorkspaceDetailPage } from "@/components/admin/workspaces/workspace-detail-page";

export const Route = createFileRoute("/(private)/(admin)/admin/workspaces/$workspaceId")({
  // A aba mora na URL (`?tab=usuarios`); valor fora das abas conhecidas cai na primeira.
  validateSearch: (raw: Record<string, unknown>): { tab?: string } => ({
    tab: typeof raw.tab === "string" && (WORKSPACE_TAB_IDS as readonly string[]).includes(raw.tab) ? raw.tab : undefined,
  }),
  component: AdminWorkspaceDetailRoute,
});

function AdminWorkspaceDetailRoute() {
  const { workspaceId } = Route.useParams();
  // `key`: trocar de workspace (outro link) descarta a aba, os diálogos e o que estava digitado.
  return <WorkspaceDetailPage key={workspaceId} workspaceId={workspaceId} />;
}

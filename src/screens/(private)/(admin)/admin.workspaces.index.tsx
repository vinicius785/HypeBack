import { createFileRoute } from "@tanstack/react-router";

import { validateWorkspaceListSearch } from "@/components/admin/workspaces/workspace-constants";
import { WorkspacesListPage } from "@/components/admin/workspaces/workspaces-list";

export const Route = createFileRoute("/(private)/(admin)/admin/workspaces/")({
  validateSearch: validateWorkspaceListSearch,
  component: WorkspacesListPage,
});

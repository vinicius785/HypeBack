import { createFileRoute } from "@tanstack/react-router";

import { AdminTeamPage } from "@/components/admin/team/admin-team-page";

export const Route = createFileRoute("/(private)/(admin)/admin/team")({
  component: AdminTeamPage,
});

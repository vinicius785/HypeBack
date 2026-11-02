import { createFileRoute } from "@tanstack/react-router";

import { AdminCampaignsList } from "@/components/admin/campaigns/admin-campaigns-list";
import { validateAdminCampaignsSearch } from "@/hooks/admin/use-admin-campaigns";

export const Route = createFileRoute("/(private)/(admin)/admin/campaigns/")({
  validateSearch: validateAdminCampaignsSearch,
  component: AdminCampaignsList,
});

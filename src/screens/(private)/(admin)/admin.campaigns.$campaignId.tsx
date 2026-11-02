import { createFileRoute } from "@tanstack/react-router";

import { AdminCampaignDetail } from "@/components/admin/campaigns/admin-campaign-detail";

export const Route = createFileRoute("/(private)/(admin)/admin/campaigns/$campaignId")({
  component: AdminCampaignDetailRoute,
});

function AdminCampaignDetailRoute() {
  const { campaignId } = Route.useParams();
  return <AdminCampaignDetail campaignId={campaignId} />;
}

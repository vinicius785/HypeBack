import type { AdminCampaignsStats } from "@/shared/types";

import {
  AdminBarChart,
  formatAdminBucket,
  type AdminBarPoint,
} from "./admin-financial-volume-chart";

export function campaignPoints(
  data: AdminCampaignsStats["evolution"] | undefined,
): AdminBarPoint[] {
  return (data ?? []).map((d) => ({
    label: formatAdminBucket(d.bucket),
    value: d.created,
  }));
}

interface AdminCampaignsEvolutionChartProps {
  data: AdminCampaignsStats["evolution"] | undefined;
  isLoading?: boolean;
  isError?: boolean;
}

export function AdminCampaignsEvolutionChart({
  data,
  isLoading,
  isError,
}: AdminCampaignsEvolutionChartProps) {
  return (
    <AdminBarChart
      points={campaignPoints(data)}
      isLoading={isLoading}
      isError={isError}
    />
  );
}

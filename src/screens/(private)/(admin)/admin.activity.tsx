import { createFileRoute } from "@tanstack/react-router";

import { ActivityPage } from "@/components/admin/activity/activity-page";
import { validateActivitySearch } from "@/components/admin/activity/activity-search";

export const Route = createFileRoute("/(private)/(admin)/admin/activity")({
  validateSearch: validateActivitySearch,
  component: ActivityPage,
});

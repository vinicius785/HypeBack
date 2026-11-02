import { createFileRoute } from "@tanstack/react-router";

import { HealthPage } from "@/components/admin/health/health-page";
import { validateHealthSearch } from "@/components/admin/health/health-search";

export const Route = createFileRoute("/(private)/(admin)/admin/health")({
  validateSearch: validateHealthSearch,
  component: HealthPage,
});

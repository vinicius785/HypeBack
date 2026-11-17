import { createFileRoute } from "@tanstack/react-router";

import { AdminPopupsPage } from "@/components/admin/popups/popups-page";

export const Route = createFileRoute("/(private)/(admin)/admin/popups")({
  component: AdminPopupsPage,
});

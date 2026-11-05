import { createFileRoute } from "@tanstack/react-router";

import { AdminSupportPage } from "@/components/admin/support/support-page";

export const Route = createFileRoute("/(private)/(admin)/admin/support")({
  component: AdminSupportPage,
});

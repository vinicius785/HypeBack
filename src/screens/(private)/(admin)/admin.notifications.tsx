import { createFileRoute } from "@tanstack/react-router";

import { AdminNotificationsPage } from "@/components/admin/admin-notifications-page";

export const Route = createFileRoute(
  "/(private)/(admin)/admin/notifications",
)({
  component: AdminNotificationsPage,
});

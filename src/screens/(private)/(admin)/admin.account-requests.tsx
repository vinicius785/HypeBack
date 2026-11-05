import { createFileRoute } from "@tanstack/react-router";

import { AdminAccountTypeRequestsPage } from "@/components/admin/account-type/account-requests-page";

export const Route = createFileRoute("/(private)/(admin)/admin/account-requests")({
  component: AdminAccountTypeRequestsPage,
});

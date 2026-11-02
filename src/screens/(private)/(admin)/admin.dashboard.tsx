import { createFileRoute } from "@tanstack/react-router";

import { AdminDashboardPage } from "@/components/admin/dashboard/admin-dashboard-page";
import { readPeriodSearch } from "@/lib/admin/period";

export const Route = createFileRoute("/(private)/(admin)/admin/dashboard")({
  // O período fica na URL (`?period=90d`, `?period=custom&from=…&to=…`); o padrão (30 dias) não aparece.
  validateSearch: readPeriodSearch,
  component: AdminDashboardPage,
});

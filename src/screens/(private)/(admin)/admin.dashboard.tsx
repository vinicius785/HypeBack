import { createFileRoute } from "@tanstack/react-router";

import { AdminDashboardPage, DASHBOARD_TABS, type DashboardTab } from "@/components/admin/dashboard/admin-dashboard-page";
import { readPeriodSearch } from "@/lib/admin/period";

export const Route = createFileRoute("/(private)/(admin)/admin/dashboard")({
  // O período fica na URL (`?period=90d`, `?period=custom&from=…&to=…`); o padrão (30 dias) não aparece. A aba
  // (`?tab=growth`) também; "Visão geral" é o padrão e fica de fora.
  validateSearch: (raw: Record<string, unknown>) => ({
    ...readPeriodSearch(raw),
    ...(DASHBOARD_TABS.includes(raw.tab as DashboardTab) && raw.tab !== "overview" ? { tab: raw.tab as DashboardTab } : {}),
  }),
  component: AdminDashboardPage,
});

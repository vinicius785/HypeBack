import { createFileRoute } from "@tanstack/react-router";

import { FinancialPage } from "@/components/admin/financial/financial-page";
import { validateFinancialSearch } from "@/components/admin/financial/financial-search";

export const Route = createFileRoute("/(private)/(admin)/admin/financial")({
  validateSearch: validateFinancialSearch,
  component: FinancialPage,
});

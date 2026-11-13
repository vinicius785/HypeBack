import { createFileRoute } from "@tanstack/react-router";

import { SecurityPage } from "@/components/admin/security/security-page";

export const Route = createFileRoute("/(private)/(admin)/admin/security")({
  // A aba (`tab`) e o filtro (`status`) ficam na URL; o valor fora do permitido volta ao padrão (`useAdminSearchParam`).
  validateSearch: (raw: Record<string, unknown>) => ({ tab: raw.tab, status: raw.status }),
  component: SecurityPage,
});

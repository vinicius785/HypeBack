import { createFileRoute } from "@tanstack/react-router";

import { AdminServicePage } from "@/components/admin/service/service-page";
import { validateServiceSearch } from "@/components/admin/service/service-search";

// Atendimento: Suporte e Solicitações numa página só; a fila mora na URL (`?fila=requests`).
export const Route = createFileRoute("/(private)/(admin)/admin/support")({
  validateSearch: validateServiceSearch,
  component: AdminServicePage,
});

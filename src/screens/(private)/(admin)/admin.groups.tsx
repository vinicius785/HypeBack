import { createFileRoute } from "@tanstack/react-router";

import { CommunityPage } from "@/components/admin/community/community-page";
import { validateCommunitySearch } from "@/components/admin/community/community-search";

export const Route = createFileRoute("/(private)/(admin)/admin/groups")({
  // A aba mora na URL (`?tab=groups`); o Feed é o padrão. Os diálogos de grupo (rotas filhas) abrem sobre os Grupos.
  validateSearch: validateCommunitySearch,
  component: CommunityPage,
});

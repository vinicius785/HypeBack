import { createFileRoute } from "@tanstack/react-router";

import { AdminCreatorsScreen } from "@/components/admin/creators/admin-creators-screen";
import { validateAdminCreatorsSearch } from "@/hooks/admin/use-admin-creators";

export const Route = createFileRoute("/(private)/(admin)/admin/creators")({
  validateSearch: validateAdminCreatorsSearch,
  component: AdminCreatorsScreen,
});

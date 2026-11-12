import { createFileRoute } from "@tanstack/react-router";

import { ADMIN_USERS_LIST_CONFIG } from "@/components/admin/users/admin-users-config";
import { AdminUsersList } from "@/components/admin/users/admin-users-list";
import { createAdminListSearchValidator } from "@/lib/admin/list-query";

/** Pessoas › Criadores: a mesma lista de Usuários, só com criadores (o tipo é fixo e não vai para a URL). */
function AdminCreatorsPage() {
  return <AdminUsersList kind="creator" />;
}

export const Route = createFileRoute("/(private)/(admin)/admin/creators")({
  validateSearch: createAdminListSearchValidator(ADMIN_USERS_LIST_CONFIG),
  component: AdminCreatorsPage,
});

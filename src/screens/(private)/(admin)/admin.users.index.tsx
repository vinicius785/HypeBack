import { createFileRoute } from "@tanstack/react-router";

import { ADMIN_USERS_LIST_CONFIG } from "@/components/admin/users/admin-users-config";
import { AdminUsersList } from "@/components/admin/users/admin-users-list";
import { createAdminListSearchValidator } from "@/lib/admin/list-query";

export const Route = createFileRoute("/(private)/(admin)/admin/users/")({
  // Busca, estado, tipo, workspace, período, ordenação e página moram na URL (`/admin/users?status=suspended`).
  validateSearch: createAdminListSearchValidator(ADMIN_USERS_LIST_CONFIG),
  component: AdminUsersList,
});

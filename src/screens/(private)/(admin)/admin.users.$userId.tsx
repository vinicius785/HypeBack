import { createFileRoute } from "@tanstack/react-router";

import { AdminUserDetailScreen, validateAdminUserSearch } from "@/components/admin/users/admin-user-detail";

export const Route = createFileRoute("/(private)/(admin)/admin/users/$userId")({
  // A aba aberta mora na URL (`?tab=sessions`); a primeira (Vínculos) é o padrão e não aparece.
  validateSearch: validateAdminUserSearch,
  component: AdminUserDetailPage,
});

function AdminUserDetailPage() {
  const { userId } = Route.useParams();
  return <AdminUserDetailScreen userId={userId} />;
}

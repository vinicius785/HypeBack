import { createFileRoute } from "@tanstack/react-router";

import { GroupDetailDialog } from "@/components/admin/community/group-detail-dialog";

export const Route = createFileRoute(
  "/(private)/(admin)/admin/groups/$groupId",
)({
  component: GroupDetailRoute,
});

function GroupDetailRoute() {
  const { groupId } = Route.useParams();
  return <GroupDetailDialog groupId={groupId} />;
}

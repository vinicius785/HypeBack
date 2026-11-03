import { createFileRoute } from "@tanstack/react-router";

import { GroupNewDialog } from "@/components/admin/community/group-new-dialog";

export const Route = createFileRoute(
  "/(private)/(admin)/admin/groups/new",
)({
  component: GroupNewDialog,
});

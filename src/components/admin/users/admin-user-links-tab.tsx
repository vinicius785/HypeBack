import {
  AdminBadge,
  AdminEntityCell,
  AdminStatusBadge,
  AdminTable,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { formatDate } from "@/lib/admin/format";
import type { AdminUserDetail, AdminUserWorkspaceLink } from "@/shared/admin-platform.types";

import { workspaceRoleText } from "./admin-users-format";
import { workspaceDetailLink } from "./admin-users-links";

import "@/styles/admin-users.css";

const COLUMNS: AdminTableColumn<AdminUserWorkspaceLink>[] = [
  {
    key: "workspace",
    header: "Workspace",
    width: "minmax(0, 2fr)",
    primary: true,
    cell: (link) => <AdminEntityCell name={link.workspace.name} shape="square" />,
  },
  {
    key: "role",
    header: "Papel",
    width: "minmax(0, 1.5fr)",
    cell: (link) => (
      <div className="adm-users-role">
        <span>{workspaceRoleText(link.role)}</span>
        {link.has_custom_permissions ? (
          <AdminBadge tone="outline" size="sm" title="As permissões deste vínculo sobrescrevem o padrão do papel.">
            Permissões personalizadas
          </AdminBadge>
        ) : null}
      </div>
    ),
  },
  {
    key: "status",
    header: "Status do workspace",
    width: "148px",
    cell: (link) => <AdminStatusBadge kind="workspace" value={link.workspace_status} />,
  },
  {
    key: "joined",
    header: "Entrada",
    width: "104px",
    nowrap: true,
    cell: (link) => formatDate(link.joined_at),
  },
];

/** Aba Vínculos: todos os workspaces em que a conta tem acesso, com o papel; cada linha abre o workspace. */
export function AdminUserLinksTab({ user }: { user: AdminUserDetail }) {
  return (
    <AdminTable
      caption="Workspaces vinculados"
      columns={COLUMNS}
      rows={user.workspaces}
      rowKey={(link) => link.workspace.id}
      rowLink={(link) => workspaceDetailLink(link.workspace.id)}
      stickyHeader={false}
      empty={{
        title: "Sem vínculo com workspaces",
        description: "Esta conta não pertence a nenhum workspace.",
      }}
    />
  );
}

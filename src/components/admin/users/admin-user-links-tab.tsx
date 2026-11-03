import {
  AdminBadge,
  AdminEntityCell,
  AdminInfoPopover,
  AdminStatusBadge,
  AdminTable,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { formatDate } from "@/lib/admin/format";
import type { AdminUserDetail, AdminUserWorkspaceLink } from "@/shared/admin-platform.types";

import { workspaceRoleText } from "./admin-users-format";
import { workspaceDetailLink } from "./admin-users-links";

import "@/styles/admin-users.css";

/** Colunas da aba; recebem o nome da conta só para dar nome acessível ao "i" de cada linha. */
function linkColumns(userName: string): AdminTableColumn<AdminUserWorkspaceLink>[] {
  return [
    {
      key: "workspace",
      header: "Workspace",
      width: "minmax(0, 2.4fr)",
      primary: true,
      // O estado do workspace vai sob o nome (no lugar de uma coluna só para ele); o contrato não traz foto do workspace: iniciais.
      cell: (link) => (
        <AdminEntityCell
          name={link.workspace.name}
          shape="square"
          subtitle={<AdminStatusBadge kind="workspace" value={link.workspace_status} size="sm" />}
        />
      ),
    },
    {
      key: "role",
      header: "Papel",
      width: "minmax(0, 1.5fr)",
      cell: (link) => (
        <div className="adm-users-role">
          <span>{workspaceRoleText(link.role)}</span>
          {link.has_custom_permissions ? (
            <>
              <AdminBadge tone="outline" size="sm">
                Permissões personalizadas
              </AdminBadge>
              {/* O "i" não explica um cálculo: o nome diz de quem e de qual workspace são as permissões. */}
              <AdminInfoPopover triggerLabel={`Permissões personalizadas de ${userName} em ${link.workspace.name}`}>
                As permissões deste vínculo sobrescrevem o padrão do papel.
              </AdminInfoPopover>
            </>
          ) : null}
        </div>
      ),
    },
    {
      key: "joined",
      header: "Entrada",
      width: "104px",
      nowrap: true,
      cell: (link) => formatDate(link.joined_at),
    },
  ];
}

/**
 * Aba Vínculos: todos os workspaces em que a conta tem acesso, com o estado do workspace sob o nome e o papel; cada
 * linha abre o workspace. A contagem fica só na aba.
 */
export function AdminUserLinksTab({ user }: { user: AdminUserDetail }) {
  return (
    <AdminTable
      caption="Workspaces vinculados"
      columns={linkColumns(user.name)}
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

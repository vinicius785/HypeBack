import { useState } from "react";

import {
  AdminAvatar,
  AdminBadge,
  AdminPager,
  AdminStatusBadge,
  AdminTable,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { useAdminWorkspaceMembers } from "@/hooks/admin/use-admin-workspaces";
import { formatDate, formatDateTime, formatInt, formatRelativeTime } from "@/lib/admin/format";
import type { AdminWorkspaceDetail, AdminWorkspaceMember } from "@/shared/admin-platform.types";

import { useAdminCapabilities } from "@/hooks/admin/use-admin-team";

import { roleLabel } from "./workspace-constants";
import { WorkspaceMemberDialogs, type MemberDialogState } from "./workspace-member-dialogs";

import "@/styles/admin-workspaces.css";

const PER_PAGE = 100;

/** Aba "Usuários": quem tem acesso ao workspace, com as ações de acesso (adicionar, alterar papel, remover). */
export function WorkspaceMembersTab({ workspace }: { workspace: AdminWorkspaceDetail }) {
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<MemberDialogState>(null);
  const query = useAdminWorkspaceMembers(workspace.id, { page, per_page: PER_PAGE });
  const meta = query.data?.meta;
  useAdminPageClamp(page, meta?.total_pages, setPage);

  // O Admin não muda membros de um workspace excluído (a máquina de estados do contrato: `can.update`).
  // Mudar acesso é só do administrador da plataforma (suporte e somente leitura veem a lista).
  const capabilities = useAdminCapabilities();
  const editable = workspace.can.update && capabilities.isAdmin;
  // "Com acesso" = contas que não foram excluídas: o mesmo número do selo da aba e do cabeçalho
  // (`counts.members`). A lista traz também as contas excluídas, para auditoria, e `meta.total` as inclui.
  const withAccess = workspace.counts.members;
  const deletedOnPage = (query.data?.data ?? []).filter((member) => member.user_status === "deleted").length;
  const sessionDefinition = meta?.definitions?.last_session ?? meta?.definitions?.last_session_at;

  const columns: AdminTableColumn<AdminWorkspaceMember>[] = [
    {
      key: "person",
      header: "Pessoa",
      primary: true,
      width: "minmax(0, 2.2fr)",
      cell: (member) => (
        <div className="adm-workspaces-person">
          <AdminAvatar name={member.name} photo={member.photo} size={36} />
          <span className="adm-workspaces-person-text">
            <span className="adm-workspaces-person-name">
              <b title={member.name}>{member.name}</b>
              {member.is_platform_admin ? (
                <AdminBadge tone="outline" size="sm" title="Esta pessoa também é administradora da plataforma">
                  Admin da plataforma
                </AdminBadge>
              ) : null}
            </span>
            <small title={member.email}>{member.email}</small>
            {member.user_status === "deleted" ? <small className="adm-workspaces-deleted">Conta excluída: não conta como acesso</small> : null}
          </span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Papel",
      width: "minmax(0, 1.2fr)",
      cell: (member) => (
        <span>
          {roleLabel(member.role)}
          {member.has_custom_permissions ? (
            <small className="adm-sub" title="As permissões desta pessoa sobrescrevem o padrão do papel">
              permissões personalizadas
            </small>
          ) : null}
        </span>
      ),
    },
    {
      key: "joined",
      header: "Entrada",
      width: "104px",
      nowrap: true,
      hideBelow: "md",
      cell: (member) => <span title={formatDateTime(member.joined_at)}>{formatDate(member.joined_at)}</span>,
    },
    {
      key: "access",
      header: "Acesso",
      width: "112px",
      cell: (member) => <AdminStatusBadge kind="user" value={member.user_status} size="sm" />,
    },
    {
      key: "session",
      header: "Última sessão",
      width: "128px",
      hideBelow: "md",
      definition: sessionDefinition ? <p>{sessionDefinition}</p> : undefined,
      cell: (member) =>
        member.last_session_at ? (
          <span title={formatDateTime(member.last_session_at)}>{formatRelativeTime(member.last_session_at)}</span>
        ) : (
          <span className="adm-muted" title="Sem sessão registrada (a pessoa nunca entrou ou já saiu)">
            —
          </span>
        ),
    },
    ...(editable
      ? [
          {
            key: "actions",
            header: "Ações",
            mobileLabel: "",
            wide: true,
            width: "168px",
            align: "right" as const,
            cell: (member: AdminWorkspaceMember) => (
              <div className="adm-workspaces-rowactions">
                <button
                  type="button"
                  className="adm-textbtn"
                  aria-label={`Alterar papel de ${member.name}`}
                  onClick={() => setDialog({ kind: "role", member })}
                >
                  Alterar papel
                </button>
                <button
                  type="button"
                  className="adm-textbtn"
                  data-danger="true"
                  aria-label={`Remover ${member.name}`}
                  onClick={() => setDialog({ kind: "remove", member })}
                >
                  Remover
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="adm-workspaces-panel">
      <div className="adm-workspaces-toolbar">
        <p>
          {meta
            ? `${formatInt(withAccess)} ${withAccess === 1 ? "pessoa com acesso" : "pessoas com acesso"}${
                deletedOnPage > 0 ? ` (${formatInt(deletedOnPage)} ${deletedOnPage === 1 ? "conta excluída listada" : "contas excluídas listadas"}, sem acesso)` : ""
              }`
            : "Pessoas com acesso a este workspace"}
        </p>
        {editable ? (
          <button type="button" className="btn adm-btn-sm" onClick={() => setDialog({ kind: "add" })}>
            Adicionar membro
          </button>
        ) : (
          <p className="adm-workspaces-quiet">
            {workspace.lifecycle.status === "deleted"
              ? "Workspace excluído: o acesso não pode ser alterado."
              : "O estado atual do workspace não permite alterar o acesso."}
          </p>
        )}
      </div>

      <AdminTable
        caption="Usuários do workspace"
        columns={columns}
        rows={query.data?.data}
        rowKey={(member) => member.user_id}
        loading={query.isLoading}
        refreshing={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
        skeletonRows={4}
        stickyHeader={false}
        empty={{
          title: "Nenhum usuário neste workspace",
          description: "Ninguém tem acesso a este workspace agora.",
        }}
        footer={
          meta && meta.total > meta.per_page ? (
            <AdminPager page={meta.page} perPage={meta.per_page} total={meta.total} onPageChange={setPage} disabled={query.isFetching} />
          ) : undefined
        }
      />

      <WorkspaceMemberDialogs workspace={workspace} dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

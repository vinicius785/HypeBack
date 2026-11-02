import {
  AdminBadge,
  AdminEntityCell,
  AdminFilterBar,
  AdminLink,
  AdminPage,
  AdminPageHeader,
  AdminPager,
  AdminSearchInput,
  AdminStatusBadge,
  AdminTable,
  type AdminFilterDef,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useAdminListQueryState, useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { EMPTY_TEXT, formatDate } from "@/lib/admin/format";
import type { AdminUserListItem, AdminUserWorkspaceLink } from "@/shared/admin-platform.types";

import {
  ADMIN_USERS_KIND_OPTIONS,
  ADMIN_USERS_LIST_CONFIG,
  ADMIN_USERS_STATUS_OPTIONS,
} from "./admin-users-config";
import {
  LAST_SESSION_EXPLANATION,
  NO_SESSION_TITLE,
  approxSessionText,
  userKindText,
  workspaceRoleText,
} from "./admin-users-format";
import { userDetailLink, workspaceDetailLink } from "./admin-users-links";
import { AdminWorkspacePicker } from "./admin-workspace-picker";

import "@/styles/admin-users.css";

/** Quantos vínculos aparecem na linha; o resto vira "+N". */
const VISIBLE_WORKSPACES = 2;

const FILTERS: readonly AdminFilterDef[] = [
  { kind: "select", key: "kind", label: "Tipo", options: ADMIN_USERS_KIND_OPTIONS, defaultValue: "brand" },
  { kind: "date-range", label: "Cadastro", fromKey: "created_from", toKey: "created_to" },
];

/** Primeiros vínculos como texto pequeno ("Acme · Proprietário") e "+N" para o resto. */
function WorkspacesCell({ user }: { user: AdminUserListItem }) {
  if (user.workspaces_count === 0) return <span className="adm-muted">{EMPTY_TEXT}</span>;
  const shown = user.workspaces.slice(0, VISIBLE_WORKSPACES);
  const hidden = user.workspaces_count - shown.length;
  // O servidor manda até 5 vínculos: os nomes que ele mandou entram na dica; o que passar disso fica no detalhe.
  const rest: AdminUserWorkspaceLink[] = user.workspaces.slice(VISIBLE_WORKSPACES);
  const unseen = hidden - rest.length;
  const moreTitle =
    rest.map((link) => `${link.workspace.name} (${workspaceRoleText(link.role)})`).join(", ") +
    (unseen > 0 ? `${rest.length > 0 ? " e " : ""}mais ${unseen} no detalhe` : "");
  return (
    <div className="adm-users-ws">
      {shown.map((link) => (
        <span className="adm-users-ws-item" key={link.workspace.id}>
          <AdminLink to={workspaceDetailLink(link.workspace.id)} className="adm-users-ws-name" title={link.workspace.name}>
            {link.workspace.name}
          </AdminLink>
          <span className="adm-users-ws-role">{workspaceRoleText(link.role)}</span>
        </span>
      ))}
      {hidden > 0 ? (
        <span className="adm-users-ws-more adm-users-tip" title={moreTitle || undefined} aria-label={`mais ${hidden} workspaces`}>
          +{hidden}
        </span>
      ) : null}
    </div>
  );
}

function LastSessionCell({ iso }: { iso: string | null }) {
  const approx = approxSessionText(iso);
  if (!approx) {
    return (
      <span className="adm-muted adm-users-tip" title={NO_SESSION_TITLE}>
        {EMPTY_TEXT}
      </span>
    );
  }
  return (
    <span className="adm-users-tip" title={approx.title}>
      {approx.text}
    </span>
  );
}

/**
 * Lista global de usuários (`/admin/users`): busca, estado, tipo, workspace e período de cadastro, todos na URL
 * e todos enviados à API; tabela ordenável por cadastro, nome e última sessão; paginada; a linha abre o detalhe.
 */
export function AdminUsersList() {
  const state = useAdminListQueryState(ADMIN_USERS_LIST_CONFIG);
  const users = useAdminUsers(state.params);
  const meta = users.data?.meta;
  useAdminPageClamp(state.page, meta?.total_pages, state.setPage);

  const lastSessionDefinition =
    meta?.definitions?.last_session_at ?? meta?.definitions?.last_session ?? LAST_SESSION_EXPLANATION;

  const columns: AdminTableColumn<AdminUserListItem>[] = [
    {
      key: "user",
      header: "Usuário",
      sortKey: "name",
      width: "minmax(0, 2.2fr)",
      primary: true,
      cell: (user) => <AdminEntityCell name={user.name} photo={user.photo} subtitle={user.email} />,
    },
    {
      key: "kind",
      header: "Tipo",
      width: "minmax(138px, 1fr)",
      hideBelow: "md",
      cell: (user) => (
        <div className="adm-users-kind">
          <span>{userKindText(user.kind)}</span>
          {user.is_platform_admin ? (
            <AdminBadge tone="brand" size="sm" title="Tem acesso ao Admin da plataforma">
              Admin da plataforma
            </AdminBadge>
          ) : null}
        </div>
      ),
    },
    {
      key: "workspaces",
      header: "Workspaces",
      width: "minmax(0, 2fr)",
      cell: (user) => <WorkspacesCell user={user} />,
    },
    {
      key: "status",
      header: "Status",
      width: "112px",
      cell: (user) => <AdminStatusBadge kind="user" value={user.status} />,
    },
    {
      key: "created",
      header: "Cadastro",
      sortKey: "created_at",
      width: "104px",
      nowrap: true,
      cell: (user) => formatDate(user.created_at),
    },
    {
      key: "last_session",
      header: "Última sessão",
      sortKey: "last_session",
      width: "minmax(132px, 1fr)",
      nowrap: true,
      definition: lastSessionDefinition,
      cell: (user) => <LastSessionCell iso={user.last_session_at} />,
    },
  ];

  // `hasActiveFilters` já conta estado, tipo, workspace e período fora do padrão (não conta a busca).
  const filtering = state.hasActiveFilters || !!state.search;

  return (
    <AdminPage>
      <AdminPageHeader title="Usuários" subtitle="Quem acessa a plataforma, em todos os workspaces." />

      <AdminFilterBar
        segment={{
          ariaLabel: "Estado da conta",
          options: ADMIN_USERS_STATUS_OPTIONS,
          value: state.filters.status,
          onChange: (status) => state.setFilter("status", status),
        }}
        search={
          <>
            <AdminSearchInput
              value={state.search}
              onSearch={state.setSearch}
              placeholder="Buscar por nome ou e-mail"
              label="Buscar usuário por nome ou e-mail"
            />
            <AdminWorkspacePicker
              value={state.filters.workspace_id}
              onChange={(workspace) => state.setFilter("workspace_id", workspace?.id ?? "")}
              label="Workspace"
              placeholder="Todos"
            />
          </>
        }
        filters={FILTERS}
        values={state.filters}
        onChange={state.setFilters}
        onClear={state.clearFilters}
      />

      <AdminTable
        caption="Usuários"
        columns={columns}
        rows={users.data?.data}
        rowKey={(user) => user.id}
        rowLink={(user) => userDetailLink(user.id)}
        sort={{ by: state.sortBy, order: state.order }}
        onSort={(key) => state.toggleSort(key, key === "name" ? "asc" : "desc")}
        loading={users.isLoading}
        refreshing={users.isFetching && !users.isLoading}
        error={users.error}
        onRetry={() => void users.refetch()}
        retrying={users.isFetching}
        empty={
          filtering
            ? {
                title: "Nenhum usuário encontrado",
                description: "Nenhum usuário corresponde à busca e aos filtros atuais.",
                action: (
                  <button type="button" className="btn out adm-btn-sm" onClick={state.reset}>
                    Limpar busca e filtros
                  </button>
                ),
              }
            : { title: "Nenhum usuário por aqui", description: "Ainda não há usuários para mostrar." }
        }
        footer={
          meta ? (
            <AdminPager
              page={meta.page}
              perPage={meta.per_page}
              total={meta.total}
              onPageChange={state.setPage}
              onPerPageChange={state.setPerPage}
              disabled={users.isFetching}
            />
          ) : undefined
        }
      />
    </AdminPage>
  );
}

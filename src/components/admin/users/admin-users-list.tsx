import { useState } from "react";

import {
  AdminBadge,
  AdminEntityCell,
  AdminFilterBar,
  AdminInfoPopover,
  AdminLink,
  AdminPage,
  AdminPageHeader,
  AdminPager,
  AdminRefreshButton,
  AdminSearchInput,
  AdminStatusBadge,
  AdminTable,
  type AdminFilterDef,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useAdminListQueryState, useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { EMPTY_TEXT, formatDate, formatDateTime } from "@/lib/admin/format";
import { TRUST_DISCLAIMER, isSuspectTrust } from "@/lib/admin/trust";
import type { AdminUserListItem, AdminUserWorkspaceLink, AdminWorkspaceRef } from "@/shared/admin-platform.types";

import {
  ADMIN_USERS_DEFAULT_KIND,
  ADMIN_USERS_KIND_OPTIONS,
  ADMIN_USERS_DEFAULT_STATUS,
  ADMIN_USERS_LIST_CONFIG,
  ADMIN_USERS_STATUS_OPTIONS,
} from "./admin-users-config";
import { LAST_SESSION_EXPLANATION, approxSessionText, userKindText, workspaceRoleText } from "./admin-users-format";
import { userDetailLink, workspaceDetailLink } from "./admin-users-links";
import { TrustBadge } from "./admin-user-trust";
import { AdminWorkspacePicker, useAdminWorkspaceSelection } from "./admin-workspace-picker";

import "@/styles/admin-users.css";

/** Quantos vínculos aparecem na linha; o resto vira "+N". */
const VISIBLE_WORKSPACES = 2;

/**
 * Primeiros vínculos (nome e papel) e "+N" para o resto. O "+N" é texto visível e o "i" ao lado abre a lista dos
 * outros (nome e papel): funciona no teclado e no toque, ao contrário de um `title`.
 */
function WorkspacesCell({ user }: { user: AdminUserListItem }) {
  if (user.workspaces_count === 0) return <span className="adm-muted">{EMPTY_TEXT}</span>;
  const shown = user.workspaces.slice(0, VISIBLE_WORKSPACES);
  const hidden = user.workspaces_count - shown.length;
  // O servidor manda até 5 vínculos: os nomes que ele mandou entram na lista; o que passar disso fica no detalhe.
  const rest: AdminUserWorkspaceLink[] = user.workspaces.slice(VISIBLE_WORKSPACES);
  const unseen = hidden - rest.length;
  const moreText =
    rest.map((link) => `${link.workspace.name} (${workspaceRoleText(link.role)})`).join(", ") +
    (unseen > 0 ? `${rest.length > 0 ? " e " : ""}mais ${unseen} no detalhe` : "");
  return (
    <div className="adm-users-ws">
      {shown.map((link) => (
        <span className="adm-users-ws-item" key={link.workspace.id}>
          <AdminLink to={workspaceDetailLink(link.workspace.id)} textLink>
            {link.workspace.name}
          </AdminLink>
          <span className="adm-users-ws-role">{workspaceRoleText(link.role)}</span>
        </span>
      ))}
      {hidden > 0 ? (
        <span className="adm-users-ws-more">
          <span>+{hidden}</span>
          <AdminInfoPopover triggerLabel={`Outros workspaces de ${user.name}`}>{moreText}</AdminInfoPopover>
        </span>
      ) : null}
    </div>
  );
}

/** "aprox. há 3 horas" com o instante exato embaixo; sem sessão aberta o texto diz isso (a regra está no "i" da coluna). */
function LastSessionCell({ iso }: { iso: string | null }) {
  const approx = approxSessionText(iso);
  if (!approx || !iso) return <span className="adm-muted">Sem sessão aberta</span>;
  return (
    <span className="adm-users-session">
      <span>{approx.text}</span>
      <small>{formatDateTime(iso)}</small>
    </span>
  );
}

/** O `kind` que a API devolve para cada valor do filtro "Tipo"; `all` não tem um só. */
const EXPECTED_KIND: Record<string, string | undefined> = { brand: "brand", creator: "creator" };

/**
 * Lista global de usuários (`/admin/users`): busca, estado, tipo, workspace e período de cadastro, todos na URL
 * e todos enviados à API; tabela ordenável por cadastro, nome e última sessão; paginada; a linha abre o detalhe.
 */
export function AdminUsersList() {
  const state = useAdminListQueryState(ADMIN_USERS_LIST_CONFIG);
  const users = useAdminUsers(state.params);
  const meta = users.data?.meta;
  useAdminPageClamp(state.page, meta?.total_pages, state.setPage);

  // O nome do workspace escolhido: o do seletor (acabou de escolher) ou o buscado pelo id da URL; é o texto do chip.
  const [picked, setPicked] = useState<AdminWorkspaceRef | null>(null);
  const workspaceFilter = useAdminWorkspaceSelection(state.filters.workspace_id, { known: picked });

  // Filtro LOCAL de confiança (a API ainda não filtra nem ordena por ela): só afeta as linhas da página carregada.
  const [onlySuspects, setOnlySuspects] = useState(false);
  const pageRows = users.data?.data;
  const rows = onlySuspects ? pageRows?.filter((user) => isSuspectTrust(user.trust)) : pageRows;

  const lastSessionDefinition =
    meta?.definitions?.last_session_at ?? meta?.definitions?.last_session ?? LAST_SESSION_EXPLANATION;

  // Com um tipo só no filtro (Marca, Criadores) a coluna "Tipo" diria a mesma coisa em toda linha: sai. O que destoa do
  // filtro (agência e administrador dentro de "Marca") aparece como etiqueta junto do nome.
  const expectedKind = EXPECTED_KIND[state.filters.kind || ADMIN_USERS_DEFAULT_KIND];
  const showKindColumn = expectedKind === undefined;

  const columns: AdminTableColumn<AdminUserListItem>[] = [
    {
      key: "user",
      header: "Usuário",
      sortKey: "name",
      width: "minmax(180px, 2.2fr)",
      primary: true,
      cell: (user) => {
        const otherKind = !showKindColumn && user.kind !== expectedKind;
        const badges =
          otherKind || user.is_platform_admin ? (
            <span className="adm-users-person-badges">
              {otherKind ? (
                <AdminBadge tone="outline" size="sm">
                  {userKindText(user.kind)}
                </AdminBadge>
              ) : null}
              {user.is_platform_admin ? (
                <AdminBadge tone="brand" size="sm">
                  Admin da plataforma
                </AdminBadge>
              ) : null}
            </span>
          ) : undefined;
        return <AdminEntityCell name={user.name} photo={user.photo} subtitle={user.email} badge={badges} />;
      },
    },
    ...(showKindColumn
      ? [
          {
            key: "kind",
            header: "Tipo",
            width: "minmax(112px, 1fr)",
            hideBelow: "md",
            cell: (user: AdminUserListItem) => <span className="adm-users-sub">{userKindText(user.kind)}</span>,
          } satisfies AdminTableColumn<AdminUserListItem>,
        ]
      : []),
    {
      key: "trust",
      header: "Confiança",
      width: "96px",
      definition: (
        <>
          {TRUST_DISCLAIMER} De 1 (muito provável bot) a 5 (perfil real). Passe o mouse, ou foque o número, para ver os motivos.
        </>
      ),
      cell: (user) => <TrustBadge trust={user.trust} />,
    },
    {
      key: "workspaces",
      header: "Workspaces",
      width: "minmax(150px, 2fr)",
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
      header: "Cadastrado em",
      sortKey: "created_at",
      width: "132px",
      nowrap: true,
      cell: (user) => <span className="adm-users-sub">{formatDate(user.created_at)}</span>,
    },
    {
      key: "last_session",
      header: "Última sessão",
      sortKey: "last_session",
      width: "minmax(144px, 1fr)",
      nowrap: true,
      definition: lastSessionDefinition,
      cell: (user) => <LastSessionCell iso={user.last_session_at} />,
    },
  ];

  // "Tipo" e "Workspace" ficam sempre à vista na barra (contam em "Filtros (n)", viram chip e saem em "Limpar filtros");
  // o período de cadastro fica no painel.
  const filters: AdminFilterDef[] = [
    {
      kind: "select",
      key: "kind",
      label: "Tipo",
      options: ADMIN_USERS_KIND_OPTIONS,
      defaultValue: ADMIN_USERS_DEFAULT_KIND,
      inline: true,
    },
    {
      kind: "custom",
      id: "workspace",
      label: "Workspace",
      inline: true,
      summary: workspaceFilter.summary,
      // Tanto o × do chip quanto o "Limpar filtros" usam a atualização funcional da URL: um não sobrescreve o outro.
      onClear: () => state.setFilter("workspace_id", ""),
      render: () => (
        <AdminWorkspacePicker
          variant="filterBar"
          label="Workspace"
          placeholder="Todos"
          value={state.filters.workspace_id}
          onChange={(workspace) => {
            if (workspace) setPicked(workspace);
            state.setFilter("workspace_id", workspace?.id ?? "");
          }}
        />
      ),
    },
    { kind: "date-range", label: "Cadastrado em", fromKey: "created_from", toKey: "created_to" },
  ];

  // `hasActiveFilters` já conta estado, tipo, workspace e período fora do padrão (não conta a busca).
  const filtering = state.hasActiveFilters || !!state.search;

  return (
    <AdminPage>
      <AdminPageHeader title="Usuários" subtitle="Quem acessa a plataforma, em todos os workspaces." />

      <AdminFilterBar
        segment={{
          ariaLabel: "Status da conta",
          options: ADMIN_USERS_STATUS_OPTIONS,
          value: state.filters.status,
          onChange: (status) => state.setFilter("status", status),
        }}
        // Estado fora de "Ativos e suspensos" (o padrão da API) conta como filtro: chip e "Limpar filtros" o devolvem ao padrão.
        segmentDefault={ADMIN_USERS_DEFAULT_STATUS}
        search={
          <AdminSearchInput
            value={state.search}
            onSearch={state.setSearch}
            placeholder="Buscar por nome ou e-mail"
            label="Buscar usuários"
          />
        }
        searchLabel="Buscar usuários"
        filters={filters}
        values={state.filters}
        onChange={state.setFilters}
        onClear={state.clearFilters}
        trailing={
          <AdminRefreshButton iconOnly loading={users.isFetching} onClick={() => void users.refetch()} />
        }
      />

      {pageRows ? (
        <div className="adm-trust-filter">
          <button type="button" className="btn out adm-btn-sm" aria-pressed={onlySuspects} onClick={() => setOnlySuspects((on) => !on)}>
            Confiança: 1–2 (suspeitos)
          </button>
          <span role="status">
            {onlySuspects
              ? `Mostrando ${rows?.length ?? 0} de ${pageRows.length} usuários desta página. O filtro vale só para a página carregada.`
              : "Filtro só para os usuários da página carregada."}
          </span>
        </div>
      ) : null}

      <AdminTable
        caption="Usuários"
        columns={columns}
        rows={rows}
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
          onlySuspects && pageRows && pageRows.length > 0
            ? {
                title: "Nenhum suspeito nesta página",
                description: `Nenhuma das ${pageRows.length} contas desta página tem confiança 1 ou 2. As outras páginas podem ter.`,
                action: (
                  <button type="button" className="btn out adm-btn-sm" onClick={() => setOnlySuspects(false)}>
                    Mostrar todos da página
                  </button>
                ),
              }
            : filtering
            ? {
                title: "Nenhum usuário encontrado",
                description: "Nenhum usuário corresponde à busca e aos filtros atuais.",
                action: (
                  <button type="button" className="btn out adm-btn-sm" onClick={state.reset}>
                    Limpar busca e filtros
                  </button>
                ),
              }
            : { title: "Nenhum usuário ainda", description: "Quando alguém se cadastrar na plataforma, aparece aqui." }
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

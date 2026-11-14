import { useEffect, useState } from "react";

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
  AdminSortMenu,
  AdminStatusBadge,
  AdminTable,
  type AdminFilterDef,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useAdminListQueryState, useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { rememberListSearch } from "@/lib/admin/list-memory";
import { stateToSearch } from "@/lib/admin/list-query";
import { EMPTY_TEXT, formatDate, formatDateTime } from "@/lib/admin/format";
import { TRUST_DISCLAIMER } from "@/lib/admin/trust";
import type { AdminUserListItem, AdminUserWorkspaceLink, AdminWorkspaceRef } from "@/shared/admin-platform.types";

import {
  ADMIN_USERS_DEFAULT_STATUS,
  ADMIN_USERS_LIST_CONFIG,
  ADMIN_ACCOUNT_SITUATION_FILTER_OPTIONS,
  ADMIN_USERS_STATUS_OPTIONS,
  usersApiParams,
} from "./admin-users-config";
import { LAST_SESSION_EXPLANATION, approxSessionText, userKindText, workspaceRoleText } from "./admin-users-format";
import { CREATORS_LIST_MEMORY_KEY, rememberPeopleTab, USERS_LIST_MEMORY_KEY, userDetailLink, workspaceDetailLink } from "./admin-users-links";
import { UserPlatforms } from "./admin-user-platforms";
import { PeopleIsland } from "@/components/admin/people/people-island";
import { NewAccountButton } from "@/components/admin/workspaces/new-account-button";
import { TrustBadge } from "./admin-user-trust";
import { AccountSituationBadge } from "./account-situation";
import { AdminWorkspacePicker, useAdminWorkspaceSelection } from "./admin-workspace-picker";

import "@/styles/admin-users.css";

/** Opções do menu de ordenação (o mesmo `sort_by`/`order` da URL e dos cabeçalhos da tabela). */
const USERS_SORT_OPTIONS = [
  { sortBy: "created_at", order: "desc", group: "Cadastro", shortLabel: "Mais recentes", label: "Cadastro: mais recentes" },
  { sortBy: "created_at", order: "asc", group: "Cadastro", shortLabel: "Mais antigos", label: "Cadastro: mais antigos" },
  { sortBy: "name", order: "asc", group: "Nome", shortLabel: "A–Z", label: "Nome: A–Z" },
  { sortBy: "name", order: "desc", group: "Nome", shortLabel: "Z–A", label: "Nome: Z–A" },
  { sortBy: "last_session", order: "desc", group: "Última sessão", shortLabel: "Mais recente", label: "Última sessão: mais recente" },
  { sortBy: "last_session", order: "asc", group: "Última sessão", shortLabel: "Mais antiga", label: "Última sessão: mais antiga" },
  // Confiança: ordenada pelo servidor em TODA a lista (não só na página).
  { sortBy: "trust", order: "asc", group: "Confiança", shortLabel: "Suspeitos primeiro", label: "Confiança: suspeitos primeiro" },
  { sortBy: "trust", order: "desc", group: "Confiança", shortLabel: "Perfil real primeiro", label: "Confiança: perfil real primeiro" },
] as const;

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


/**
 * Lista global de usuários (`/admin/users`): busca, estado, tipo, workspace e período de cadastro, todos na URL
 * e todos enviados à API; tabela ordenável por cadastro, nome e última sessão; paginada; a linha abre o detalhe.
 */
export function AdminUsersList({ kind }: { kind?: "creator" } = {}) {
  const state = useAdminListQueryState(ADMIN_USERS_LIST_CONFIG);
  // Na aba Criadores o tipo é fixo (não é filtro): a mesma lista, só com criadores, e a sua própria memória de volta.
  const fixedKind = kind;
  const memoryKey = fixedKind ? CREATORS_LIST_MEMORY_KEY : USERS_LIST_MEMORY_KEY;
  // Ao abrir uma conta desta lista, a migalha do detalhe volta para esta mesma aba de Pessoas.
  rememberPeopleTab(fixedKind ? "creators" : "users");
  // Guarda o que está na URL (filtros, ordenação, busca, página) para o "voltar" do detalhe trazer a lista como estava.
  const memorySearch = JSON.stringify(stateToSearch(state, ADMIN_USERS_LIST_CONFIG));
  useEffect(() => {
    rememberListSearch(memoryKey, JSON.parse(memorySearch) as Record<string, string | number>);
  }, [memorySearch, memoryKey]);
  const users = useAdminUsers(
    fixedKind
      ? // Em Criadores o workspace não é filtro: um `?workspace_id=` antigo na URL não vai para a consulta.
        { ...usersApiParams(state.params, state.filters.status), kind: fixedKind, workspace_id: undefined }
      : usersApiParams(state.params, state.filters.status),
  );
  const meta = users.data?.meta;
  useAdminPageClamp(state.page, meta?.total_pages, state.setPage);

  // O nome do workspace escolhido: o do seletor (acabou de escolher) ou o buscado pelo id da URL; é o texto do chip.
  const [picked, setPicked] = useState<AdminWorkspaceRef | null>(null);
  const workspaceFilter = useAdminWorkspaceSelection(state.filters.workspace_id, { known: picked });

  const rows = users.data?.data;
  // A primeira consulta por confiança pode demorar (a API calcula e guarda as notas): avisa enquanto espera.
  const slowTrust = users.isFetching && (state.sortBy === "trust");

  const lastSessionDefinition =
    meta?.definitions?.last_session_at ?? meta?.definitions?.last_session ?? LAST_SESSION_EXPLANATION;

  // O tipo não é filtro: Usuários são as contas de marca (padrão da API) e Criadores têm a sua aba. A coluna "Tipo" diria a
  // mesma coisa em toda linha, então não existe; o que destoa da aba (agência e administrador dentro de "Usuários") aparece
  // como etiqueta junto do nome.
  const expectedKind = fixedKind ?? "brand";

  const columns: AdminTableColumn<AdminUserListItem>[] = [
    {
      key: "user",
      header: "Usuário",
      sortKey: "name",
      width: "minmax(180px, 2.2fr)",
      primary: true,
      cell: (user) => {
        const otherKind = user.kind !== expectedKind;
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
    {
      key: "trust",
      header: "Confiança",
      sortKey: "trust",
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
      cell: (user) =>
        user.kind === "creator" && user.account_status && user.account_status !== "active" ? (
          <AccountSituationBadge value={user.account_status} />
        ) : (
          <AdminStatusBadge kind="user" value={user.status} title={user.pending_step?.label} />
        ),
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
    {
      key: "platforms",
      header: "Celular",
      width: "96px",
      hideBelow: "md",
      cell: (user) => <UserPlatforms platforms={user.platforms} />,
    },
  ];

  // Estado, workspace e período de cadastro ficam no painel de filtros (contam em "Filtros (n)", viram chip e saem em "Limpar filtros").
  const filters: AdminFilterDef[] = [
    // O estado da conta (Ativos e suspensos, Ativos, Suspensos, Em cadastro, Excluídos, Todos) mora no painel de filtros.
    { kind: "select", key: "status", label: "Status da conta", options: ADMIN_USERS_STATUS_OPTIONS, defaultValue: ADMIN_USERS_DEFAULT_STATUS },
    // Situação da conta no app (só criadores têm: em análise e reprovada não existem para marcas).
    ...(fixedKind === "creator"
      ? [{ kind: "select", key: "account_status", label: "Situação da conta", options: ADMIN_ACCOUNT_SITUATION_FILTER_OPTIONS, defaultValue: "" } as AdminFilterDef]
      : []),
    // Criadores não têm workspace de marca para filtrar: o seletor só existe em Usuários.
    ...(fixedKind ? [] : ([
    {
      kind: "custom",
      id: "workspace",
      label: "Workspace",
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
    }
    ] as AdminFilterDef[])),
    { kind: "date-range", label: "Cadastrado em", fromKey: "created_from", toKey: "created_to" },
  ];

  // `hasActiveFilters` já conta estado, tipo, workspace e período fora do padrão (não conta a busca).
  const filtering = state.hasActiveFilters || !!state.search;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Pessoas"
        subtitle="Quem acessa a plataforma: usuários, criadores e os workspaces dos clientes."
        actions={<NewAccountButton />}
      />

      <PeopleIsland current={fixedKind ? "creators" : "users"}>
      <AdminFilterBar
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
        compact
        beforeFilters={
          <AdminSortMenu
            options={USERS_SORT_OPTIONS}
            sortBy={state.sortBy}
            order={state.order}
            defaultSortBy={ADMIN_USERS_LIST_CONFIG.defaultSortBy}
            defaultOrder={ADMIN_USERS_LIST_CONFIG.defaultOrder}
            onSort={state.setSort}
          />
        }
        trailing={
          <AdminRefreshButton iconOnly loading={users.isFetching} onClick={() => void users.refetch()} />
        }
      />
      </PeopleIsland>

      {slowTrust ? (
        <p className="adm-muted" role="status">
          Calculando a confiança das contas… a primeira vez pode levar alguns segundos.
        </p>
      ) : null}

      <AdminTable
        caption="Usuários"
        columns={columns}
        rows={rows}
        rowKey={(user) => user.id}
        rowLink={(user) => userDetailLink(user.id)}
        sort={{ by: state.sortBy, order: state.order }}
        onSort={(key) => state.toggleSort(key, key === "name" || key === "trust" ? "asc" : "desc")}
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

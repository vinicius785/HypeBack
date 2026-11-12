import { useEffect, useMemo } from "react";

import {
  AdminFilterBar,
  AdminPage,
  AdminPageHeader,
  AdminPager,
  AdminRefreshButton,
  AdminSearchInput,
  AdminSortMenu,
  AdminTable,
  type AdminFilterDef,
} from "@/components/admin/platform";
import { useAdminListQueryState, useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { PeopleIsland } from "@/components/admin/people/people-island";
import { useAdminWorkspaceList } from "@/hooks/admin/use-admin-workspaces";
import { rememberListSearch } from "@/lib/admin/list-memory";
import { stateToSearch } from "@/lib/admin/list-query";
import { WORKSPACES_LIST_MEMORY_KEY } from "./workspace-links";

import {
  WORKSPACE_DELETED_STATUS,
  WORKSPACE_LIST_CONFIG,
  WORKSPACE_LIST_FILTERS,
  WORKSPACE_SORT_FIRST_ORDER,
  WORKSPACE_SORT_OPTIONS,
  WORKSPACE_STATUS_OPTIONS,
  type WorkspaceFilterKey,
} from "./workspace-constants";
import { buildWorkspaceColumns } from "./workspaces-list-columns";
import { NewAccountButton } from "./new-account-button";

import "@/styles/admin-workspaces.css";

/**
 * Lista de todos os clientes da plataforma. Busca, estado, uso recente, tipo, período de criação, ordenação e
 * página moram na URL (um link do Dashboard é `?status=suspended`) e todos vão para a API: nada na barra de
 * filtros é decorativo. Os padrões são os do servidor (clientes não excluídos, mais novos primeiro).
 *
 * O estado é um segmento (Todos · Ativos · Suspensos · Arquivados) e "Excluídos" é um liga/desliga da barra: os dois
 * escrevem o mesmo parâmetro `status`, então os cinco estados continuam alcançáveis e os links não mudaram. No
 * celular ficam à vista só o segmento, a busca, "Uso recente" e "Excluídos"; "Tipo" e "Criado em" abrem em "Filtros".
 */
export function WorkspacesListPage() {
  const list = useAdminListQueryState(WORKSPACE_LIST_CONFIG);
  // Guarda o que está na URL (filtros, ordenação, busca, página) para o "voltar" do detalhe trazer a lista como estava.
  const memorySearch = JSON.stringify(stateToSearch(list, WORKSPACE_LIST_CONFIG));
  useEffect(() => {
    rememberListSearch(WORKSPACES_LIST_MEMORY_KEY, JSON.parse(memorySearch) as Record<string, string | number>);
  }, [memorySearch]);
  const query = useAdminWorkspaceList(list.params);
  const meta = query.data?.meta;
  useAdminPageClamp(list.page, meta?.total_pages, list.setPage);

  const columns = useMemo(() => buildWorkspaceColumns(meta?.definitions), [meta?.definitions]);
  const filtered = list.hasActiveFilters || list.search !== "";

  // O estado (Todos, Ativos, Suspensos, Arquivados, Excluídos) mora no painel de filtros: um só parâmetro `status` na URL.
  const filters: AdminFilterDef[] = [
    {
      kind: "select",
      key: "status",
      label: "Status do workspace",
      options: [...WORKSPACE_STATUS_OPTIONS, { value: WORKSPACE_DELETED_STATUS, label: "Excluídos" }],
      defaultValue: "",
    },
    ...WORKSPACE_LIST_FILTERS,
  ];

  return (
    <AdminPage>
      <AdminPageHeader
        title="Pessoas"
        subtitle="Quem acessa a plataforma: usuários, criadores e os workspaces dos clientes."
        actions={<NewAccountButton />}
      />

      <PeopleIsland current="workspaces">
      <AdminFilterBar
        search={
          <AdminSearchInput
            value={list.search}
            onSearch={list.setSearch}
            label="Buscar workspaces"
            placeholder="Buscar por nome, responsável ou identificador"
          />
        }
        searchLabel="Buscar workspaces"
        filters={filters}
        values={list.filters}
        onChange={(patch) => list.setFilters(patch as Partial<Record<WorkspaceFilterKey, string>>)}
        onClear={list.clearFilters}
        compact
        beforeFilters={
          <AdminSortMenu
            options={WORKSPACE_SORT_OPTIONS}
            sortBy={list.sortBy}
            order={list.order}
            defaultSortBy={WORKSPACE_LIST_CONFIG.defaultSortBy as string}
            defaultOrder="desc"
            onSort={list.setSort}
          />
        }
        trailing={<AdminRefreshButton iconOnly onClick={() => void query.refetch()} loading={query.isFetching} />}
      />
      </PeopleIsland>

      <AdminTable
        caption="Workspaces"
        columns={columns}
        rows={query.data?.data}
        rowKey={(workspace) => workspace.id}
        rowLink={(workspace) => ({ to: "/admin/workspaces/$workspaceId", params: { workspaceId: workspace.id } })}
        sort={{ by: list.sortBy, order: list.order }}
        onSort={(key) => list.toggleSort(key, WORKSPACE_SORT_FIRST_ORDER[key] ?? "asc")}
        loading={query.isLoading}
        refreshing={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
        empty={
          filtered
            ? {
                title: "Nenhum workspace encontrado",
                description: "Nenhum workspace corresponde à busca e aos filtros atuais.",
                action: (
                  <button type="button" className="btn out adm-btn-sm" onClick={list.reset}>
                    Limpar busca e filtros
                  </button>
                ),
              }
            : { title: "Nenhum workspace ainda", description: "Quando um cliente criar um workspace, ele aparece nesta lista." }
        }
        footer={
          meta ? (
            <AdminPager
              page={meta.page}
              perPage={meta.per_page}
              total={meta.total}
              onPageChange={list.setPage}
              onPerPageChange={list.setPerPage}
              disabled={query.isFetching}
            />
          ) : undefined
        }
      />
    </AdminPage>
  );
}

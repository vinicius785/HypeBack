import { useMemo } from "react";

import {
  AdminFilterBar,
  AdminPage,
  AdminPageHeader,
  AdminPager,
  AdminRefreshButton,
  AdminSearchInput,
  AdminTable,
  type AdminFilterDef,
} from "@/components/admin/platform";
import { useAdminListQueryState, useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { useAdminWorkspaceList } from "@/hooks/admin/use-admin-workspaces";

import {
  WORKSPACE_DELETED_STATUS,
  WORKSPACE_LIST_CONFIG,
  WORKSPACE_LIST_FILTERS,
  WORKSPACE_SORT_FIRST_ORDER,
  WORKSPACE_STATUS_OPTIONS,
  type WorkspaceFilterKey,
} from "./workspace-constants";
import { buildWorkspaceColumns } from "./workspaces-list-columns";

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
  const query = useAdminWorkspaceList(list.params);
  const meta = query.data?.meta;
  useAdminPageClamp(list.page, meta?.total_pages, list.setPage);

  const columns = useMemo(() => buildWorkspaceColumns(meta?.definitions), [meta?.definitions]);
  const filtered = list.hasActiveFilters || list.search !== "";

  const deletedOnly = list.filters.status === WORKSPACE_DELETED_STATUS;
  // "Excluídos" é um liga/desliga da barra que escreve `status=deleted`. Sem `onClear`: o chip e "Limpar filtros"
  // chamam `onToggle` (só com o filtro ativo), que já leva `status` de volta ao padrão: nunca vira duas vezes.
  const filters: AdminFilterDef[] = [
    ...WORKSPACE_LIST_FILTERS,
    {
      kind: "toggle",
      id: "deleted",
      label: "Excluídos",
      active: deletedOnly,
      summary: "Status: Excluídos",
      inline: true,
      onToggle: () => list.setFilter("status", deletedOnly ? "" : WORKSPACE_DELETED_STATUS),
    },
  ];

  return (
    <AdminPage>
      <AdminPageHeader title="Workspaces" subtitle="Todos os clientes da plataforma." />

      <AdminFilterBar
        segment={{
          options: WORKSPACE_STATUS_OPTIONS,
          value: list.filters.status,
          onChange: (value) => list.setFilter("status", value),
          ariaLabel: "Status do workspace",
        }}
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
        trailing={<AdminRefreshButton iconOnly onClick={() => void query.refetch()} loading={query.isFetching} />}
      />

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

import { useMemo } from "react";

import {
  AdminEntityCell,
  AdminFilterBar,
  AdminPager,
  AdminSearchInput,
  AdminTable,
  type AdminLinkTarget,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useAdminFinancialByWorkspace } from "@/hooks/admin/use-admin-financial";
import { useAdminListQueryState, useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { formatBRLFromCents } from "@/lib/admin/format";
import type { AdminDateRange, AdminFinancialByWorkspaceRow } from "@/shared/admin-platform.types";

import { FinancialRefreshButton } from "./financial-refresh";
import { BY_WORKSPACE_LIST_CONFIG } from "./financial-search";

import "@/styles/admin-financial.css";

type Row = AdminFinancialByWorkspaceRow;

/** Destino da linha: a aba Financeiro do detalhe do workspace (a linha "não atribuído" não tem para onde ir). */
function rowTarget(row: Row): AdminLinkTarget | undefined {
  if (!row.workspace) return undefined;
  return { to: "/admin/workspaces/$workspaceId", params: { workspaceId: row.workspace.id }, search: { tab: "financial" } };
}

function Money({ cents }: { cents: number }) {
  return <span className={cents === 0 ? "adm-num adm-muted" : "adm-num"}>{formatBRLFromCents(cents)}</span>;
}

function buildColumns(definitions: Record<string, string> | undefined): AdminTableColumn<Row>[] {
  const money = (
    key: keyof Pick<Row, "funded_cents" | "custody_cents" | "committed_cents" | "released_cents" | "paid_pix_cents">,
    header: string,
    sortKey?: string,
  ): AdminTableColumn<Row> => ({
    key,
    header,
    sortKey,
    definition: definitions?.[key],
    align: "right",
    nowrap: true,
    width: "minmax(112px, 1fr)",
    cell: (row) => <Money cents={row[key]} />,
  });

  return [
    {
      key: "workspace",
      header: "Workspace",
      sortKey: "name",
      primary: true,
      width: "minmax(0, 2fr)",
      cell: (row) =>
        row.workspace ? (
          <AdminEntityCell name={row.workspace.name} shape="square" size={36} />
        ) : (
          <div className="adm-fin-unassigned">
            <b>Não atribuído</b>
            <small>Valores sem workspace</small>
          </div>
        ),
    },
    money("funded_cents", "Aportes", "funded"),
    money("custody_cents", "Custódia", "custody"),
    money("committed_cents", "Comprometido", "committed"),
    money("released_cents", "Liberado", "released"),
    // O contrato não oferece ordenação por PIX concluído.
    money("paid_pix_cents", "Pago via PIX"),
  ];
}

interface FinancialByWorkspaceProps {
  period: AdminDateRange;
}

/**
 * Por workspace: quanto cada cliente aportou, quanto tem em custódia e comprometido, quanto foi liberado e
 * quanto virou PIX concluído, mais a linha "Não atribuído" (valores sem workspace). Ordena por coluna, busca por
 * nome e pagina; clicar na linha abre a aba Financeiro do workspace.
 */
export function FinancialByWorkspace({ period }: FinancialByWorkspaceProps) {
  const state = useAdminListQueryState(BY_WORKSPACE_LIST_CONFIG);
  // O período é da página, não da lista: sempre explícito, nunca o que sobrou solto na URL.
  const params = useMemo(() => ({ ...state.params, from: period.from, to: period.to }), [state.params, period.from, period.to]);
  const query = useAdminFinancialByWorkspace(params);
  const meta = query.data?.meta;
  useAdminPageClamp(state.page, meta?.total_pages, state.setPage);

  const columns = useMemo(() => buildColumns(meta?.definitions), [meta?.definitions]);
  const searching = state.search !== "";

  return (
    <div className="adm-fin-stack">
      <AdminFilterBar
        search={<AdminSearchInput value={state.search} onSearch={state.setSearch} placeholder="Buscar workspace" label="Buscar workspaces" />}
        searchLabel="Buscar workspaces"
        trailing={<FinancialRefreshButton />}
      />

      <AdminTable
        caption="Financeiro por workspace"
        columns={columns}
        rows={query.data?.data}
        rowKey={(row) => row.workspace?.id ?? "unassigned"}
        rowLink={rowTarget}
        sort={{ by: state.sortBy, order: state.order }}
        onSort={(key) => state.toggleSort(key, key === "name" ? "asc" : "desc")}
        loading={query.isLoading}
        refreshing={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        empty={{
          title: searching ? "Nenhum workspace encontrado" : "Nenhum workspace com valores neste período",
          description: searching ? "Tente outro nome ou limpe a busca." : "Tente um período maior.",
          action: searching ? (
            <button type="button" className="btn out adm-btn-sm" onClick={() => state.setSearch("")}>
              Limpar busca
            </button>
          ) : undefined,
        }}
        footer={
          meta ? (
            <AdminPager
              page={meta.page}
              perPage={meta.per_page}
              total={meta.total}
              onPageChange={state.setPage}
              onPerPageChange={state.setPerPage}
              disabled={query.isFetching}
            />
          ) : undefined
        }
      />

      <p className="adm-fin-table-note">Aportes, liberado e pago via PIX são do período escolhido. Custódia e comprometido são a posição de agora.</p>
    </div>
  );
}

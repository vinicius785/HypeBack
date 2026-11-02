import { useId, type CSSProperties, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";

import { AdminEmptyState } from "./admin-empty-state";
import { AdminErrorState } from "./admin-error-state";
import { AdminInfoPopover } from "./admin-info-popover";
import { AdminLink, type AdminLinkTarget } from "./admin-link";
import { AdminSkeleton } from "./admin-skeleton";

import "@/styles/admin-platform.css";

export interface AdminTableColumn<T> {
  /** Identifica a coluna (chave React); também é a chave de ordenação quando `sortable` e sem `sortKey`. */
  key: string;
  /** Texto do cabeçalho; no modo empilhado (celular) é o rótulo do valor. */
  header: string;
  cell: (row: T, index: number) => ReactNode;
  /** Trilho da grade CSS (`'120px'`, `'minmax(0, 2fr)'`). Padrão: `minmax(0, 1fr)`. */
  width?: string;
  align?: "left" | "right" | "center";
  /** O cabeçalho vira botão de ordenação com esta chave (a do contrato: `sort_by`). */
  sortKey?: string;
  sortable?: boolean;
  /** Some em contêineres mais estreitos que ~1180px (`lg`) ou ~960px (`md`); no celular volta a aparecer. */
  hideBelow?: "md" | "lg";
  /** "Como é calculado": o "i" ao lado do cabeçalho. */
  definition?: ReactNode;
  /** Coluna que leva o link da linha e vira o título no modo empilhado. Padrão: a primeira. */
  primary?: boolean;
  /** Rótulo no modo empilhado, quando difere do cabeçalho (`''` esconde o rótulo: coluna de ações). */
  mobileLabel?: string;
  /** Sem quebra de linha (valores monetários, datas). */
  nowrap?: boolean;
  /** No modo empilhado ocupa a linha inteira. */
  wide?: boolean;
}

export interface AdminTableSort {
  by?: string;
  order: "asc" | "desc";
}

export interface AdminTableProps<T> {
  columns: readonly AdminTableColumn<T>[];
  /** `undefined` enquanto não chegou nada. */
  rows: readonly T[] | undefined;
  rowKey: (row: T) => string | number;
  /** Nome da tabela para leitor de tela ("Workspaces"). */
  caption: string;
  /** Destino da linha: a linha inteira clica (link de verdade, abre em nova aba). */
  rowLink?: (row: T) => AdminLinkTarget | undefined;
  sort?: AdminTableSort;
  /** Clique no cabeçalho ordenável (recebe a chave de ordenação). */
  onSort?: (sortKey: string) => void;
  /** Primeira carga, sem dado nenhum: esqueleto. */
  loading?: boolean;
  /** Recarregando com dado na tela (trocar página, filtro): a lista fica, só esmaece. */
  refreshing?: boolean;
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  empty?: { title: string; description?: ReactNode; action?: ReactNode };
  skeletonRows?: number;
  /** Cabeçalho que acompanha a rolagem da página (padrão: sim). */
  stickyHeader?: boolean;
  /** Rodapé da tabela (a `AdminPager`). */
  footer?: ReactNode;
}

const DEFAULT_TRACK = "minmax(0, 1fr)";
/** Larguras do esqueleto: variam por coluna para não parecer uma grade de blocos iguais. */
const SKELETON_WIDTHS = ["72%", "48%", "62%", "40%", "56%", "34%"];

function sortKeyOf<T>(column: AdminTableColumn<T>): string | undefined {
  if (column.sortKey) return column.sortKey;
  return column.sortable ? column.key : undefined;
}

/**
 * Tabela do Admin feita de `div` com papéis ARIA (`table`, `row`, `columnheader`, `cell`): o `.pv table`
 * global reestiliza `<table>`/`th`/`td`, então a semântica de tabela vem dos papéis, não das tags.
 *
 * - colunas por configuração (cabeçalho, célula, largura, alinhamento, ordenação, definição);
 * - linha clicável com link de verdade (esticado sobre a linha), sem armadilha para links dentro das células;
 * - cabeçalho fixo; esqueleto na primeira carga; esmaece ao recarregar; estado vazio e de erro com "tentar de novo";
 * - responsiva pela largura do próprio contêiner: some colunas (`hideBelow`) e, no celular, vira blocos
 *   "rótulo / valor" com um seletor de ordenação no lugar dos cabeçalhos.
 *
 * Uso com o React Query: `rows={q.data?.data}`, `loading={q.isLoading}`, `refreshing={q.isFetching && !q.isLoading}`,
 * `error={q.error}`, `onRetry={() => q.refetch()}`.
 */
export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  rowLink,
  sort,
  onSort,
  loading,
  refreshing,
  error,
  onRetry,
  retrying,
  empty,
  skeletonRows = 8,
  stickyHeader = true,
  footer,
}: AdminTableProps<T>) {
  const sortId = useId();
  const track = (c: AdminTableColumn<T>) => c.width ?? DEFAULT_TRACK;
  const style = {
    "--adm-cols": columns.map(track).join(" "),
    "--adm-cols-lg": columns.filter((c) => c.hideBelow !== "lg").map(track).join(" "),
    "--adm-cols-md": columns.filter((c) => !c.hideBelow).map(track).join(" "),
  } as CSSProperties;

  const primaryIndex = Math.max(
    0,
    columns.findIndex((c) => c.primary),
  );
  const sortable = columns.filter((c) => sortKeyOf(c));
  const hasRows = !!rows && rows.length > 0;
  const showError = !!error && !hasRows;
  const showSkeleton = !showError && !hasRows && (!!loading || !rows);
  const showEmpty = !showError && !showSkeleton && !hasRows;

  const stateRow = (children: ReactNode) => (
    <div className="adm-tbody" role="rowgroup">
      <div className="adm-state-row" role="row">
        <div role="cell" aria-colspan={columns.length}>
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div className="adm-table" data-sticky={stickyHeader ? undefined : "false"} style={style}>
      {sortable.length > 0 && onSort && hasRows ? (
        <div className="adm-sortbar">
          <label htmlFor={sortId}>Ordenar por</label>
          <select
            id={sortId}
            value={sort?.by ?? ""}
            onChange={(event) => {
              if (event.target.value) onSort(event.target.value);
            }}
          >
            {!sort?.by ? <option value="">Padrão</option> : null}
            {sortable.map((column) => (
              <option key={column.key} value={sortKeyOf(column)}>
                {column.header}
              </option>
            ))}
          </select>
          {sort?.by ? (
            <button
              type="button"
              aria-label={sort.order === "asc" ? "Ordem crescente: inverter" : "Ordem decrescente: inverter"}
              onClick={() => onSort(sort.by as string)}
            >
              <I n={sort.order === "asc" ? "arrup" : "arrdown"} cls="sm" />
            </button>
          ) : null}
        </div>
      ) : null}

      {loading || showSkeleton ? (
        <span className="adm-sr" role="status">
          Carregando…
        </span>
      ) : null}

      {/* Falha ao atualizar com a lista antiga ainda na tela: aviso sem esconder os dados. */}
      {error && hasRows ? (
        <div className="adm-table-alert">
          <AdminErrorState error={error} onRetry={onRetry} retrying={retrying} compact />
        </div>
      ) : null}

      <div role="table" aria-label={caption} aria-busy={loading || refreshing ? true : undefined}>
        {!showError ? (
          <div className="adm-thead-group" role="rowgroup">
            <div className="adm-thead" role="row">
              {columns.map((column) => {
                const key = sortKeyOf(column);
                const active = !!key && sort?.by === key;
                const ariaSort = !key ? undefined : active ? (sort?.order === "asc" ? "ascending" : "descending") : "none";
                return (
                  <div
                    key={column.key}
                    className="adm-th"
                    role="columnheader"
                    aria-sort={ariaSort}
                    data-align={column.align}
                    data-hide={column.hideBelow}
                  >
                    {key && onSort ? (
                      <button type="button" className="adm-th-btn" onClick={() => onSort(key)}>
                        {column.header}
                        <I n={active && sort?.order === "asc" ? "arrup" : "arrdown"} />
                      </button>
                    ) : (
                      column.header
                    )}
                    {column.definition ? <AdminInfoPopover label={column.header}>{column.definition}</AdminInfoPopover> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {showError ? (
          stateRow(<AdminErrorState error={error} onRetry={onRetry} retrying={retrying} compact />)
        ) : showSkeleton ? (
          <div className="adm-tbody" role="rowgroup">
            {Array.from({ length: skeletonRows }, (_, row) => (
              <div className="adm-row" role="row" key={row} aria-hidden="true">
                {columns.map((column, index) => (
                  <div
                    className="adm-cell"
                    role="cell"
                    key={column.key}
                    data-align={column.align}
                    data-hide={column.hideBelow}
                    data-primary={index === primaryIndex ? "true" : undefined}
                    data-label={column.mobileLabel ?? column.header}
                  >
                    <AdminSkeleton
                      height={index === primaryIndex ? 16 : 14}
                      width={SKELETON_WIDTHS[(row + index) % SKELETON_WIDTHS.length]}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : showEmpty ? (
          stateRow(
            <AdminEmptyState
              compact
              title={empty?.title ?? "Nada por aqui"}
              description={empty?.description}
              action={empty?.action}
            />,
          )
        ) : (
          <div className="adm-tbody" role="rowgroup" aria-busy={refreshing ? true : undefined}>
            {rows?.map((row, rowIndex) => {
              const target = rowLink?.(row);
              return (
                <div className="adm-row" role="row" key={rowKey(row)} data-link={target ? "true" : undefined}>
                  {columns.map((column, index) => {
                    const content = column.cell(row, rowIndex);
                    return (
                      <div
                        className="adm-cell"
                        role="cell"
                        key={column.key}
                        data-align={column.align}
                        data-hide={column.hideBelow}
                        data-nowrap={column.nowrap ? "true" : undefined}
                        data-wide={column.wide ? "true" : undefined}
                        data-primary={index === primaryIndex ? "true" : undefined}
                        data-label={column.mobileLabel ?? column.header}
                      >
                        {target && index === primaryIndex ? (
                          <AdminLink to={target} className="adm-row-link">
                            {content}
                          </AdminLink>
                        ) : (
                          content
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {footer ? <div className="adm-table-foot">{footer}</div> : null}
    </div>
  );
}

import { Fragment, useId, useState, type CSSProperties, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";

import { AdminEmptyState } from "./admin-empty-state";
import { AdminErrorState } from "./admin-error-state";
import { AdminInfoPopover } from "./admin-info-popover";
import { AdminLink, type AdminLinkTarget } from "./admin-link";
import { AdminSkeleton } from "./admin-skeleton";

import "@/styles/admin-platform.css";
import "@/styles/admin-kit-ext.css";

/** Nomes dos cortes de coluna, em px da largura do contêiner da tabela (não da janela). */
export type AdminTableBreakpoint = "sm" | "md" | "lg";

/** `md` e `lg` são os cortes históricos do kit (960 e 1180); `sm` é o mais estreito antes do modo empilhado. */
export const ADMIN_TABLE_BREAKPOINTS: Readonly<Record<AdminTableBreakpoint, number>> = { sm: 840, md: 960, lg: 1180 };

/** Abaixo (e até) disto a tabela vira blocos "rótulo / valor" e mostra todas as colunas: corte menor que isto não tem efeito. */
const STACKED_MAX = 720;

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
  /**
   * Some quando o contêiner da tabela fica com esta largura ou menos: um breakpoint (`'sm'` 840, `'md'` 960,
   * `'lg'` 1180) ou os px (`1100`). No modo empilhado (≤ 720px) volta a aparecer, e um corte ≤ 720 nunca esconde nada.
   */
  hideBelow?: AdminTableBreakpoint | number;
  /**
   * Nome acessível do cabeçalho quando ele não tem texto (coluna de ações) ou o texto não diz tudo.
   * Vira o `aria-label` do `columnheader`; também é o que o seletor de ordenação do celular mostra.
   */
  headerLabel?: string;
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
  /**
   * Torna a linha expansível: a 1ª célula ganha um botão (`aria-expanded`/`aria-controls`) que abre o que esta
   * função devolve numa linha logo abaixo. Só é chamada com a linha aberta. Convive com `rowLink`.
   *
   * O botão ocupa espaço dentro da coluna 0, então a tabela soma a largura dele (`var(--adm-hit) - 2px`) ao
   * trilho dessa coluna sozinha: `width: '120px'` vira `calc(120px + …)` e `minmax(160px, 2fr)` vira
   * `minmax(calc(160px + …), 2fr)`. A tela não precisa alargar a coluna à mão. Trilhos flexíveis (`fr`, o padrão
   * `minmax(0, 1fr)`) e de conteúdo (`auto`, `max-content`…) ficam como estão: já se ajustam ao que sobra.
   */
  renderExpanded?: (row: T) => ReactNode;
  /** Nome do botão de expandir de cada linha ("Detalhes de Acme"). Padrão: "Detalhes". */
  expandLabel?: (row: T) => string;
  /**
   * Coluna de ações fixa à direita (largura mínima `var(--adm-hit)`), sem cabeçalho visível: o menu "⋯" da linha.
   * No celular vai para o canto do cartão.
   */
  rowActions?: (row: T) => ReactNode;
  /** Nome do cabeçalho da coluna de ações para leitor de tela. Padrão: "Ações". */
  rowActionsLabel?: string;
}

const DEFAULT_TRACK = "minmax(0, 1fr)";

/** O que o botão de expandir ocupa na célula 0: o botão (`--adm-hit`), menos a margem negativa (8px) mais o vão (6px). */
const EXPAND_EXTRA = "(var(--adm-hit) - 2px)";

/** Soma o botão de expandir a um comprimento; zero (o mínimo do padrão), `fr` e palavras-chave de conteúdo não levam soma. */
function widenLength(part: string): string {
  const value = part.trim();
  if (/^[-+]?0*\.?0+(px|rem|em|%|ch|vw)?$/i.test(value) || /^[-+]?(\d+\.?\d*|\.\d+)fr$/i.test(value) || /^(auto|min-content|max-content)$/i.test(value) || /^fit-content\(/i.test(value)) {
    return value;
  }
  return `calc(${value} + ${EXPAND_EXTRA})`;
}

/** Corta `a, b` na vírgula de fora dos parênteses (`minmax(calc(1px + 2px), 1fr)`). */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/** Trilho da coluna 0 de uma tabela com `renderExpanded`: o do trilho mais o botão de expandir. */
function expandableTrack(width: string): string {
  const trimmed = width.trim();
  const minmax = /^minmax\((.*)\)$/i.exec(trimmed);
  if (minmax) {
    const args = splitTopLevel(minmax[1]);
    if (args.length === 2) return `minmax(${widenLength(args[0])}, ${widenLength(args[1])})`;
    return trimmed;
  }
  return widenLength(trimmed);
}
/** Larguras do esqueleto: variam por coluna para não parecer uma grade de blocos iguais. */
const SKELETON_WIDTHS = ["72%", "48%", "62%", "40%", "56%", "34%"];

function sortKeyOf<T>(column: AdminTableColumn<T>): string | undefined {
  if (column.sortKey) return column.sortKey;
  return column.sortable ? column.key : undefined;
}

/** Trilho da coluna de ações: cabe um botão de toque e cresce se houver mais de um. */
const ACTIONS_TRACK = "minmax(var(--adm-hit), max-content)";

/** Largura (px) do contêiner até a qual a coluna some; `undefined` = nunca some. Inválido ou ≤ 720 não esconde. */
function hideThreshold<T>(column: AdminTableColumn<T>): number | undefined {
  const raw = column.hideBelow;
  if (raw === undefined) return undefined;
  const px = typeof raw === "number" ? raw : ADMIN_TABLE_BREAKPOINTS[raw];
  if (!Number.isFinite(px)) return undefined;
  const rounded = Math.round(px);
  return rounded > STACKED_MAX ? rounded : undefined;
}

/** Valor de `data-hide`: o nome do breakpoint ou os px (o CSS do kit já conhece `md` e `lg`). */
function hideAttr<T>(column: AdminTableColumn<T>): string | undefined {
  const threshold = hideThreshold(column);
  if (threshold === undefined) return undefined;
  return typeof column.hideBelow === "string" ? column.hideBelow : String(threshold);
}

/**
 * CSS dos cortes de coluna de uma tabela que usa `sm` ou px. `md` e `lg` sozinhos continuam no CSS do kit;
 * quando a tabela mistura os cortes, este bloco assume todos (mais específico que o do kit) para a grade e as
 * células escondidas nunca discordarem. Só entram inteiros e nomes de breakpoint (as larguras das colunas vão
 * em variáveis CSS, `--adm-cols-t<px>`), então nada vindo de fora vira texto de CSS.
 */
function responsiveCss<T>(scope: string, columns: readonly AdminTableColumn<T>[]): string {
  const hideable = columns.filter((c) => hideThreshold(c) !== undefined);
  const thresholds = [...new Set(hideable.map((c) => hideThreshold(c) as number))].sort((a, b) => b - a);
  const root = `.pv .adm-table[data-adm-scope="${scope}"]`;
  return thresholds
    .map((limit) => {
      const hidden = [...new Set(hideable.filter((c) => (hideThreshold(c) as number) >= limit).map((c) => hideAttr(c) as string))];
      const hides = hidden.map((value) => `${root} .adm-th[data-hide="${value}"], ${root} .adm-cell[data-hide="${value}"]`).join(", ");
      return (
        `@container adm-table (width > ${STACKED_MAX}px) and (width <= ${limit}px) {` +
        ` ${root} .adm-thead, ${root} .adm-row { grid-template-columns: var(--adm-cols-t${limit}); }` +
        ` ${hides} { display: none; } }`
      );
    })
    .join("\n");
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
  renderExpanded,
  expandLabel,
  rowActions,
  rowActionsLabel = "Ações",
}: AdminTableProps<T>) {
  const sortId = useId();
  const scope = useId();
  const [expanded, setExpanded] = useState<ReadonlySet<string | number>>(() => new Set());
  const track = (c: AdminTableColumn<T>) => {
    const width = c.width ?? DEFAULT_TRACK;
    // O botão de expandir mora na célula 0 (a primeira coluna, mesmo que não seja a `primary`).
    return renderExpanded && c === columns[0] ? expandableTrack(width) : width;
  };
  const tail = rowActions ? [ACTIONS_TRACK] : [];
  // Colunas que ainda cabem quando o contêiner tem `limit` px: as que não somem, ou somem só abaixo de um corte menor.
  const tracksAbove = (limit: number) =>
    [...columns.filter((c) => (hideThreshold(c) ?? -1) < limit).map(track), ...tail].join(" ");
  const thresholds = [...new Set(columns.map(hideThreshold).filter((v): v is number => v !== undefined))];
  // `md` e `lg` sozinhos seguem no CSS do kit; `sm` ou px pedem o CSS gerado (`responsiveCss`).
  const customCuts = columns.some((c) => hideThreshold(c) !== undefined && c.hideBelow !== "md" && c.hideBelow !== "lg");
  const style = {
    "--adm-cols": [...columns.map(track), ...tail].join(" "),
    "--adm-cols-lg": tracksAbove(ADMIN_TABLE_BREAKPOINTS.lg),
    "--adm-cols-md": tracksAbove(ADMIN_TABLE_BREAKPOINTS.md),
    ...(customCuts ? Object.fromEntries(thresholds.map((limit) => [`--adm-cols-t${limit}`, tracksAbove(limit)])) : {}),
  } as CSSProperties;
  const columnCount = columns.length + (rowActions ? 1 : 0);
  const toggleExpanded = (key: string | number) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const primaryIndex = Math.max(
    0,
    columns.findIndex((c) => c.primary),
  );
  const sortable = columns.filter((c) => sortKeyOf(c));
  // `sort_by` vindo da URL pode não existir nas colunas: o seletor fica neutro em vez de mostrar outra opção.
  const sortValue = sort?.by && sortable.some((c) => sortKeyOf(c) === sort.by) ? sort.by : "";
  const hasRows = !!rows && rows.length > 0;
  const showError = !!error && !hasRows;
  const showSkeleton = !showError && !hasRows && (!!loading || !rows);
  const showEmpty = !showError && !showSkeleton && !hasRows;

  const stateRow = (children: ReactNode) => (
    <div className="adm-tbody" role="rowgroup">
      <div className="adm-state-row" role="row">
        <div role="cell" aria-colspan={columnCount}>
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="adm-table"
      data-sticky={stickyHeader ? undefined : "false"}
      data-adm-scope={customCuts ? scope : undefined}
      style={style}
    >
      {customCuts ? <style>{responsiveCss(scope, columns)}</style> : null}
      {sortable.length > 0 && onSort && hasRows ? (
        <div className="adm-sortbar">
          <label htmlFor={sortId}>Ordenar por</label>
          <select
            id={sortId}
            value={sortValue}
            onChange={(event) => {
              if (event.target.value) onSort(event.target.value);
            }}
          >
            {!sortValue ? <option value="">{sort?.by ? "Ordenar por" : "Padrão"}</option> : null}
            {sortable.map((column) => (
              <option key={column.key} value={sortKeyOf(column)}>
                {column.headerLabel ?? column.header}
              </option>
            ))}
          </select>
          {sortValue ? (
            <button
              type="button"
              aria-label={sort?.order === "asc" ? "Ordem crescente: inverter" : "Ordem decrescente: inverter"}
              onClick={() => onSort(sortValue)}
            >
              <I n={sort?.order === "asc" ? "arrup" : "arrdown"} cls="sm" />
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
                    aria-label={column.headerLabel}
                    data-align={column.align}
                    data-hide={hideAttr(column)}
                  >
                    {key && onSort ? (
                      <button type="button" className="adm-th-btn" onClick={() => onSort(key)}>
                        {column.header}
                        <I n={active && sort?.order === "asc" ? "arrup" : "arrdown"} />
                      </button>
                    ) : (
                      column.header
                    )}
                    {column.definition ? (
                      <AdminInfoPopover label={column.headerLabel ?? column.header}>{column.definition}</AdminInfoPopover>
                    ) : null}
                  </div>
                );
              })}
              {rowActions ? <div className="adm-th adm-th-actions" role="columnheader" aria-label={rowActionsLabel} /> : null}
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
                    data-hide={hideAttr(column)}
                    data-primary={index === primaryIndex ? "true" : undefined}
                    data-label={column.mobileLabel ?? column.header}
                  >
                    <AdminSkeleton
                      height={index === primaryIndex ? 16 : 14}
                      width={SKELETON_WIDTHS[(row + index) % SKELETON_WIDTHS.length]}
                    />
                  </div>
                ))}
                {rowActions ? <div className="adm-cell adm-cell-actions" role="cell" data-actions="true" data-label="" /> : null}
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
              const key = rowKey(row);
              const isOpen = !!renderExpanded && expanded.has(key);
              const panelId = `${scope}-x-${rowIndex}`;
              return (
                <Fragment key={key}>
                  <div
                    className="adm-row"
                    role="row"
                    data-link={target ? "true" : undefined}
                    data-expanded={isOpen ? "true" : undefined}
                    data-has-actions={rowActions ? "true" : undefined}
                  >
                    {columns.map((column, index) => {
                      const content = column.cell(row, rowIndex);
                      const body =
                        target && index === primaryIndex ? (
                          <AdminLink to={target} className="adm-row-link">
                            {content}
                          </AdminLink>
                        ) : (
                          content
                        );
                      return (
                        <div
                          className="adm-cell"
                          role="cell"
                          key={column.key}
                          data-align={column.align}
                          data-hide={hideAttr(column)}
                          data-nowrap={column.nowrap ? "true" : undefined}
                          data-wide={column.wide ? "true" : undefined}
                          data-primary={index === primaryIndex ? "true" : undefined}
                          data-label={column.mobileLabel ?? column.header}
                        >
                          {renderExpanded && index === 0 ? (
                            <div className="adm-cell-lead">
                              <button
                                type="button"
                                className="adm-expand"
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                aria-label={expandLabel ? expandLabel(row) : "Detalhes"}
                                onClick={() => toggleExpanded(key)}
                              >
                                <I n="chev" cls="sm" />
                              </button>
                              <div className="adm-cell-lead-body">{body}</div>
                            </div>
                          ) : (
                            body
                          )}
                        </div>
                      );
                    })}
                    {rowActions ? (
                      <div className="adm-cell adm-cell-actions" role="cell" data-actions="true" data-label="">
                        {rowActions(row)}
                      </div>
                    ) : null}
                  </div>
                  {isOpen && renderExpanded ? (
                    <div className="adm-xrow" role="row" id={panelId}>
                      <div className="adm-xcell" role="cell" aria-colspan={columnCount}>
                        {renderExpanded(row)}
                      </div>
                    </div>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {footer ? <div className="adm-table-foot">{footer}</div> : null}
    </div>
  );
}

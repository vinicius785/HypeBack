import { useEffect, useRef, useState } from "react";

import { I } from "@/components/prototype/ui";

import {
  BRAND_CAMPAIGN_LABEL,
  BRAND_SORT_LABEL,
  BRAND_STATUS_LABEL,
  DEFAULT_BRAND_FILTERS,
  countActiveBrandFilters,
  type BrandCampaignFilter,
  type BrandFilters,
  type BrandSort,
  type BrandStatusFilter,
} from "./brand-list";

function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

interface BrandToolbarProps {
  query: string;
  onQuery: (v: string) => void;
  filters: BrandFilters;
  onFilters: (f: BrandFilters) => void;
}

/**
 * Busca, Filtros e Ordenar na mesma barra da página Criadores (e na ordem da página Clientes), com os filtros ativos
 * listados abaixo como chips que se removem um a um.
 */
export function BrandToolbar({
  query,
  onQuery,
  filters,
  onFilters,
}: BrandToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const filtersRef = useDismiss(filtersOpen, () => setFiltersOpen(false));
  const sortRef = useDismiss(sortOpen, () => setSortOpen(false));
  const activeCount = countActiveBrandFilters(filters);
  const reset = () =>
    onFilters({ ...DEFAULT_BRAND_FILTERS, sort: filters.sort });

  const chips = [
    ...(filters.status !== DEFAULT_BRAND_FILTERS.status
      ? [
          {
            id: "status",
            label: `Estado: ${BRAND_STATUS_LABEL[filters.status]}`,
            remove: () =>
              onFilters({ ...filters, status: DEFAULT_BRAND_FILTERS.status }),
          },
        ]
      : []),
    ...(filters.campaigns !== "all"
      ? [
          {
            id: "campaigns",
            label: BRAND_CAMPAIGN_LABEL[filters.campaigns],
            remove: () => onFilters({ ...filters, campaigns: "all" as const }),
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="cx-bar fade bt-bar">
        <label className="cx-find">
          <I n="search" cls="sm" />
          <input
            type="search"
            placeholder="Buscar marca por nome ou descrição"
            aria-label="Buscar marca"
            value={query}
            autoComplete="off"
            onChange={(e) => onQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              className="cx-x"
              aria-label="Limpar busca"
              onClick={() => onQuery("")}
            >
              <I n="x" cls="sm" />
            </button>
          ) : null}
        </label>

        <div className={`cfw${filtersOpen ? " open" : ""}`} ref={filtersRef}>
          <button
            type="button"
            className={`cx-fb${activeCount > 0 ? " on" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <I n="funnel" cls="sm" />
            Filtros
            {activeCount > 0 ? (
              <em aria-label={`${activeCount} filtros ativos`}>
                {activeCount}
              </em>
            ) : null}
          </button>
          {filtersOpen ? (
            <div
              className="cfm right bt-pop"
              role="dialog"
              aria-label="Filtrar marcas"
            >
              <fieldset className="bt-grp">
                <legend>Estado</legend>
                <div role="group" aria-label="Estado da marca">
                  {(Object.keys(BRAND_STATUS_LABEL) as BrandStatusFilter[]).map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={filters.status === s}
                        className={`bt-pill${filters.status === s ? " on" : ""}`}
                        onClick={() => onFilters({ ...filters, status: s })}
                      >
                        {BRAND_STATUS_LABEL[s]}
                      </button>
                    ),
                  )}
                </div>
              </fieldset>
              <fieldset className="bt-grp">
                <legend>Campanhas</legend>
                <div role="group" aria-label="Campanhas da marca">
                  {(
                    Object.keys(BRAND_CAMPAIGN_LABEL) as BrandCampaignFilter[]
                  ).map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={filters.campaigns === c}
                      className={`bt-pill${filters.campaigns === c ? " on" : ""}`}
                      onClick={() => onFilters({ ...filters, campaigns: c })}
                    >
                      {BRAND_CAMPAIGN_LABEL[c]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button
                type="button"
                className="bt-clear"
                disabled={activeCount === 0}
                onClick={reset}
              >
                Limpar filtros
              </button>
            </div>
          ) : null}
        </div>

        <div className={`cfw${sortOpen ? " open" : ""}`} ref={sortRef}>
          <button
            type="button"
            className="cx-fb bt-sort"
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            aria-label={`Ordenar: ${BRAND_SORT_LABEL[filters.sort]}`}
            title={`Ordenar: ${BRAND_SORT_LABEL[filters.sort]}`}
            onClick={() => setSortOpen((v) => !v)}
          >
            <svg
              className="ico sm"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m3 16 4 4 4-4" />
              <path d="M7 20V4" />
              <path d="m21 8-4-4-4 4" />
              <path d="M17 4v16" />
            </svg>
            <span className="bt-sort-l">{BRAND_SORT_LABEL[filters.sort]}</span>
          </button>
          {sortOpen ? (
            <div className="cfm right" role="menu">
              <small className="cfh">Ordenar por</small>
              {(Object.keys(BRAND_SORT_LABEL) as BrandSort[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitemradio"
                  aria-checked={filters.sort === s}
                  className={filters.sort === s ? "on" : ""}
                  onClick={() => {
                    onFilters({ ...filters, sort: s });
                    setSortOpen(false);
                  }}
                >
                  {BRAND_SORT_LABEL[s]}
                  {filters.sort === s ? <I n="check" cls="sm" /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {chips.length > 0 ? (
        <div
          className="bt-chips fade"
          role="list"
          aria-label="Filtros aplicados"
        >
          {chips.map((c) => (
            <span key={c.id} className="bt-chip" role="listitem">
              {c.label}
              <button
                type="button"
                aria-label={`Remover filtro: ${c.label}`}
                onClick={c.remove}
              >
                <I n="x" cls="sm" />
              </button>
            </span>
          ))}
          <button type="button" className="bt-clear-all" onClick={reset}>
            Limpar filtros
          </button>
        </div>
      ) : null}
    </>
  );
}

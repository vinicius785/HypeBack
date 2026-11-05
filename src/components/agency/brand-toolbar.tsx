import { useEffect, useRef, useState } from "react";

import { FilterButton, FilterChips, PageControls, PageToolbar, SearchInput, SortControl } from "@/components/page/page-kit";

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

const BRAND_SORT_OPTIONS = (Object.keys(BRAND_SORT_LABEL) as BrandSort[]).map((k) => [k, BRAND_SORT_LABEL[k]] as const);

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
  const filtersRef = useDismiss(filtersOpen, () => setFiltersOpen(false));
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
    <PageControls>
      <PageToolbar>
        <SearchInput value={query} onChange={onQuery} placeholder="Buscar marca por nome ou descrição" label="Buscar marca" />

        <div className={`pg-menu${filtersOpen ? " open" : ""}`} ref={filtersRef}>
          <FilterButton count={activeCount} aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
            Filtros
          </FilterButton>
          {filtersOpen ? (
            <div className="pg-pop bt-pop" role="dialog" aria-label="Filtrar marcas">
              <fieldset className="bt-grp">
                <legend>Estado</legend>
                <div role="group" aria-label="Estado da marca">
                  {(Object.keys(BRAND_STATUS_LABEL) as BrandStatusFilter[]).map((s) => (
                    <button key={s} type="button" aria-pressed={filters.status === s} className={`bt-pill${filters.status === s ? " on" : ""}`} onClick={() => onFilters({ ...filters, status: s })}>
                      {BRAND_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="bt-grp">
                <legend>Campanhas</legend>
                <div role="group" aria-label="Campanhas da marca">
                  {(Object.keys(BRAND_CAMPAIGN_LABEL) as BrandCampaignFilter[]).map((c) => (
                    <button key={c} type="button" aria-pressed={filters.campaigns === c} className={`bt-pill${filters.campaigns === c ? " on" : ""}`} onClick={() => onFilters({ ...filters, campaigns: c })}>
                      {BRAND_CAMPAIGN_LABEL[c]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button type="button" className="bt-clear" disabled={activeCount === 0} onClick={reset}>
                Limpar filtros
              </button>
            </div>
          ) : null}
        </div>

        <SortControl options={BRAND_SORT_OPTIONS} value={filters.sort} onChange={(sort) => onFilters({ ...filters, sort })} />
      </PageToolbar>

      <FilterChips
        chips={chips.map((c) => ({ id: c.id, label: c.label, onRemove: c.remove }))}
        onClear={reset}
      />
    </PageControls>
  );
}

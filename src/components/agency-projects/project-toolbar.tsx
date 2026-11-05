import { useEffect, useRef, useState } from "react";

import { FilterButton, FilterChips, PageControls, PageToolbar, SearchInput, SortControl } from "@/components/page/page-kit";

import {
  PROJECT_HEALTH_FILTER_LABEL,
  PROJECT_HEALTH_FILTER_OPTIONS,
  PROJECT_SORT_OPTIONS,
  PROJECT_STATUS_FILTER_LABEL,
  PROJECT_STATUS_FILTER_OPTIONS,
  clearProjectFilters,
  countActiveProjectFilters,
  type ProjectFilters,
  type ResponsibleOption,
} from "./project-ui";

/** Fecha o popover ao clicar fora ou apertar Escape (o quadro de tarefas reaproveita). */
export function useDismiss(open: boolean, onClose: () => void) {
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

interface ProjectToolbarProps {
  query: string;
  onQuery: (v: string) => void;
  filters: ProjectFilters;
  onFilters: (f: ProjectFilters) => void;
  /** Quem aparece como responsável nos projetos (lista do filtro "Responsável"). */
  responsibles: readonly ResponsibleOption[];
}

/**
 * Busca, Filtros (popover com contador: Status, Saúde, Responsável) e Ordenar na barra do kit de páginas, com os
 * filtros ativos como chips que se removem um a um.
 */
export function ProjectToolbar({ query, onQuery, filters, onFilters, responsibles }: ProjectToolbarProps) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const activeCount = countActiveProjectFilters(filters);
  const reset = () => onFilters(clearProjectFilters(filters));
  const responsibleName = responsibles.find((r) => r.id === filters.responsible)?.name;

  const chips = [
    ...(filters.status !== "all"
      ? [{ id: "status", label: `Status: ${PROJECT_STATUS_FILTER_LABEL[filters.status]}`, onRemove: () => onFilters({ ...filters, status: "all" }) }]
      : []),
    ...(filters.health !== "all"
      ? [{ id: "health", label: `Saúde: ${PROJECT_HEALTH_FILTER_LABEL[filters.health]}`, onRemove: () => onFilters({ ...filters, health: "all" }) }]
      : []),
    ...(filters.responsible !== "all"
      ? [{ id: "responsible", label: `Responsável: ${responsibleName ?? "—"}`, onRemove: () => onFilters({ ...filters, responsible: "all" }) }]
      : []),
  ];

  return (
    <PageControls>
      <PageToolbar>
        <SearchInput value={query} onChange={onQuery} placeholder="Buscar por projeto, descrição ou responsável" label="Buscar projeto" />

        <div className={`pg-menu${open ? " open" : ""}`} ref={ref}>
          <FilterButton count={activeCount} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            Filtros
          </FilterButton>
          {open ? (
            <div className="pg-pop bt-pop" role="dialog" aria-label="Filtrar projetos">
              <fieldset className="bt-grp">
                <legend>Status</legend>
                <div role="group" aria-label="Status do projeto">
                  {PROJECT_STATUS_FILTER_OPTIONS.map((s) => (
                    <button key={s} type="button" aria-pressed={filters.status === s} className={`bt-pill${filters.status === s ? " on" : ""}`} onClick={() => onFilters({ ...filters, status: s })}>
                      {PROJECT_STATUS_FILTER_LABEL[s]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="bt-grp">
                <legend>Saúde</legend>
                <div role="group" aria-label="Saúde do projeto">
                  {PROJECT_HEALTH_FILTER_OPTIONS.map((h) => (
                    <button key={h} type="button" aria-pressed={filters.health === h} className={`bt-pill${filters.health === h ? " on" : ""}`} onClick={() => onFilters({ ...filters, health: h })}>
                      {PROJECT_HEALTH_FILTER_LABEL[h]}
                    </button>
                  ))}
                </div>
              </fieldset>
              {responsibles.length > 0 ? (
                <fieldset className="bt-grp">
                  <legend>Responsável</legend>
                  <div role="group" aria-label="Responsável pelo projeto" className="apj-resp">
                    <button type="button" aria-pressed={filters.responsible === "all"} className={`bt-pill${filters.responsible === "all" ? " on" : ""}`} onClick={() => onFilters({ ...filters, responsible: "all" })}>
                      Todos
                    </button>
                    {responsibles.map((r) => (
                      <button key={r.id} type="button" aria-pressed={filters.responsible === r.id} className={`bt-pill${filters.responsible === r.id ? " on" : ""}`} onClick={() => onFilters({ ...filters, responsible: r.id })}>
                        {r.name}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <button type="button" className="bt-clear" disabled={activeCount === 0} onClick={reset}>
                Limpar filtros
              </button>
            </div>
          ) : null}
        </div>

        <SortControl options={PROJECT_SORT_OPTIONS} value={filters.sort} onChange={(sort) => onFilters({ ...filters, sort })} />
      </PageToolbar>

      <FilterChips chips={chips} onClear={reset} />
    </PageControls>
  );
}

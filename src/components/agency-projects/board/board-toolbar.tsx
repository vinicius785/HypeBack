import { useState } from "react";

import { FilterButton, FilterChips, PageControls, PageToolbar, SearchInput } from "@/components/page/page-kit";
import { I } from "@/components/prototype/ui";
import { TASK_PRIORITIES, type TaskPriority } from "@/shared/services/agency-projects";

import { useDismiss } from "../project-toolbar";
import {
  DEFAULT_TASK_FILTERS,
  TASK_PERIOD_LABEL,
  TASK_PERIOD_OPTIONS,
  TASK_PRIORITY_LABEL,
  TASK_SORT_GROUPS,
  TASK_SORT_LABEL,
  countActiveTaskFilters,
  taskSortCategory,
  type ResponsibleOption,
  type StoredTaskSort,
  type TaskDeadlinePeriod,
  type TaskFilters,
  type TaskSortKey,
} from "../project-ui";

const SORT_OPTIONS: readonly { key: TaskSortKey; label: string }[] = TASK_SORT_GROUPS.flatMap((g) => g.options);

/** Liga/desliga um valor numa lista de filtro (dentro de uma categoria vale "ou"). */
function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface BoardToolbarProps {
  query: string;
  onQuery: (value: string) => void;
  filters: TaskFilters;
  onFilters: (filters: TaskFilters) => void;
  assignees: readonly ResponsibleOption[];
  tags: readonly string[];
  sort: StoredTaskSort;
  onSort: (sort: StoredTaskSort) => void;
  showSubtasks: boolean;
  onShowSubtasks: (value: boolean) => void;
  canWrite: boolean;
  onNewTask: () => void;
}

interface PillsProps<T extends string | number> {
  legend: string;
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  className?: string;
}

/** Grupo de botões de filtro (cada um liga/desliga; `aria-pressed` diz o estado). */
function Pills<T extends string | number>({ legend, options, selected, onToggle, className }: PillsProps<T>) {
  return (
    <fieldset className="bt-grp">
      <legend>{legend}</legend>
      <div role="group" aria-label={legend} className={className}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={selected.includes(o.value)} className={`bt-pill${selected.includes(o.value) ? " on" : ""}`} onClick={() => onToggle(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Barra do quadro: busca, Filtros (responsável, etiqueta, prioridade e período de prazo, com contador), Ordenar
 * (critério principal e desempate), "Subtarefas no quadro" e "Nova tarefa"; os filtros ativos viram chips removíveis.
 */
export function BoardToolbar({ query, onQuery, filters, onFilters, assignees, tags, sort, onSort, showSubtasks, onShowSubtasks, canWrite, onNewTask }: BoardToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const filterRef = useDismiss(filterOpen, () => setFilterOpen(false));
  const sortRef = useDismiss(sortOpen, () => setSortOpen(false));
  const activeCount = countActiveTaskFilters(filters);
  const reset = () => onFilters(DEFAULT_TASK_FILTERS);

  const chips = [
    ...filters.assignees.map((id) => ({
      id: `assignee-${id}`,
      label: `Responsável: ${assignees.find((a) => a.id === id)?.name ?? "—"}`,
      onRemove: () => onFilters({ ...filters, assignees: filters.assignees.filter((v) => v !== id) }),
    })),
    ...filters.tags.map((tag) => ({ id: `tag-${tag}`, label: `Etiqueta: ${tag}`, onRemove: () => onFilters({ ...filters, tags: filters.tags.filter((v) => v !== tag) }) })),
    ...filters.priorities.map((p) => ({
      id: `priority-${p}`,
      label: `Prioridade: ${TASK_PRIORITY_LABEL[p]}`,
      onRemove: () => onFilters({ ...filters, priorities: filters.priorities.filter((v) => v !== p) }),
    })),
    ...filters.periods.map((p) => ({ id: `period-${p}`, label: `Prazo: ${TASK_PERIOD_LABEL[p]}`, onRemove: () => onFilters({ ...filters, periods: filters.periods.filter((v) => v !== p) }) })),
  ];

  const primaryCategory = taskSortCategory(sort.primary);
  const secondaryOptions = SORT_OPTIONS.filter((o) => taskSortCategory(o.key) !== primaryCategory);
  const sortLabel = TASK_SORT_LABEL[sort.primary];

  return (
    <PageControls>
      <PageToolbar>
        <SearchInput value={query} onChange={onQuery} placeholder="Buscar por título, etiqueta ou responsável" label="Buscar tarefa" />

        <div className={`pg-menu${filterOpen ? " open" : ""}`} ref={filterRef}>
          <FilterButton count={activeCount} aria-haspopup="dialog" aria-expanded={filterOpen} onClick={() => setFilterOpen((v) => !v)}>
            Filtros
          </FilterButton>
          {filterOpen ? (
            <div className="pg-pop bt-pop" role="dialog" aria-label="Filtrar tarefas">
              {assignees.length > 0 ? (
                <Pills
                  legend="Responsável"
                  className="apj-resp"
                  options={assignees.map((a) => ({ value: a.id, label: a.name }))}
                  selected={filters.assignees}
                  onToggle={(id) => onFilters({ ...filters, assignees: toggle(filters.assignees, id) })}
                />
              ) : null}
              {tags.length > 0 ? (
                <Pills legend="Etiqueta" className="apj-resp" options={tags.map((t) => ({ value: t, label: t }))} selected={filters.tags} onToggle={(t) => onFilters({ ...filters, tags: toggle(filters.tags, t) })} />
              ) : null}
              <Pills
                legend="Prioridade"
                options={TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABEL[p] }))}
                selected={filters.priorities}
                onToggle={(p: TaskPriority) => onFilters({ ...filters, priorities: toggle(filters.priorities, p) })}
              />
              <Pills
                legend="Prazo"
                options={TASK_PERIOD_OPTIONS.map((p) => ({ value: p, label: TASK_PERIOD_LABEL[p] }))}
                selected={filters.periods}
                onToggle={(p: TaskDeadlinePeriod) => onFilters({ ...filters, periods: toggle(filters.periods, p) })}
              />
              <button type="button" className="bt-clear" disabled={activeCount === 0} onClick={reset}>
                Limpar filtros
              </button>
            </div>
          ) : null}
        </div>

        <div className={`pg-menu${sortOpen ? " open" : ""}`} ref={sortRef}>
          <button type="button" className={`pg-btn${sort.primary !== "none" ? " on" : ""}`} aria-haspopup="dialog" aria-expanded={sortOpen} aria-label={`Ordenar tarefas: ${sortLabel}`} title={`Ordenar: ${sortLabel}`} onClick={() => setSortOpen((v) => !v)}>
            <I n="sort" cls="sm" />
            <span className="pg-btn-l">{sort.primary === "none" ? "Ordenar" : sortLabel}</span>
          </button>
          {sortOpen ? (
            <div className="pg-pop bt-pop" role="dialog" aria-label="Ordenar tarefas">
              <fieldset className="bt-grp">
                <legend>Ordenar por</legend>
                <div role="group" aria-label="Critério principal">
                  {[{ key: "none" as TaskSortKey, label: TASK_SORT_LABEL.none }, ...SORT_OPTIONS].map((o) => (
                    <button key={o.key} type="button" aria-pressed={sort.primary === o.key} className={`bt-pill${sort.primary === o.key ? " on" : ""}`} onClick={() => onSort({ primary: o.key, secondary: taskSortCategory(sort.secondary) === taskSortCategory(o.key) ? "none" : sort.secondary })}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              {sort.primary !== "none" ? (
                <fieldset className="bt-grp">
                  <legend>Desempate</legend>
                  <div role="group" aria-label="Critério de desempate">
                    {[{ key: "none" as TaskSortKey, label: "Nenhum" }, ...secondaryOptions].map((o) => (
                      <button key={o.key} type="button" aria-pressed={sort.secondary === o.key} className={`bt-pill${sort.secondary === o.key ? " on" : ""}`} onClick={() => onSort({ ...sort, secondary: o.key })}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </div>
          ) : null}
        </div>

        <FilterButton icon="list" active={showSubtasks} aria-pressed={showSubtasks} onClick={() => onShowSubtasks(!showSubtasks)}>
          Subtarefas no quadro
        </FilterButton>

        {canWrite ? (
          <button type="button" className="btn apj-kb-new" onClick={onNewTask}>
            <I n="plus" cls="sm" />
            Nova tarefa
          </button>
        ) : null}
      </PageToolbar>

      <FilterChips chips={chips} onClear={reset} />
    </PageControls>
  );
}

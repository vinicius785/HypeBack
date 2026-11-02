import { useId, useState, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";
import { useSlidingIndicator } from "@/hooks/admin/use-sliding-indicator";
import { formatCivilDate, formatInt } from "@/lib/admin/format";

import "@/styles/admin-platform.css";

export interface AdminFilterOption {
  /** Valor que vai para a URL/API. `''` costuma ser "todos / sem filtro". */
  value: string;
  label: string;
  /** Contagem ao lado do nome (some quando `null`/`undefined`). */
  count?: number | null;
}

/** Lista de escolha única, como um seletor em pílula. */
export interface AdminSelectFilter {
  kind: "select";
  key: string;
  label: string;
  options: readonly AdminFilterOption[];
  /** Valor "sem filtro" (padrão `''`): nem conta como filtro ativo nem vira chip. */
  defaultValue?: string;
}

/** Poucas opções de escolha única, todas visíveis (o `PillGroup` do filtro de criadores). */
export interface AdminPillsFilter {
  kind: "pills";
  key: string;
  label: string;
  options: readonly AdminFilterOption[];
  defaultValue?: string;
}

/** Intervalo de datas civis (`YYYY-MM-DD`, o formato do contrato): dois campos de data. */
export interface AdminDateRangeFilter {
  kind: "date-range";
  label: string;
  fromKey: string;
  toKey: string;
}

export type AdminFilterDef = AdminSelectFilter | AdminPillsFilter | AdminDateRangeFilter;

interface AdminSegmentedControlProps {
  options: readonly AdminFilterOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/**
 * Controle segmentado (`.seg` do protótipo) com contagens opcionais e o indicador deslizante num hook só.
 * No celular rola na horizontal dentro do próprio controle.
 */
export function AdminSegmentedControl({ options, value, onChange, ariaLabel }: AdminSegmentedControlProps) {
  const { containerRef, indicatorRef } = useSlidingIndicator<HTMLDivElement>(
    value,
    options.map((o) => `${o.value}:${o.count ?? ""}`).join("|"),
  );
  return (
    <div className="seg" role="group" aria-label={ariaLabel} ref={containerRef}>
      <i className="ind" ref={indicatorRef} aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value || "all"}
          type="button"
          className={option.value === value ? "on" : ""}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== null && option.count !== undefined ? <em>{formatInt(option.count)}</em> : null}
        </button>
      ))}
    </div>
  );
}

interface AdminFilterBarProps {
  /** Estado da lista como controle segmentado (Todos / Ativos / Suspensos…). Não vira chip nem conta como filtro. */
  segment?: AdminSegmentedControlProps;
  /** Campo de busca (`AdminSearchInput`). */
  search?: ReactNode;
  filters?: readonly AdminFilterDef[];
  /** Valores atuais, por chave (`useAdminListQueryState().filters`). */
  values: Readonly<Record<string, string>>;
  /** Recebe só o que mudou (`{ activity: 'never' }`); o intervalo de datas manda as duas chaves. */
  onChange: (patch: Record<string, string>) => void;
  /** Aparece como "Limpar filtros" enquanto houver filtro ativo. */
  onClear?: () => void;
  /** À direita (exportar, atualizar…). */
  trailing?: ReactNode;
}

/** Valor de um filtro de escolha única; chave ausente de `values` é o valor padrão do filtro. */
function currentOf(def: AdminSelectFilter | AdminPillsFilter, values: Readonly<Record<string, string>>): string {
  return values[def.key] ?? def.defaultValue ?? "";
}

function isFilterActive(def: AdminFilterDef, values: Readonly<Record<string, string>>): boolean {
  if (def.kind === "date-range") return !!(values[def.fromKey] || values[def.toKey]);
  return currentOf(def, values) !== (def.defaultValue ?? "");
}

function optionLabel(options: readonly AdminFilterOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function SelectFilter({ def, value, onChange }: { def: AdminSelectFilter; value: string; onChange: (value: string) => void }) {
  const defaultValue = def.defaultValue ?? "";
  const current = def.options.find((o) => o.value === value) ?? def.options.find((o) => o.value === defaultValue) ?? def.options[0];
  return (
    <label className="adm-select" data-active={value !== defaultValue ? "true" : undefined}>
      <span className="adm-select-face">
        <span className="adm-select-k">{def.label}:</span>
        <span className="adm-select-v">{current?.label ?? "—"}</span>
        <I n="chev" cls="sm" />
      </span>
      <select value={value} aria-label={def.label} onChange={(event) => onChange(event.target.value)}>
        {def.options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
            {option.count !== null && option.count !== undefined ? ` (${formatInt(option.count)})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function PillsFilter({ def, value, onChange }: { def: AdminPillsFilter; value: string; onChange: (value: string) => void }) {
  return (
    <div className="adm-pills" role="group" aria-label={def.label}>
      <span className="adm-pills-k" aria-hidden="true">
        {def.label}
      </span>
      {def.options.map((option) => (
        <button
          key={option.value || "all"}
          type="button"
          className="adm-pill"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== null && option.count !== undefined ? <em>{formatInt(option.count)}</em> : null}
        </button>
      ))}
    </div>
  );
}

function DateRangeFilter({
  def,
  from,
  to,
  onChange,
}: {
  def: AdminDateRangeFilter;
  from: string;
  to: string;
  onChange: (patch: Record<string, string>) => void;
}) {
  return (
    <div className="adm-daterange" role="group" aria-label={def.label} data-active={from || to ? "true" : undefined}>
      <span className="adm-daterange-k">{def.label}</span>
      <input
        type="date"
        value={from}
        max={to || undefined}
        aria-label={`${def.label}: a partir de`}
        onChange={(event) => {
          const next = event.target.value;
          // Intervalo invertido (digitado à mão): o outro limite acompanha, em vez de uma consulta sem resultado.
          onChange({ [def.fromKey]: next, ...(next && to && next > to ? { [def.toKey]: next } : {}) });
        }}
      />
      <span className="adm-daterange-sep" aria-hidden="true">
        –
      </span>
      <input
        type="date"
        value={to}
        min={from || undefined}
        aria-label={`${def.label}: até`}
        onChange={(event) => {
          const next = event.target.value;
          onChange({ [def.toKey]: next, ...(next && from && next < from ? { [def.fromKey]: next } : {}) });
        }}
      />
    </div>
  );
}

interface Chip {
  id: string;
  text: string;
  remove: () => void;
}

/**
 * Barra de filtros das listas do Admin: segmentado de estado, busca, seletores, pílulas, intervalo de datas,
 * "Limpar filtros" e os chips dos filtros ativos (cada chip desfaz o seu).
 *
 * Declarativa: os mesmos `filters` desenham os controles e os chips, então nunca divergem. Não guarda
 * estado de filtro: `values`/`onChange` são o da URL (`useAdminListQueryState`). No celular a busca fica
 * com um botão "Filtros" que abre o resto num painel.
 */
export function AdminFilterBar({ segment, search, filters = [], values, onChange, onClear, trailing }: AdminFilterBarProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const selects = filters.filter((f): f is AdminSelectFilter | AdminDateRangeFilter => f.kind !== "pills");
  const pills = filters.filter((f): f is AdminPillsFilter => f.kind === "pills");
  const activeDefs = filters.filter((f) => isFilterActive(f, values));

  const chips: Chip[] = activeDefs.map((def) => {
    if (def.kind === "date-range") {
      const from = values[def.fromKey] ?? "";
      const to = values[def.toKey] ?? "";
      const range = from && to ? `${formatCivilDate(from)} – ${formatCivilDate(to)}` : from ? `a partir de ${formatCivilDate(from)}` : `até ${formatCivilDate(to)}`;
      return {
        id: `${def.fromKey}/${def.toKey}`,
        text: `${def.label}: ${range}`,
        remove: () => onChange({ [def.fromKey]: "", [def.toKey]: "" }),
      };
    }
    return {
      id: def.key,
      text: `${def.label}: ${optionLabel(def.options, currentOf(def, values))}`,
      remove: () => onChange({ [def.key]: def.defaultValue ?? "" }),
    };
  });

  const hasPanel = filters.length > 0;

  return (
    <div className="adm-filters">
      {segment ? <AdminSegmentedControl {...segment} /> : null}

      {search || hasPanel || trailing || (onClear && activeDefs.length > 0) ? (
        <div className="adm-filters-row">
          {search}
          {hasPanel ? (
            <button
              type="button"
              className="adm-filters-toggle"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((v) => !v)}
            >
              <I n="funnel" cls="sm" />
              Filtros
              {activeDefs.length > 0 ? <em>{activeDefs.length}</em> : null}
            </button>
          ) : null}
          {hasPanel ? (
            <div className="adm-filters-panel" id={panelId} data-open={open ? "true" : undefined}>
              {selects.map((def) =>
                def.kind === "select" ? (
                  <SelectFilter key={def.key} def={def} value={currentOf(def, values)} onChange={(v) => onChange({ [def.key]: v })} />
                ) : (
                  <DateRangeFilter
                    key={`${def.fromKey}/${def.toKey}`}
                    def={def}
                    from={values[def.fromKey] ?? ""}
                    to={values[def.toKey] ?? ""}
                    onChange={onChange}
                  />
                ),
              )}
              {pills.map((def) => (
                <PillsFilter key={def.key} def={def} value={currentOf(def, values)} onChange={(v) => onChange({ [def.key]: v })} />
              ))}
            </div>
          ) : null}
          {trailing || (onClear && activeDefs.length > 0) ? (
            <div className="adm-filters-trail">
              {onClear && activeDefs.length > 0 ? (
                <button type="button" className="adm-textbtn" onClick={onClear}>
                  Limpar filtros
                </button>
              ) : null}
              {trailing}
            </div>
          ) : null}
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="adm-chips" role="group" aria-label="Filtros ativos">
          {chips.map((chip) => (
            <button key={chip.id} type="button" className="adm-chip" aria-label={`Remover filtro ${chip.text}`} onClick={chip.remove}>
              {chip.text}
              <I n="x" cls="sm" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

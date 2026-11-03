import { cloneElement, Fragment, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";
import { useSlidingIndicator } from "@/hooks/admin/use-sliding-indicator";
import { formatCivilDate, formatInt } from "@/lib/admin/format";

import { AdminSearchInput } from "./admin-search-input";

import "@/styles/admin-platform.css";
import "@/styles/admin-kit-ext.css";

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
  /** Fica na linha da barra, sempre visível (e não dentro do painel "Filtros"). Conta e vira chip como os demais. */
  inline?: boolean;
}

/** Poucas opções de escolha única, todas visíveis (o `PillGroup` do filtro de criadores). */
export interface AdminPillsFilter {
  kind: "pills";
  key: string;
  label: string;
  options: readonly AdminFilterOption[];
  defaultValue?: string;
  /** Fica na linha da barra, sempre visível (e não dentro do painel "Filtros"). */
  inline?: boolean;
}

/** Intervalo de datas civis (`YYYY-MM-DD`, o formato do contrato): dois campos de data. */
export interface AdminDateRangeFilter {
  kind: "date-range";
  label: string;
  fromKey: string;
  toKey: string;
  /** Fica na linha da barra, sempre visível (e não dentro do painel "Filtros"). */
  inline?: boolean;
}

/** O que `AdminCustomFilter.render` recebe. */
export interface AdminCustomFilterContext {
  id: string;
  label: string;
  /** `summary` não é `null`: o filtro está valendo. */
  active: boolean;
  /** Está sendo desenhado na linha da barra (e não no painel "Filtros"). */
  inline: boolean;
}

/**
 * Filtro com controle próprio (seletor de workspace, de autor, de período…). A barra não sabe de onde vem o
 * estado: `summary` diz se está valendo e o que mostrar no chip, `onClear` desfaz. Assim ele conta em
 * "Filtros (n)", vira chip removível e é desfeito por "Limpar filtros" como qualquer outro.
 */
export interface AdminCustomFilter {
  kind: "custom";
  /** Identifica o filtro (chave React e do chip). */
  id: string;
  /** Nome do filtro: vai para `render` (rótulo do controle) e para o aviso de "Remover filtro …" se o chip não tiver outro. */
  label: string;
  render: (ctx: AdminCustomFilterContext) => ReactNode;
  /** O texto do chip ("Workspace: Acme"); `null` = inativo (não conta, não vira chip). Inclua o nome do filtro no texto. */
  summary: string | null;
  /** Desfaz só este filtro. Chamado pelo × do chip e, com o filtro ativo, por "Limpar filtros" (depois do `onClear` da barra). */
  onClear: () => void;
  /** Fica na linha da barra, sempre visível (para o seletor de workspace/período não ficar escondido em "Filtros"). */
  inline?: boolean;
}

/**
 * Liga/desliga ("Excluídos", "Só com pendência"): um botão `adm-pill` com `aria-pressed`. Conta em "Filtros (n)",
 * vira chip e é desfeito por "Limpar filtros" como os demais. A barra não guarda o estado: `active` vem da tela.
 */
export interface AdminToggleFilter {
  kind: "toggle";
  /** Identifica o filtro (chave React e do chip). */
  id: string;
  /** Texto do botão e, sem `summary`, do chip. */
  label: string;
  active: boolean;
  /** Clique no botão. Também desfaz o filtro (no chip e em "Limpar filtros") quando não há `onClear`. */
  onToggle: () => void;
  /** Texto do chip quando ativo (padrão: `label`). */
  summary?: string;
  /**
   * Desfaz o filtro de forma idempotente (chip e "Limpar filtros"). Opcional: sem ele a barra chama `onToggle`
   * (só com o filtro ativo). Passe `onClear` se o `onClear` da barra também zera este estado, para não virar duas vezes.
   */
  onClear?: () => void;
  /** Fica na linha da barra, sempre visível (e não dentro do painel "Filtros"). */
  inline?: boolean;
}

export type AdminFilterDef = AdminSelectFilter | AdminPillsFilter | AdminDateRangeFilter | AdminCustomFilter | AdminToggleFilter;

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
  /**
   * Estado da lista como controle segmentado (Todos / Ativos / Suspensos…). Sem `segmentDefault` não vira chip
   * nem conta como filtro.
   */
  segment?: AdminSegmentedControlProps;
  /**
   * Valor do segmento que significa "sem filtro" (`''`, `'all'`…). Com ele, o segmento fora do padrão conta como
   * filtro ativo: entra em "Filtros (n)", vira chip ("<ariaLabel>: <opção>") e "Limpar filtros" o devolve ao padrão.
   * Sem ele o segmento segue como antes (nunca conta).
   */
  segmentDefault?: string;
  /** Campo de busca (`AdminSearchInput`). */
  search?: ReactNode;
  /**
   * Nome acessível da busca ("Buscar workspaces"): quem usa o campo precisa saber o que ele busca. Num
   * `AdminSearchInput` vira o `aria-label` do campo; em outro elemento, ele é embrulhado num `role="search"` com este nome.
   * Informe sempre que houver `search`.
   */
  searchLabel?: string;
  filters?: readonly AdminFilterDef[];
  /** Valores atuais, por chave (`useAdminListQueryState().filters`). Opcional: barra só com segmento, toggles ou `trailing` (padrão `{}`). */
  values?: Readonly<Record<string, string>>;
  /** Recebe só o que mudou (`{ activity: 'never' }`); o intervalo de datas manda as duas chaves. Opcional (padrão: não faz nada). */
  onChange?: (patch: Record<string, string>) => void;
  /** Aparece como "Limpar filtros" enquanto houver filtro ativo. */
  onClear?: () => void;
  /** Fim da barra, depois de "Limpar filtros" (botão de atualizar, exportar…). */
  trailing?: ReactNode;
}

/** Valor de um filtro de escolha única; chave ausente de `values` é o valor padrão do filtro. */
function currentOf(def: AdminSelectFilter | AdminPillsFilter, values: Readonly<Record<string, string>>): string {
  return values[def.key] ?? def.defaultValue ?? "";
}

const NO_VALUES: Readonly<Record<string, string>> = {};
const NOOP = () => {};

function isFilterActive(def: AdminFilterDef, values: Readonly<Record<string, string>>): boolean {
  if (def.kind === "custom") return def.summary !== null;
  if (def.kind === "toggle") return def.active;
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

/** Dá o nome acessível à busca: no `AdminSearchInput` é o `label` dele; em qualquer outro elemento, um `role="search"` em volta. */
function labelledSearch(search: ReactNode, label: string | undefined): ReactNode {
  if (!search || !label || !isValidElement(search)) return search;
  if (search.type === AdminSearchInput) return cloneElement(search as ReactElement<{ label?: string }>, { label });
  return (
    <div className="adm-filters-search" role="search" aria-label={label}>
      {search}
    </div>
  );
}

/** Controles que aceitam foco, na ordem em que a barra os desenha: para onde o foco vai quando o que o tinha some. */
const FOCUS_FALLBACK = ".adm-search input, .adm-filters-toggle, .adm-filters-row select, .adm-filters-row .adm-pill, .adm-filters-row button";

/**
 * Barra de filtros das listas do Admin: segmentado de estado, busca, seletores, pílulas, intervalo de datas,
 * liga/desliga (`kind: 'toggle'`), filtros próprios (`kind: 'custom'`), "Limpar filtros" e os chips dos filtros
 * ativos (cada chip desfaz o seu). `values`/`onChange` são opcionais: uma barra só com segmento, toggles e/ou
 * `trailing` não precisa deles. Com `segmentDefault` o segmento fora do padrão conta como filtro.
 *
 * Declarativa: os mesmos `filters` desenham os controles e os chips, então nunca divergem. Não guarda
 * estado de filtro: `values`/`onChange` são o da URL (`useAdminListQueryState`). Filtro com `inline: true`
 * fica sempre na linha da barra; os demais ficam no painel que, no celular, o botão "Filtros" abre.
 *
 * Teclado: chip e "Limpar filtros" somem ao serem usados; o foco vai para o chip vizinho (ou, não havendo,
 * para o primeiro controle da barra) em vez de cair no `body`.
 */
export function AdminFilterBar({
  segment,
  segmentDefault,
  search,
  searchLabel,
  filters = [],
  values = NO_VALUES,
  onChange = NOOP,
  onClear,
  trailing,
}: AdminFilterBarProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  /** Pedido de foco: índice do chip removido (`null` = "Limpar filtros", vai para o primeiro controle). Vale só se o foco se perdeu. */
  const refocus = useRef<{ chipIndex: number | null } | null>(null);

  const inlineDefs = filters.filter((f) => f.inline);
  const panelDefs = filters.filter((f) => !f.inline);
  // No painel: seletores, datas e filtros próprios na ordem em que vieram, depois as pílulas.
  const panelOrdered = [...panelDefs.filter((f) => f.kind !== "pills"), ...panelDefs.filter((f) => f.kind === "pills")];
  const activeDefs = filters.filter((f) => isFilterActive(f, values));
  const activeCustom = activeDefs.filter((f): f is AdminCustomFilter => f.kind === "custom");
  const activeToggles = activeDefs.filter((f): f is AdminToggleFilter => f.kind === "toggle");
  const segmentActive = !!segment && segmentDefault !== undefined && segment.value !== segmentDefault;
  const resetSegment = () => {
    if (segment && segmentDefault !== undefined) segment.onChange(segmentDefault);
  };
  const activeCount = activeDefs.length + (segmentActive ? 1 : 0);

  const defChips: Chip[] = activeDefs.map((def) => {
    if (def.kind === "custom") {
      return { id: `custom:${def.id}`, text: def.summary ?? def.label, remove: def.onClear };
    }
    if (def.kind === "toggle") {
      return { id: `toggle:${def.id}`, text: def.summary ?? def.label, remove: def.onClear ?? def.onToggle };
    }
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
  const chips: Chip[] = segmentActive
    ? [{ id: "segment", text: `${segment.ariaLabel}: ${optionLabel(segment.options, segment.value)}`, remove: resetSegment }, ...defChips]
    : defChips;

  const chipIds = chips.map((c) => c.id).join("|");
  useEffect(() => {
    const request = refocus.current;
    refocus.current = null;
    const root = rootRef.current;
    if (!request || !root) return;
    // O foco só é devolvido se se perdeu (o botão que o tinha saiu da tela); se a pessoa já foi para outro lugar, fica onde está.
    const lost = !document.activeElement || document.activeElement === document.body;
    if (!lost) return;
    if (request.chipIndex !== null) {
      const buttons = root.querySelectorAll<HTMLButtonElement>(".adm-chips .adm-chip");
      const next = buttons[Math.min(request.chipIndex, buttons.length - 1)];
      if (next) {
        next.focus();
        return;
      }
    }
    for (const candidate of root.querySelectorAll<HTMLElement>(FOCUS_FALLBACK)) {
      candidate.focus();
      if (document.activeElement === candidate) return;
    }
  }, [chipIds]);

  const renderDef = (def: AdminFilterDef, inline: boolean): ReactNode => {
    if (def.kind === "select") {
      return <SelectFilter key={def.key} def={def} value={currentOf(def, values)} onChange={(v) => onChange({ [def.key]: v })} />;
    }
    if (def.kind === "pills") {
      return <PillsFilter key={def.key} def={def} value={currentOf(def, values)} onChange={(v) => onChange({ [def.key]: v })} />;
    }
    if (def.kind === "date-range") {
      return (
        <DateRangeFilter
          key={`${def.fromKey}/${def.toKey}`}
          def={def}
          from={values[def.fromKey] ?? ""}
          to={values[def.toKey] ?? ""}
          onChange={onChange}
        />
      );
    }
    if (def.kind === "toggle") {
      return (
        <button
          key={`toggle:${def.id}`}
          type="button"
          className="adm-pill"
          data-toggle="true"
          aria-pressed={def.active}
          onClick={def.onToggle}
        >
          {def.label}
        </button>
      );
    }
    return <Fragment key={`custom:${def.id}`}>{def.render({ id: def.id, label: def.label, active: def.summary !== null, inline })}</Fragment>;
  };

  const hasPanel = panelDefs.length > 0;
  const hasInline = inlineDefs.length > 0;
  const canClear = activeCount > 0 && (!!onClear || activeCustom.length > 0 || activeToggles.length > 0 || segmentActive);

  const clearAll = () => {
    refocus.current = { chipIndex: null };
    onClear?.();
    // Os filtros próprios, os toggles e o segmento guardam o estado fora de `values`: o `onClear` da barra não os alcança.
    for (const def of activeCustom) def.onClear();
    for (const def of activeToggles) (def.onClear ?? def.onToggle)();
    if (segmentActive) resetSegment();
  };

  return (
    <div className="adm-filters" ref={rootRef}>
      {segment ? <AdminSegmentedControl {...segment} /> : null}

      {search || hasInline || hasPanel || trailing || canClear ? (
        <div className="adm-filters-row">
          {labelledSearch(search, searchLabel)}
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
              {activeCount > 0 ? <em>{activeCount}</em> : null}
            </button>
          ) : null}
          {/* depois do botão "Filtros" (escondido no desktop): no celular a linha própria dos inline vem abaixo dele, e a ordem de Tab acompanha a visual */}
          {hasInline ? <div className="adm-filters-inline">{inlineDefs.map((def) => renderDef(def, true))}</div> : null}
          {hasPanel ? (
            <div className="adm-filters-panel" id={panelId} data-open={open ? "true" : undefined}>
              {panelOrdered.map((def) => renderDef(def, false))}
            </div>
          ) : null}
          {trailing || canClear ? (
            <div className="adm-filters-trail">
              {canClear ? (
                <button type="button" className="adm-textbtn" onClick={clearAll}>
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
          {chips.map((chip, index) => (
            <button
              key={chip.id}
              type="button"
              className="adm-chip"
              aria-label={`Remover filtro ${chip.text}`}
              onClick={() => {
                refocus.current = { chipIndex: index };
                chip.remove();
              }}
            >
              {chip.text}
              <I n="x" cls="sm" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

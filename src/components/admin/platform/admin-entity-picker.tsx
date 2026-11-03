import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { I } from "@/components/prototype/ui";
import { useDebounce } from "@/hooks/use-debounce";
import { formatInt } from "@/lib/admin/format";

import { AdminEmptyState } from "./admin-empty-state";
import { AdminErrorState } from "./admin-error-state";
import { AdminSkeleton } from "./admin-skeleton";

import "@/styles/admin-platform.css";
import "@/styles/admin-kit-entity-picker.css";

/** O que o `search` injetado devolve: o mesmo formato de uma consulta (`useQuery`), sem acoplar a nenhuma API. */
export interface AdminEntityPickerSearchResult<T> {
  /** Resultados da busca atual. `undefined` enquanto a primeira resposta não chegou. */
  data: readonly T[] | undefined;
  /** Primeira carga (sem dado nenhum ainda): o popover mostra o esqueleto. */
  isLoading: boolean;
  isError: boolean;
  /** Tentar de novo: com ele, o erro ganha o botão "Tentar de novo". */
  retry?: () => void;
  /** Uma busca nova em andamento (o dado antigo continua na lista, esmaecido). */
  isFetching?: boolean;
  /** Total no servidor, quando maior que `data.length`: aparece "Mostrando N de M". */
  total?: number;
  /** Erro da consulta (qualquer coisa; o texto sai de `describeAdminError`). */
  error?: unknown;
  /** Texto de erro já pronto (sobrescreve o derivado de `error`). */
  errorMessage?: string;
}

/**
 * Um hook-like injetado por quem usa: recebe o texto já aparado e já "assentado" (depois do atraso de digitação)
 * e devolve a consulta. Roda dentro do popover, que só existe aberto: a consulta não dispara com o seletor
 * fechado. Chame hooks nele à vontade (`useAdminList`, `useQuery`…), mas sempre a mesma função.
 */
export type AdminEntityPickerSearch<T> = (query: string) => AdminEntityPickerSearchResult<T>;

export interface AdminEntityPickerOptionState {
  selected: boolean;
  active: boolean;
}

export interface AdminEntityPickerProps<T> {
  /** Nome do campo: aparece na pílula ("Workspace: Todos") e dá nome ao popover, à busca e à lista. */
  label: string;
  /** Texto da caixa de busca dentro do popover (padrão "Buscar"). */
  placeholder?: string;
  /** O que a pílula diz quando nada está escolhido, e o rótulo da opção que limpa (padrão "Todos"). */
  allLabel?: string;
  /** A entidade escolhida, ou `null`. Controlado: o estado fica com quem usa (a URL, nas telas). */
  value: T | null;
  onChange: (value: T | null) => void;
  search: AdminEntityPickerSearch<T>;
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  /**
   * Conteúdo de cada opção. Entra dentro de `.adm-ep-opt-text`: um `<b>` vira o título e um `<small>` a linha
   * de apoio (e-mail, status). O ✓ da opção escolhida e o destaque são do componente. Padrão: só `getLabel`.
   */
  renderOption?: (item: T, state: AdminEntityPickerOptionState) => ReactNode;
  /** Permite voltar a "Todos": opção "Todos" no topo da lista e, na variante `pill`, o × na pílula (padrão sim). */
  clearable?: boolean;
  /**
   * `pill` (padrão): pílula solta, com o × de limpar. `filterBar`: dentro do `AdminFilterBar` (filtro `custom`):
   * sem × (o chip do filtro e o "Limpar filtros" já limpam) e ocupa a linha inteira no painel do celular.
   */
  variant?: "pill" | "filterBar";
  disabled?: boolean;
  /** Espera depois da última tecla antes de buscar (padrão 300 ms, como os seletores que este substitui). */
  debounceMs?: number;
  /** Título do estado "sem resultado" (padrão "Nenhum resultado"). */
  emptyTitle?: string;
  /**
   * Quantas letras a busca precisa antes de mostrar resultados (padrão 0: sempre). Antes disso a lista diz "Digite
   * pelo menos N letras" em vez do vazio "Não há nada para escolher aqui". O `search` ainda é chamado (é um hook:
   * a regra de hooks não deixa pular a chamada) e recebe o texto curto; quem o implementa deve usar o mesmo mínimo
   * em `enabled` para não consultar a API à toa. O que ele devolver antes do mínimo é ignorado.
   */
  minChars?: number;
  /**
   * A escolha é obrigatória: sem a opção "Todos"/limpar e sem o × na pílula. Sem valor, a pílula mostra só o campo e
   * "Escolha…" (nunca o `allLabel`, que prometeria um "todos" que não existe). Padrão `false`.
   */
  required?: boolean;
  /** Só na variante `pill`: no celular a pílula ocupa a linha inteira (padrão `false`: segue o tamanho do conteúdo). */
  fullWidthOnMobile?: boolean;
}

/** Texto da pílula de um campo obrigatório ainda sem escolha. */
const REQUIRED_PLACEHOLDER = "Escolha…";

/** "Digite pelo menos 3 letras" / "Digite pelo menos 1 letra". */
export function adminEntityPickerMinCharsHint(minChars: number): string {
  return `Digite pelo menos ${minChars} ${minChars === 1 ? "letra" : "letras"}`;
}

/**
 * Texto do chip do filtro ativo ("Workspace: Café Serra Verde"), ou `null` sem escolha (sem chip). É o mesmo
 * texto que a pílula mostra, para o chip e o controle nunca divergirem.
 */
export function adminEntityPickerSummary<T>(label: string, value: T | null | undefined, getLabel: (item: T) => string): string | null {
  if (value === null || value === undefined) return null;
  return `${label}: ${getLabel(value)}`;
}

/* ───────────────────────── posição do popover ───────────────────────── */

const POP_GAP = 6;
const POP_MARGIN = 16;
const POP_MIN_WIDTH = 320;
const POP_MAX_WIDTH = 420;
/** Altura que o popover gosta de ter: com menos espaço embaixo (e mais em cima) ele abre para cima. */
const POP_PREFERRED_HEIGHT = 320;
const POP_MAX_HEIGHT = 440;
const POP_MIN_HEIGHT = 160;

export interface EntityPickerAnchorRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

export interface EntityPickerPosition {
  placement: "bottom" | "top";
  left: number;
  width: number;
  maxHeight: number;
  /** Só em `bottom`. */
  top?: number;
  /** Só em `top`: distância até a base da janela (o popover cresce para cima a partir da pílula). */
  bottom?: number;
}

/**
 * Coordenadas do popover (`position: fixed`) a partir da pílula e da janela: alinhado à esquerda da pílula e
 * mantido dentro da janela; abre embaixo e inverte para cima quando falta espaço embaixo e sobra em cima.
 * `maxHeight` é o espaço livre do lado escolhido: a lista rola por dentro em vez de o popover vazar.
 */
export function computeEntityPickerPosition(
  anchor: EntityPickerAnchorRect,
  viewport: { width: number; height: number },
): EntityPickerPosition {
  const width = Math.min(Math.max(anchor.width, POP_MIN_WIDTH), POP_MAX_WIDTH, Math.max(viewport.width - POP_MARGIN * 2, 0));
  const left = Math.min(Math.max(anchor.left, POP_MARGIN), Math.max(viewport.width - width - POP_MARGIN, POP_MARGIN));
  const below = viewport.height - anchor.bottom - POP_GAP - POP_MARGIN;
  const above = anchor.top - POP_GAP - POP_MARGIN;
  const flip = below < POP_PREFERRED_HEIGHT && above > below;
  const room = flip ? above : below;
  const maxHeight = Math.max(Math.min(room, POP_MAX_HEIGHT), POP_MIN_HEIGHT);
  return flip
    ? { placement: "top", left, width, maxHeight, bottom: viewport.height - anchor.top + POP_GAP }
    : { placement: "bottom", left, width, maxHeight, top: anchor.bottom + POP_GAP };
}

function measure(anchor: HTMLElement | null): EntityPickerPosition {
  const rect = anchor?.getBoundingClientRect();
  return computeEntityPickerPosition(
    { left: rect?.left ?? 0, top: rect?.top ?? 0, bottom: rect?.bottom ?? 0, width: rect?.width ?? 0 },
    { width: window.innerWidth, height: window.innerHeight },
  );
}

function samePosition(a: EntityPickerPosition, b: EntityPickerPosition): boolean {
  return (
    a.placement === b.placement &&
    a.left === b.left &&
    a.width === b.width &&
    a.maxHeight === b.maxHeight &&
    a.top === b.top &&
    a.bottom === b.bottom
  );
}

/* ───────────────────────── componente ───────────────────────── */

/**
 * Seletor de uma entidade (workspace, autor, conta…) em pílula: "Workspace: Todos". Clicar abre um popover com
 * busca e lista; a busca é injetada (`search`), então o componente não conhece nenhuma API.
 *
 * Acessibilidade (combobox WAI-ARIA com lista, dentro do popover): a caixa de busca é `role="combobox"` com
 * `aria-expanded`, `aria-controls` e `aria-activedescendant` (o foco fica na caixa; a lista é `listbox` de
 * `option`). Teclado: ↓ ↑ andam pela lista, Home/End vão ao primeiro/último (com a caixa vazia ou com Ctrl/⌘:
 * com texto digitado movem o cursor), Enter escolhe, Esc fecha, Tab fecha. Ao fechar, o foco volta à pílula.
 * Na pílula, ↓ e ↑ também abrem.
 *
 * O popover é `position: fixed` num portal: não é cortado por cartão, tabela nem painel de filtros, e abre
 * para cima quando falta espaço embaixo. Estados dentro dele: carregando (esqueleto), vazio, erro com
 * "Tentar de novo" (Tab chega ao botão) e "Mostrando N de M".
 */
export function AdminEntityPicker<T>({
  label,
  placeholder = "Buscar",
  allLabel = "Todos",
  value,
  onChange,
  search,
  getKey,
  getLabel,
  renderOption,
  clearable = true,
  variant = "pill",
  disabled = false,
  debounceMs = 300,
  emptyTitle = "Nenhum resultado",
  minChars = 0,
  required = false,
  fullWidthOnMobile = false,
}: AdminEntityPickerProps<T>) {
  const popId = `${useId()}-pop`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Estado da lista na hora do clique (antes de o foco sair): no Safari o botão não recebe foco no clique, a lista
  // fecha pelo blur e o `click` que vem depois a reabriria.
  const openAtPress = useRef<boolean | null>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const hasValue = value !== null && value !== undefined;
  const canClear = clearable && !required;
  const valueText = hasValue ? getLabel(value) : required ? REQUIRED_PLACEHOLDER : allLabel;
  const showClear = canClear && hasValue && variant === "pill" && !disabled;

  const select = (next: T | null) => {
    onChange(next);
    close(true);
  };

  return (
    <div className="adm-ep" data-variant={variant} data-active={hasValue ? "true" : undefined} data-disabled={disabled ? "true" : undefined}
      data-required={required ? "true" : undefined}
      data-full-mobile={fullWidthOnMobile && variant === "pill" ? "true" : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        className="adm-ep-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        disabled={disabled}
        onMouseDown={() => {
          openAtPress.current = open;
        }}
        onClick={() => {
          const wasOpen = openAtPress.current ?? open;
          openAtPress.current = null;
          if (wasOpen) close(false);
          else setOpen(true);
        }}
        onKeyDown={(event) => {
          // O estado do último clique de mouse não vale para o teclado (um clique arrastado para fora não dispara
          // `click` e deixaria o valor velho: o Enter seguinte fecharia em vez de abrir).
          openAtPress.current = null;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="adm-ep-k">{label}:</span>
        <span className="adm-ep-v" data-placeholder={required && !hasValue ? "true" : undefined}>
          {valueText}
        </span>
        <I n="chev" cls="sm" />
      </button>
      {showClear ? (
        <button
          type="button"
          className="adm-ep-clear"
          aria-label={`Limpar ${label.toLowerCase()}`}
          onClick={() => {
            onChange(null);
            // O × some junto com a escolha: o foco vai para a pílula em vez de se perder.
            triggerRef.current?.focus();
          }}
        >
          <I n="x" cls="sm" />
        </button>
      ) : null}

      {open
        ? createPortal(
            <div className="pv" data-adm-layer="">
              <EntityPickerPopover
                id={popId}
                anchorRef={triggerRef}
                label={label}
                placeholder={placeholder}
                allLabel={allLabel}
                value={hasValue ? value : null}
                search={search}
                getKey={getKey}
                getLabel={getLabel}
                renderOption={renderOption}
                clearable={canClear}
                debounceMs={debounceMs}
                emptyTitle={emptyTitle}
                minChars={Math.max(0, Math.floor(minChars) || 0)}
                onSelect={select}
                onClose={close}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/* ───────────────────────── popover ───────────────────────── */

type Row<T> = { kind: "all" } | { kind: "item"; item: T };

interface PopoverProps<T> {
  id: string;
  anchorRef: { current: HTMLElement | null };
  label: string;
  placeholder: string;
  allLabel: string;
  value: T | null;
  search: AdminEntityPickerSearch<T>;
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  renderOption?: (item: T, state: AdminEntityPickerOptionState) => ReactNode;
  clearable: boolean;
  debounceMs: number;
  emptyTitle: string;
  minChars: number;
  onSelect: (value: T | null) => void;
  onClose: (restoreFocus: boolean) => void;
}

/** O popover só existe aberto: o estado da busca (texto, destaque) reinicia a cada abertura. */
function EntityPickerPopover<T>({
  id,
  anchorRef,
  label,
  placeholder,
  allLabel,
  value,
  search,
  getKey,
  getLabel,
  renderOption,
  clearable,
  debounceMs,
  emptyTitle,
  minChars,
  onSelect,
  onClose,
}: PopoverProps<T>) {
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `${id}-input`;
  const listboxId = `${id}-listbox`;
  const hintId = `${id}-hint`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const lowerLabel = label.toLowerCase();

  const [query, setQuery] = useState("");
  // `null`: o destaque segue o padrão (a opção escolhida, ou a primeira ao buscar); número: a pessoa navegou.
  const [highlight, setHighlight] = useState<number | null>(null);
  const [position, setPosition] = useState<EntityPickerPosition>(() => measure(anchorRef.current));

  const term = useDebounce(query, debounceMs).trim();
  const settling = query.trim() !== term;
  const result = search(term);
  // Antes do mínimo de letras o que a busca devolver não vale: a lista fica vazia e a dica toma o lugar do "vazio".
  // `hinting`: o que a pessoa vê digitado já é curto; `termShort`: o texto já assentado ainda é curto (a digitação
  // passou do mínimo, mas a busca com o texto novo ainda não começou).
  const hinting = minChars > 0 && query.trim().length < minChars;
  const termShort = minChars > 0 && term.length < minChars;
  const gated = hinting || termShort;
  const items = gated ? [] : (result.data ?? []);

  // Busca nova, destaque novo.
  useEffect(() => {
    setHighlight(null);
  }, [term]);

  // Foco na busca ao abrir.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Segue a pílula quando a janela muda de tamanho ou algo em volta rola (rolar a própria lista não conta).
  useLayoutEffect(() => {
    const update = (event?: Event) => {
      if (event?.target instanceof Node && popRef.current?.contains(event.target)) return;
      const next = measure(anchorRef.current);
      setPosition((current) => (samePosition(current, next) ? current : next));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef]);

  // "Todos" no topo enquanto não há texto na busca: é a saída da escolha para quem está no teclado.
  const showAll = clearable && query.trim() === "";
  const rows: Row<T>[] = [...(showAll ? [{ kind: "all" } as const] : []), ...items.map((item) => ({ kind: "item", item }) as const)];
  const selectedIndex = rows.findIndex((row) => (row.kind === "all" ? value === null : value !== null && getKey(row.item) === getKey(value)));
  const defaultIndex = query.trim() === "" ? Math.max(selectedIndex, 0) : 0;
  const active = rows.length === 0 ? -1 : Math.min(highlight ?? defaultIndex, rows.length - 1);

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
    // `optionId` é derivado de `id`: o índice ativo é o que muda.
  }, [active, id]);

  const choose = (row: Row<T> | undefined) => {
    if (!row) return;
    onSelect(row.kind === "all" ? null : row.item);
  };

  const move = (to: number) => {
    if (rows.length === 0) return;
    setHighlight(Math.min(Math.max(to, 0), rows.length - 1));
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(active < 0 ? 0 : active + 1 >= rows.length ? 0 : active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(active <= 0 ? rows.length - 1 : active - 1);
    } else if (event.key === "Home" || event.key === "End") {
      // Com texto na caixa, Home/End são do cursor; vazia (ou com Ctrl/⌘) levam ao começo/fim da lista.
      if (query !== "" && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      move(event.key === "Home" ? 0 : rows.length - 1);
    } else if (event.key === "Enter") {
      // Enter nunca envia o formulário em volta.
      event.preventDefault();
      // Composição de IME: o Enter confirma o texto, não escolhe.
      if (event.nativeEvent.isComposing) return;
      // Com a lista ainda de uma busca anterior (digitou e apertou Enter antes do atraso, ou a consulta nova está em
      // andamento), a opção destacada não é a que a pessoa vê para o texto digitado: escolher seria pegar a errada.
      if (settling || result.isFetching) return;
      choose(rows[active]);
    }
  };

  const onPopKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (event.nativeEvent.isComposing) return;
      // Fecha só o popover: um diálogo em volta não deve fechar junto.
      event.preventDefault();
      event.stopPropagation();
      onClose(true);
    } else if (event.key === "Tab") {
      // Tab fecha e devolve o foco à pílula (o navegador segue dali). Única exceção: com o botão "Tentar de
      // novo" na tela, Tab da busca chega a ele e Shift+Tab dele volta à busca.
      const tabbables = popRef.current?.querySelectorAll<HTMLElement>("input, button:not(:disabled)") ?? [];
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      const between = tabbables.length > 1 && ((event.target === first && !event.shiftKey) || (event.target === last && event.shiftKey));
      if (!between) onClose(true);
    }
  };

  const onPopBlur = (event: FocusEvent<HTMLDivElement>) => {
    // O foco saiu do popover (para a pílula, que cuida de si, ou para fora): fecha sem tomar o foco de volta.
    const next = event.relatedTarget;
    if (next instanceof Node && (event.currentTarget.contains(next) || anchorRef.current?.contains(next))) return;
    onClose(false);
  };

  const loading = !gated && result.isLoading && !result.data;
  const busy = !loading && ((!gated && !!result.isFetching) || (settling && !hinting));
  const failed = !gated && result.isError && items.length === 0;
  const empty = !gated && !loading && !failed && items.length === 0;
  const total = result.total ?? items.length;

  // Anúncio para leitor de tela: uma frase por vez. Vazio e erro têm o próprio `role` e dispensam esta.
  let live = "";
  if (hinting) live = adminEntityPickerMinCharsHint(minChars);
  else if (loading) live = "Carregando…";
  else if (busy) live = "Buscando…";
  else if (items.length > 0) live = items.length === 1 ? "1 resultado" : `${formatInt(items.length)} resultados`;

  const style: CSSProperties = {
    left: position.left,
    width: position.width,
    maxHeight: position.maxHeight,
    ...(position.placement === "top" ? { bottom: position.bottom } : { top: position.top }),
  };

  return (
    <div
      ref={popRef}
      id={id}
      className="adm-ep-pop"
      role="dialog"
      aria-label={`Escolher ${lowerLabel}`}
      data-placement={position.placement}
      style={style}
      onKeyDown={onPopKeyDown}
      onBlur={onPopBlur}
      // `mousedown` com preventDefault: clicar na lista não tira o foco da busca (o blur fecharia antes do clique).
      // A própria caixa fica de fora, para o clique posicionar o cursor.
      onMouseDown={(event) => {
        if (event.target !== inputRef.current) event.preventDefault();
      }}
    >
      <div className="adm-ep-find">
        <I n="search" cls="sm" />
        <label htmlFor={inputId} className="adm-sr">
          Buscar {lowerLabel}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          aria-describedby={hinting ? hintId : undefined}
          aria-busy={busy ? true : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
        />
      </div>

      <ul id={listboxId} role="listbox" aria-label={label} className="adm-ep-list" aria-busy={busy ? true : undefined} hidden={rows.length === 0}>
        {rows.map((row, index) => {
          const isAll = row.kind === "all";
          const selected = index === selectedIndex;
          const isActive = index === active;
          return (
            <li
              key={isAll ? "__all__" : String(getKey(row.item))}
              id={optionId(index)}
              role="option"
              aria-selected={selected}
              className="adm-ep-opt"
              data-all={isAll ? "true" : undefined}
              data-active={isActive ? "true" : undefined}
              onMouseMove={() => {
                if (!isActive) setHighlight(index);
              }}
              onClick={() => choose(row)}
            >
              <span className="adm-ep-opt-text">
                {isAll ? (
                  <b>{allLabel}</b>
                ) : renderOption ? (
                  renderOption(row.item, { selected, active: isActive })
                ) : (
                  <b>{getLabel(row.item)}</b>
                )}
              </span>
              {selected ? <I n="check" cls="sm" /> : null}
            </li>
          );
        })}
      </ul>

      {hinting ? (
        <p className="adm-ep-hint" id={hintId}>
          {adminEntityPickerMinCharsHint(minChars)}
        </p>
      ) : null}

      {loading ? (
        <div className="adm-ep-loading" aria-hidden="true">
          <AdminSkeleton height={14} width="70%" />
          <AdminSkeleton height={14} width="55%" />
          <AdminSkeleton height={14} width="64%" />
        </div>
      ) : null}

      {failed ? (
        <AdminErrorState
          compact
          error={result.error}
          message={result.errorMessage}
          onRetry={result.retry}
          retrying={result.isFetching}
        />
      ) : null}

      {empty ? (
        <AdminEmptyState
          compact
          title={emptyTitle}
          description={term ? `Nada encontrado para “${term}”. Tente outro termo.` : "Não há nada para escolher aqui."}
        />
      ) : null}

      {items.length > 0 && total > items.length ? (
        <p className="adm-ep-note">
          Mostrando {formatInt(items.length)} de {formatInt(total)}. Digite para refinar a busca.
        </p>
      ) : null}

      <p className="adm-sr" role="status">
        {live}
      </p>
    </div>
  );
}

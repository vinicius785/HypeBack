import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

import { I } from "@/components/prototype/ui";
import "@/styles/page-kit.css";

/**
 * Estrutura compartilhada das páginas (Criadores, Campanhas, Marcas, Elenco): cabeçalho, navegação secundária,
 * barra de ferramentas e chips de filtros. As páginas mudam o CONTEÚDO (quais filtros, quais ações), nunca a
 * estrutura: medidas, raios, espaçamentos e comportamento responsivo vêm todos de `page-kit.css`.
 *
 *   <PageContainer>
 *     <PageHeader title subtitle actions />
 *     <PageControls>               ← abas + barra + chips, com o espaçamento do kit
 *       <PageTabs ... />
 *       <PageToolbar>
 *         <SearchInput />  <FilterButton />  <SortControl />  <ViewSwitcher />
 *       </PageToolbar>
 *       <FilterChips ... />
 *     </PageControls>
 *     …conteúdo…
 *   </PageContainer>
 */

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`pgk${className ? ` ${className}` : ""}`}>{children}</div>;
}

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Ações principais da página: ficam à direita, alinhadas à base do título. */
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="pg-head">
      <div className="pg-ht">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="pg-act">{actions}</div> : null}
    </header>
  );
}

/** Abas, barra e chips da página: o espaço entre eles é sempre o mesmo. */
export function PageControls({ children }: { children: ReactNode }) {
  return <div className="pg-controls">{children}</div>;
}

export interface PageTabItem<T extends string = string> {
  id: T;
  label: string;
  /** Contagem ao lado do nome (some quando ausente). */
  count?: number | null;
}

interface PageTabsProps<T extends string> {
  items: readonly PageTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}

/** Navegação secundária (Explorar/Minhas listas, Todas/Ativas…, No elenco/Convites): a pílula branca com a aba ativa em preto. */
export function PageTabs<T extends string>({ items, value, onChange, ariaLabel }: PageTabsProps<T>) {
  return (
    <div className="pg-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} className={on ? "on" : ""} onClick={() => onChange(t.id)}>
            {t.label}
            {t.count != null ? <em>{t.count}</em> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Pesquisa, filtros, ordenação e visualização na mesma linha. A pesquisa fica com o espaço que sobra; o resto ocupa só o necessário. */
export function PageToolbar({ children }: { children: ReactNode }) {
  return <div className="pg-bar">{children}</div>;
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Nome para leitor de tela (o campo não tem rótulo visível). */
  label: string;
}

export function SearchInput({ value, onChange, placeholder, label }: SearchInputProps) {
  return (
    <label className="pg-search">
      <I n="search" cls="sm" />
      <input type="search" aria-label={label} placeholder={placeholder} value={value} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
      {value ? (
        <button type="button" className="pg-clear" aria-label="Limpar busca" onClick={() => onChange("")}>
          <I n="x" cls="sm" />
        </button>
      ) : null}
    </label>
  );
}

interface FilterButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon?: string;
  /** Quantos filtros estão aplicados (vira o selo roxo). */
  count?: number;
  /** Estado ligado (filtro liga/desliga ou painel com filtros). */
  active?: boolean;
  children: ReactNode;
}

export function FilterButton({ icon = "funnel", count = 0, active = false, children, className = "", ...rest }: FilterButtonProps) {
  return (
    <button type="button" {...rest} className={`pg-btn${active || count > 0 ? " on" : ""}${className ? ` ${className}` : ""}`}>
      <I n={icon} cls="sm" />
      <span className="pg-btn-l">{children}</span>
      {count > 0 ? <em aria-label={`${count} ${count === 1 ? "filtro ativo" : "filtros ativos"}`}>{count}</em> : null}
    </button>
  );
}

/** Seleção por lista nativa, no mesmo tamanho dos demais controles (ex.: marca, rede social). */
export function SelectControl({ label, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="pg-select">
      <span className="sr-only">{label}</span>
      <select {...rest}>{children}</select>
    </label>
  );
}

function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

interface SortControlProps<T extends string> {
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
  heading?: string;
}

/** Ordenação: botão com a ordem atual e menu. Em telas estreitas só o ícone fica (o nome continua para leitor de tela). */
export function SortControl<T extends string>({ options, value, onChange, heading = "Ordenar por" }: SortControlProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const current = options.find(([v]) => v === value)?.[1] ?? "";
  return (
    <div className={`pg-menu${open ? " open" : ""}`} ref={ref}>
      <button type="button" className="pg-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Ordenar: ${current}`} title={`Ordenar: ${current}`} onClick={() => setOpen((v) => !v)}>
        <I n="sort" cls="sm" />
        <span className="pg-btn-l">{current}</span>
      </button>
      {open ? (
        <div className="pg-pop" role="menu">
          <small>{heading}</small>
          {options.map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="menuitemradio"
              aria-checked={v === value}
              className={v === value ? "on" : ""}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
            >
              {l}
              {v === value ? <I n="check" cls="sm" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface ViewOption<T extends string = string> {
  id: T;
  icon: string;
  label: string;
}

/** Alternância de visualização (cartões, lista, mapa): só ícones, com o nome em `aria-label` e `title`. */
export function ViewSwitcher<T extends string>({ options, value, onChange, ariaLabel = "Visualização" }: { options: readonly ViewOption<T>[]; value: T; onChange: (id: T) => void; ariaLabel?: string }) {
  return (
    <div className="pg-view" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? "on" : ""} aria-label={o.label} aria-pressed={value === o.id} title={o.label} onClick={() => onChange(o.id)}>
          <I n={o.icon} cls="sm" />
        </button>
      ))}
    </div>
  );
}

export interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
  /** Nome acessível do botão de remover (padrão: "Remover filtro: <rótulo>"). */
  removeLabel?: string;
}

/** Filtros aplicados, removíveis um a um, e "Limpar filtros". Não aparece sem chips. */
export function FilterChips({ chips, onClear, label = "Filtros aplicados" }: { chips: readonly FilterChip[]; onClear: () => void; label?: string }) {
  if (chips.length === 0) return null;
  return (
    <div className="pg-chips" role="list" aria-label={label}>
      <small aria-hidden="true">{label}:</small>
      {chips.map((c) => (
        <span key={c.id} className="pg-chip" role="listitem">
          {c.label}
          <button type="button" aria-label={c.removeLabel ?? `Remover filtro: ${c.label}`} onClick={c.onRemove}>
            <I n="x" cls="sm" />
          </button>
        </span>
      ))}
      <button type="button" className="pg-clearall" onClick={onClear}>
        Limpar filtros
      </button>
    </div>
  );
}

interface PageEmptyStateProps {
  /** Ícone discreto à esquerda (nome do ícone do protótipo). */
  icon: string;
  title: string;
  description?: ReactNode;
  /** Ação principal (botão preto) e secundária (botão cinza), à direita no desktop e em largura total no celular. */
  action?: ReactNode;
  secondary?: ReactNode;
  /** "alert" para erros (anunciado por leitor de tela). */
  role?: "alert" | "status";
  /** Conteúdo extra entre a descrição e as ações (ex.: o que o recurso oferece). */
  children?: ReactNode;
}

/**
 * Estado vazio, de erro ou de "nada encontrado" das páginas: uma faixa branca compacta logo abaixo do cabeçalho
 * (ícone, título, descrição e ação), em vez de um texto centralizado ocupando a tela. Mesma composição em todas as páginas.
 */
export function PageEmptyState({ icon, title, description, action, secondary, role, children }: PageEmptyStateProps) {
  return (
    <div className="pg-state" role={role}>
      <span className="pg-si" aria-hidden="true">
        <I n={icon} />
      </span>
      <div className="pg-sb">
        <b>{title}</b>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
      {action || secondary ? (
        <div className="pg-sa">
          {secondary}
          {action}
        </div>
      ) : null}
    </div>
  );
}

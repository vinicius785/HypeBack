import type { ReactNode } from "react";

import { I } from "@/components/prototype/ui";

/** Busca da coluna: o texto de dica diz o que se procura em cada aba; o "x" limpa sem tirar o foco do contexto. */
export function ListSearch({
  value,
  onChange,
  placeholder,
  label = "Buscar conversa",
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="mc-search">
      <I n="search" cls="sm" />
      <input
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {value && (
        <button type="button" aria-label="Apagar o texto da busca" onClick={() => onChange("")}>
          <I n="x" cls="sm" />
        </button>
      )}
    </label>
  );
}

export type ListFilter = "all" | "un";

/** Filtros secundários: Todas e Não lidas (com a contagem), mais uma ação da aba (ex.: "Nova conversa"). */
export function FilterRow({
  filter,
  onFilter,
  unread,
  children,
}: {
  filter: ListFilter;
  onFilter: (filter: ListFilter) => void;
  unread: number;
  children?: ReactNode;
}) {
  return (
    <div className="mc-filters">
      <button type="button" className={`mc-chip${filter === "all" ? " on" : ""}`} aria-pressed={filter === "all"} onClick={() => onFilter("all")}>
        Todas
      </button>
      <button type="button" className={`mc-chip${filter === "un" ? " on" : ""}`} aria-pressed={filter === "un"} onClick={() => onFilter("un")}>
        Não lidas
        {unread > 0 && <i aria-hidden="true">{unread}</i>}
      </button>
      {children}
    </div>
  );
}

/** Carregamento da lista: linhas-esqueleto no lugar do texto solto (o leitor de tela ouve a frase). */
export function ListSkeleton({ label, rows = 5 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div className="mc-sk" key={i} aria-hidden="true">
          <i />
          <div>
            <i />
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Estado vazio/erro com ícone, explicação e a próxima ação (botão), sempre dizendo o que fazer. */
export function StateBlock({
  icon,
  title,
  text,
  action,
  role,
  fill,
}: {
  icon: string;
  title: string;
  text?: string;
  action?: { label: string; onClick: () => void; icon?: string };
  role?: "alert" | "status";
  /** Ocupa a área toda (painel da conversa), em vez de só o espaço da lista. */
  fill?: boolean;
}) {
  return (
    <div className={`mc-state${fill ? " fill" : ""}`} role={role}>
      <span>
        <I n={icon} />
      </span>
      <b>{title}</b>
      {text && <small>{text}</small>}
      {action && (
        <button type="button" className="btn out" onClick={action.onClick}>
          {action.icon && <I n={action.icon} cls="sm" />}
          {action.label}
        </button>
      )}
    </div>
  );
}

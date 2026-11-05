import { useMemo, useState } from "react";

import { I } from "@/components/prototype/ui";
import type { Niche } from "@/shared/types";

import { filterNicheGroups, groupNiches } from "./niche-groups";

interface Props {
  niches: Niche[];
  /** Id do nicho escolhido ("" = nenhum). A regra do workspace é um nicho principal só. */
  value: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}

/**
 * Seleção do nicho principal: busca, categorias recolhidas (abre a que tem o nicho escolhido ou
 * as que combinam com a busca) e o nicho atual em destaque, com remoção.
 */
export function NichePicker({ niches, value, disabled, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const groups = useMemo(() => groupNiches(niches), [niches]);
  const shown = useMemo(() => filterNicheGroups(groups, query), [groups, query]);
  const selected = niches.find((n) => String(n.id) === value);
  const searching = query.trim().length > 0;

  const isOpen = (label: string, items: Niche[]) =>
    searching || open.has(label) || items.some((n) => String(n.id) === value);
  const toggle = (label: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  return (
    <div className="stg-np">
      <div className="stg-np-top">
        <label className="stg-np-q">
          <I n="search" cls="sm" />
          <input
            type="search"
            aria-label="Buscar nicho"
            placeholder="Buscar nicho"
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")}>
              <I n="x" cls="sm" />
            </button>
          )}
        </label>
        <span className="stg-np-n" aria-live="polite">
          {selected ? "1 selecionado" : "Nenhum selecionado"}
        </span>
      </div>

      {selected && (
        <div className="stg-np-sel">
          <span className="nch on">
            <I n="check" cls="sm" />
            {selected.name}
            {!disabled && (
              <button type="button" className="stg-np-rm" aria-label={`Remover nicho ${selected.name}`} onClick={() => onChange("")}>
                <I n="x" cls="sm" />
              </button>
            )}
          </span>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="stg-np-empty">Nenhum nicho encontrado para “{query}”.</p>
      ) : (
        <div className="stg-np-gs">
          {shown.map((g) => {
            const expanded = isOpen(g.label, g.items);
            const hasSel = g.items.some((n) => String(n.id) === value);
            return (
              <section key={g.label} className={`stg-np-g${expanded ? " open" : ""}`}>
                <button type="button" className="stg-np-gh" aria-expanded={expanded} onClick={() => toggle(g.label)}>
                  <b>{g.label}</b>
                  <span>
                    {hasSel && <em>1</em>}
                    {g.items.length}
                  </span>
                  <I n="chevdown" cls="sm" />
                </button>
                {expanded && (
                  <div className="nchips">
                    {g.items.map((n) => {
                      const id = String(n.id);
                      const on = value === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`nch ${on ? "on" : ""}`}
                          aria-pressed={on}
                          disabled={disabled}
                          onClick={() => onChange(on ? "" : id)}
                        >
                          {on && <I n="check" cls="sm" />}
                          {n.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { I } from "@/components/prototype/ui";
import type { Niche } from "@/shared/types";
import "@/styles/settings.css";

import { filterNicheGroups, groupNiches } from "./niche-groups";

interface Props {
  niches: Niche[];
  /** Id do nicho escolhido ("" = nenhum). A regra do workspace é um nicho principal só. */
  value: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}

/**
 * Seleção do nicho principal: um campo que abre uma lista agrupada por categoria, com busca. O nicho escolhido fica
 * no próprio campo (com "×" para limpar); nada de nuvem de botões na página.
 */
export function NichePicker({ niches, value, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const groups = useMemo(() => groupNiches(niches), [niches]);
  const shown = useMemo(() => filterNicheGroups(groups, query), [groups, query]);
  const selected = niches.find((n) => String(n.id) === value);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="st-np" ref={rootRef}>
      <button
        type="button"
        className={`st-in st-sel${open ? " open" : ""}`}
        aria-label="Nicho principal"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className={selected ? "" : "ph"}>{selected ? selected.name : "Escolha o nicho da marca"}</span>
        <I n="chevdown" cls="sm" />
      </button>
      {selected && !disabled ? (
        <button type="button" className="st-np-x" aria-label={`Remover nicho ${selected.name}`} onClick={() => onChange("")}>
          <I n="x" cls="sm" />
        </button>
      ) : null}

      {open ? (
        <div className="st-pop">
          <label className="st-pop-q">
            <I n="search" cls="sm" />
            <input ref={searchRef} type="search" aria-label="Buscar nicho" placeholder="Buscar nicho" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {shown.length === 0 ? (
            <p className="st-pop-empty">Nenhum nicho encontrado para “{query}”.</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Nichos">
              {shown.map((g) => (
                <li key={g.label} role="presentation">
                  <span className="st-pop-g">{g.label}</span>
                  <ul role="group" aria-label={g.label}>
                    {g.items.map((n) => {
                      const id = String(n.id);
                      const on = id === value;
                      return (
                        <li key={id} role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={on}
                            className={on ? "on" : ""}
                            onClick={() => {
                              onChange(on ? "" : id);
                              close();
                            }}
                          >
                            {n.name}
                            {on ? <I n="check" cls="sm" /> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

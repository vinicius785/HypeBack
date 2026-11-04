import { useEffect, useId, useState } from "react";

import { I } from "@/components/prototype/ui";
import { searchCities, type CityPlace } from "@/lib/city-search";

/** Campo de busca de cidade com sugestões; escolher uma devolve o ponto central e o raio sugerido. */
export function CityPicker({ onPick }: { onPick: (city: CityPlace) => void }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<CityPlace[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const listId = useId();

  useEffect(() => {
    const q = text.trim();
    if (q.length < 3) {
      setResults([]);
      setState("idle");
      return;
    }
    setState("loading");
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchCities(q, ctrl.signal)
        .then((r) => {
          setResults(r);
          setState(r.length === 0 ? "empty" : "idle");
        })
        .catch((e: unknown) => {
          if ((e as { name?: string })?.name === "AbortError") return;
          setResults([]);
          setState("error");
        });
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text]);

  return (
    <div className="cf-city">
      <label className="cf-ci">
        <I n="search" cls="sm" />
        <span className="sr-only">Buscar cidade</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buscar cidade (ex.: Ribeirão Preto)"
          autoComplete="off"
          aria-controls={listId}
        />
      </label>
      <ul id={listId} className="cf-cl" aria-label="Cidades encontradas">
        {results.map((c) => (
          <li key={c.label}>
            <button type="button" onClick={() => onPick(c)}>
              <I n="locate" cls="sm" />
              {c.label}
            </button>
          </li>
        ))}
      </ul>
      {state === "loading" ? <small role="status">Buscando…</small> : null}
      {state === "empty" ? <small role="status">Nenhuma cidade encontrada.</small> : null}
      {state === "error" ? (
        <small className="cf-err" role="alert">
          Não foi possível buscar cidades agora. Tente de novo.
        </small>
      ) : null}
    </div>
  );
}

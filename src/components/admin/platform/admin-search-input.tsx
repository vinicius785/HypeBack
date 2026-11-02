import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { I } from "@/components/prototype/ui";
import { useDebounce } from "@/hooks/use-debounce";
import { ADMIN_SEARCH_MAX_LENGTH } from "@/lib/admin/list-query";

import "@/styles/admin-platform.css";

interface AdminSearchInputProps {
  /** O texto que a lista está usando (o da URL). Mudou de fora (limpar filtros, voltar): o campo acompanha. */
  value: string;
  /** Chamado com o texto já aparado, quando a pessoa para de digitar, aperta Enter ou limpa. */
  onSearch: (value: string) => void;
  placeholder?: string;
  /** Nome para leitor de tela (o campo não tem rótulo visível). */
  label?: string;
  delayMs?: number;
  maxLength?: number;
}

/**
 * Campo de busca com atraso (`useDebounce`, 400 ms): digitar não dispara uma consulta por tecla.
 * Enter busca na hora; o × (e Escape) limpa e busca na hora.
 *
 * Quem emite e quem recebe não se atropelam: o texto que o próprio campo mandou buscar volta pela URL e é
 * ignorado; só uma mudança vinda de fora troca o que está digitado.
 */
export function AdminSearchInput({
  value,
  onSearch,
  placeholder = "Buscar",
  label = "Buscar",
  delayMs = 400,
  maxLength = ADMIN_SEARCH_MAX_LENGTH,
}: AdminSearchInputProps) {
  const [draft, setDraft] = useState(value);
  const emitted = useRef(value);
  const onSearchRef = useRef(onSearch);
  const debounced = useDebounce(draft, delayMs);

  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  const emit = useCallback((next: string) => {
    const text = next.trim();
    if (text === emitted.current) return;
    emitted.current = text;
    onSearchRef.current(text);
  }, []);

  // Mudança de fora: a tela manda no texto. O que o próprio campo emitiu (e voltou pela URL) é ignorado.
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setDraft(value);
  }, [value]);

  // Só busca quando o que está digitado já "assentou" (igual ao valor com atraso). Comparar com `draft` (e não
  // só reagir a `debounced`) cobre digitar de novo, dentro do atraso, o mesmo texto que estava antes de uma
  // limpeza vinda de fora: `debounced` nem muda nesse caso. Um `onSearch` novo não reenvia texto velho.
  useEffect(() => {
    if (debounced === draft) emit(draft);
  }, [debounced, draft, emit]);

  const clear = () => {
    setDraft("");
    emit("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      emit(draft);
    } else if (event.key === "Escape" && draft) {
      event.preventDefault();
      clear();
    }
  };

  return (
    <div className="adm-search" role="search">
      <I n="search" cls="sm" />
      <input
        type="search"
        value={draft}
        placeholder={placeholder}
        aria-label={label}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <button type="button" className="adm-search-clear" aria-label="Limpar busca" hidden={!draft} onClick={clear}>
        <I n="x" cls="sm" />
      </button>
    </div>
  );
}

import { useCallback, useLayoutEffect, useRef } from "react";

import { formatInt } from "@/lib/admin/format";

import "@/styles/admin-platform.css";
import "@/styles/admin-kit-load-more.css";

/** O que está sendo listado, para o texto do contador ("12 eventos carregados"). */
export interface AdminLoadMoreNoun {
  singular: string;
  plural: string;
  /** Concorda o "carregado/carregada" ("movimentações carregadas"). */
  feminine?: boolean;
}

interface AdminLoadMoreProps {
  /** Quantos itens já estão na tela. */
  loaded: number;
  /** Total no servidor, quando a API informa. Sem ele o contador mostra só "N carregados". */
  total?: number | null;
  /** Há mais uma página? Sem ela o botão some e o contador fecha com "fim da lista". */
  hasMore: boolean;
  /** Pedindo a próxima página. */
  loading: boolean;
  onLoadMore: () => void;
  noun?: AdminLoadMoreNoun;
}

/** "12 de 340 eventos", "12 eventos carregados" ou "12 eventos carregados · fim da lista". */
function counterText({ loaded, total, hasMore, noun }: Pick<AdminLoadMoreProps, "loaded" | "total" | "hasMore" | "noun">): string {
  const word = noun ? ` ${loaded === 1 ? noun.singular : noun.plural}` : "";
  const hasTotal = typeof total === "number" && Number.isFinite(total) && total >= loaded;
  if (hasMore && hasTotal) return `${formatInt(loaded)} de ${formatInt(total)}${word}`;
  const participle = `carregad${noun?.feminine ? "a" : "o"}${loaded === 1 ? "" : "s"}`;
  return `${formatInt(loaded)}${word} ${participle}${hasMore ? "" : " · fim da lista"}`;
}

/**
 * Rodapé de lista com paginação por "Carregar mais" (a lista só cresce; o paginador numerado é o `AdminPager`).
 *
 * - contador em `role="status"`: o texto só muda quando a contagem muda, então o leitor de tela anuncia o
 *   resultado de cada página e não repete nada enquanto carrega;
 * - enquanto carrega, o botão fica `aria-disabled` (não `disabled`): o foco permanece nele, o clique é ignorado e
 *   o spinner aparece. Quando a lista cresce o foco NÃO se move (quem navega por teclado continua onde estava);
 * - quando a última página chega o botão some: se ele tinha o foco, o foco vai para o contador, em vez de cair no `body`;
 * - sem animação de giro com `prefers-reduced-motion`.
 */
export function AdminLoadMore({ loaded, total, hasMore, loading, onLoadMore, noun }: AdminLoadMoreProps) {
  const statusRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const focusWasOnButton = useRef(false);

  // Ref de função: o React o chama com `null` ANTES de tirar o botão do DOM, quando o `activeElement` ainda é ele.
  // (Ouvir `blur` não serve: o Chrome o dispara na remoção, ainda com o nó conectado, e o foco "tinha" sido perdido por clique.)
  const setButton = useCallback((node: HTMLButtonElement | null) => {
    if (node === null && buttonRef.current && document.activeElement === buttonRef.current) focusWasOnButton.current = true;
    buttonRef.current = node;
  }, []);

  // O botão sai do DOM na última página. Se ele tinha o foco, o navegador o jogaria no `body`.
  useLayoutEffect(() => {
    if (hasMore || !focusWasOnButton.current) return;
    focusWasOnButton.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) statusRef.current?.focus();
  }, [hasMore]);

  if (loaded === 0 && !hasMore && !loading) return null;

  return (
    <div className="adm-lm">
      <span ref={statusRef} className="adm-lm-text" role="status" aria-live="polite" aria-atomic="true" tabIndex={-1}>
        {counterText({ loaded, total, hasMore, noun })}
      </span>
      {hasMore ? (
        <button
          ref={setButton}
          type="button"
          className="btn out adm-btn-sm adm-lm-btn"
          aria-disabled={loading ? true : undefined}
          onClick={() => {
            if (!loading) onLoadMore();
          }}
        >
          {loading ? <span className="adm-lm-spin" aria-hidden="true" /> : null}
          {loading ? "Carregando…" : "Carregar mais"}
        </button>
      ) : null}
    </div>
  );
}

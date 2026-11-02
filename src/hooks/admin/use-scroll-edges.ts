import { useCallback, useEffect, useRef, useState } from "react";

export interface ScrollEdges {
  /** Há conteúdo escondido acima da área visível. */
  before: boolean;
  /** Há conteúdo escondido abaixo da área visível. */
  after: boolean;
}

/**
 * Diz se uma lista que rola continua além da borda de cima e/ou de baixo, para a tela mostrar isso de forma
 * discreta (uma linha fina na borda): no macOS a barra de rolagem fica escondida e, sem dica, quem vê só os
 * primeiros itens do menu não sabe que há mais.
 *
 * Remede ao rolar, ao redimensionar a janela ou o elemento e a cada renderização (itens entram e saem do menu
 * sem o elemento mudar de tamanho); só atualiza o estado quando o resultado muda.
 */
export function useScrollEdges<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState<ScrollEdges>({ before: false, after: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const before = el.scrollTop > 1;
    const after = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((previous) => (previous.before === before && previous.after === after ? previous : { before, after }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : undefined;
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [measure]);

  // Sem lista de dependências de propósito: ler a geometria é barato e o conteúdo pode ter mudado.
  useEffect(() => {
    measure();
  });

  return { ref, edges };
}

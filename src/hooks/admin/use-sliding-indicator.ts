import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * Indicador deslizante dos controles segmentados (`.seg > i.ind` + `button.on`) e das abas com sublinhado
 * (`.adm-tabs > i` + `[aria-selected="true"]`): mede o item ativo e posiciona o `<i>`. É o `moveInd` que
 * estava copiado em 7 arquivos, num lugar só.
 *
 * Remede quando o item ativo muda, quando a janela redimensiona e quando as fontes terminam de carregar
 * (a largura dos botões muda). Devolve os refs para ligar ao container e ao indicador.
 *
 * `selector` diz qual descendente é o item ativo (padrão: o `button.on` do `.seg`).
 */
export function useSlidingIndicator<TContainer extends HTMLElement = HTMLDivElement>(
  activeKey: string,
  itemsKey = "",
  selector = "button.on",
) {
  const containerRef = useRef<TContainer>(null);
  const indicatorRef = useRef<HTMLElement>(null);
  const placed = useRef(false);

  const measure = useCallback(() => {
    const active = containerRef.current?.querySelector<HTMLElement>(selector);
    const indicator = indicatorRef.current;
    if (!active || !indicator) return;
    // Primeira posição: sem animar (senão o indicador "cresce" a partir de largura 0 ao abrir a página).
    // Dali em diante, mudar de item anima como no resto do protótipo.
    const firstPlacement = !placed.current;
    if (firstPlacement) indicator.style.transition = "none";
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft}px)`;
    if (firstPlacement) {
      void indicator.offsetWidth; // aplica a posição antes de devolver a transição
      indicator.style.transition = "";
      placed.current = true;
    }
  }, [selector]);

  useLayoutEffect(() => {
    measure();
  }, [measure, activeKey, itemsKey]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    void fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return { containerRef, indicatorRef };
}

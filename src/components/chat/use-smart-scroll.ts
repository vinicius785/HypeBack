import { useCallback, useLayoutEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 120;

/**
 * Rolagem do histórico: abre no divisor de "novas mensagens" (ou no fim); mensagem nova só puxa para baixo quando a
 * pessoa já estava no fim ou foi ela quem enviou; senão mostra quantas chegaram, com atalho para voltar ao fim.
 */
export function useSmartScroll({ count, lastMine, ready }: { count: number; lastMine: boolean; ready: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const seenCount = useRef<number | null>(null);
  const [missed, setMissed] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    if (seenCount.current === null) {
      seenCount.current = count;
      const divider = el.querySelector<HTMLElement>("[data-new-divider]");
      if (divider && el.scrollHeight > el.clientHeight) {
        el.scrollTop = Math.max(0, divider.offsetTop - 56);
        stick.current = false;
      } else {
        el.scrollTop = el.scrollHeight;
      }
      return;
    }
    const added = count - seenCount.current;
    seenCount.current = count;
    if (added <= 0) return;
    if (stick.current || lastMine) {
      el.scrollTop = el.scrollHeight;
      stick.current = true;
      setMissed(0);
    } else {
      setMissed((m) => m + added);
    }
  }, [count, lastMine, ready]);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    stick.current = near;
    if (near) setMissed(0);
  }, []);

  const jump = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    stick.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setMissed(0);
  }, []);

  /** Imagem que carrega depois da rolagem aumenta a altura: quem estava no fim continua no fim. */
  const onMediaLoad = useCallback(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, []);

  return { ref, onScroll, missed, jump, onMediaLoad };
}

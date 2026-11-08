import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  /** Formata o número (padrão: pt-BR com separador de milhar). */
  format?: (n: number) => string;
  duration?: number;
}

const defaultFormat = (n: number) => n.toLocaleString("pt-BR");

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

const prefersReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Número que "sobe" até o valor na primeira vez que aparece (e a cada mudança de valor, a partir do que já mostrava).
 * Sem animação nos testes e para quem pediu menos movimento: aí mostra o valor direto.
 */
export function CountUp({ value, format = defaultFormat, duration = 900 }: CountUpProps) {
  const skip = import.meta.env.MODE === "test" || prefersReducedMotion();
  const [shown, setShown] = useState(skip ? value : 0);
  const fromRef = useRef(skip ? value : 0);

  useEffect(() => {
    if (skip) {
      setShown(value);
      return;
    }
    const from = fromRef.current;
    if (from === value) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const next = Math.round(from + (value - from) * easeOutExpo(t));
      setShown(next);
      fromRef.current = next;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, skip]);

  return <>{format(skip ? value : shown)}</>;
}

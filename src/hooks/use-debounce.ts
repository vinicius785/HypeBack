import { useState, useEffect } from "react";

/**
 * Retorna uma versão "debounced" do valor.
 * O valor só é atualizado após `delayMs` milissegundos de inatividade.
 */
export function useDebounce<T>(value: T, delayMs: number = 400): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

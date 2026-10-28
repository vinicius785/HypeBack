import { useState } from "react";

/**
 * Gerencia seleção múltipla via Set de chaves.
 * Usado nas abas de inscrições, curadoria, aprovação de conteúdo, etc.
 */
export function useBulkSelection(items: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length && items.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items));
    }
  };

  const clear = () => setSelected(new Set());

  const isSelected = (key: string) => selected.has(key);
  const isAllSelected = items.length > 0 && selected.size === items.length;

  return { selected, toggle, toggleAll, clear, isSelected, isAllSelected };
}

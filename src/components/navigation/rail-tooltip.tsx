import { useCallback, useEffect, useState, type FocusEvent, type MouseEvent } from "react";

interface Tip {
  text: string;
  top: number;
  left: number;
}

/**
 * Dica com o nome do item no trilho (sidebar recolhida, ≤ 1100px), onde o rótulo some e só o ícone fica.
 *
 * É uma camada `position: fixed`, e não um pseudo-elemento: a lista de itens rola (`overflow`), e qualquer
 * coisa desenhada dentro dela para fora da borda seria cortada. Funciona também com o foco do teclado.
 * Quem quer dica marca o elemento com `data-tip="Nome"`; os handlers entram uma vez no contêiner (`<aside>`).
 *
 * O CSS (`.sb-tip`) só mostra a camada na largura do trilho; com a sidebar aberta os rótulos já estão na tela.
 */
export function useRailTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);

  const show = useCallback((target: EventTarget | null) => {
    const el = (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-tip]");
    const text = el?.dataset.tip;
    if (!el || !text) {
      setTip(null);
      return;
    }
    const box = el.getBoundingClientRect();
    setTip({ text, top: box.top + box.height / 2, left: box.right + 12 });
  }, []);
  const hide = useCallback(() => setTip(null), []);

  useEffect(() => {
    if (!tip) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTip(null);
    };
    document.addEventListener("keydown", onKey);
    // A lista rolou (ou a janela mudou) com a dica aberta: a posição calculada deixou de valer.
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [tip, hide]);

  const handlers = {
    onMouseOver: (e: MouseEvent) => show(e.target),
    onMouseLeave: hide,
    onFocus: (e: FocusEvent) => show(e.target),
    onBlur: hide,
  };

  const element = tip ? (
    <span role="tooltip" className="sb-tip" style={{ top: tip.top, left: tip.left }}>
      {tip.text}
    </span>
  ) : null;

  return { handlers, element };
}

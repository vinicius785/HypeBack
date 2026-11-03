import { useEffect, useRef, type RefObject } from "react";

/** Elementos que recebem foco pelo teclado dentro de um diálogo. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[hidden]") && !el.closest("[aria-hidden='true']") && el.getAttribute("tabindex") !== "-1",
  );
}

// Trava de rolagem com contagem: diálogo dentro de gaveta não destrava a página ao fechar o de cima.
let lockCount = 0;
let previousOverflow = "";

function lockScroll(): () => void {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount -= 1;
    if (lockCount === 0) document.body.style.overflow = previousOverflow;
  };
}

// Pilha de diálogos abertos: só o do topo reage ao teclado (um diálogo aberto de dentro de outro não
// fecha os dois com um Escape só, nem o foco de um prende o Tab do outro).
const openStack: symbol[] = [];

interface ModalBehaviorOptions {
  /** O diálogo precisa estar montado e visível. */
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  /** Escape: o chamador decide se fecha (ex.: não fecha enquanto grava). */
  onEscape?: () => void;
}

/**
 * O que um diálogo modal acessível precisa e o `PvModal`/`PvOverlay` não têm:
 * - foco entra no diálogo ao abrir (no `[data-adm-autofocus]`, senão no primeiro controle) e **volta**
 *   para quem o abriu ao fechar;
 * - Tab e Shift+Tab ficam presos dentro dele (se o foco escapar, volta);
 * - Escape chama `onEscape` e não chega a mais ninguém (nem à tela por baixo); com `onEscape` ausente
 *   (ex.: gravando) o Escape é só engolido;
 * - a rolagem da página fica travada enquanto estiver aberto.
 * - teclas vindas de um popover do kit (`[data-adm-layer]`, em portal fora do diálogo) ficam com o popover.
 * O `aria-modal`, o `role` e os rótulos são do componente que renderiza.
 *
 * O ouvinte fica na `window`, em captura: roda antes dos ouvintes de `document` que as outras telas
 * (PvOverlay, PvModal, gavetas) registram.
 */
export function useModalBehavior({ open, containerRef, onEscape }: ModalBehaviorOptions): void {
  // O handler muda a cada render (fecha sobre estado); o listener é registrado uma vez por abertura.
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    escapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const token = Symbol("adm-modal");
    openStack.push(token);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlock = lockScroll();

    const initial = container.querySelector<HTMLElement>("[data-adm-autofocus]") ?? focusableIn(container)[0] ?? container;
    initial.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== token) return;
      // Escape durante a composição de um IME só cancela a composição.
      if (event.isComposing) return;
      // Popover do kit (menu, seletor, dica) aberto de dentro do diálogo vive num portal fora dele: o Escape fecha
      // primeiro o popover (uma coisa por vez) e o Tab dentro dele é dele (não puxa o foco ao primeiro controle).
      if (event.key === "Escape" && document.querySelector("[data-adm-layer]")) return;
      if (event.target instanceof Element && event.target.closest("[data-adm-layer]")) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        escapeRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusableIn(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!container.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      const index = openStack.indexOf(token);
      if (index >= 0) openStack.splice(index, 1);
      unlock();
      if (opener && opener.isConnected) opener.focus();
    };
  }, [open, containerRef]);
}

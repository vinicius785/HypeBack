import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** Os dois pontos da gaveta onde cada aba projeta o seu conteúdo: coluna da lista e coluna da conversa. */
export interface ChatSlots {
  list: HTMLElement | null;
  thread: HTMLElement | null;
}

/**
 * Colunas de uma aba. Dentro da gaveta, as colunas, o título e as abas ficam FIXOS e a aba só projeta o conteúdo dela
 * nos `slots`: trocar de aba troca as conversas, sem remontar (nem piscar) o resto. Fora da gaveta (sem `slots`) a aba
 * desenha as próprias colunas, com o `top`.
 */
export function ChatColumns({ top, slots, list, thread }: { top: ReactNode; slots?: ChatSlots; list: ReactNode; thread: ReactNode }) {
  if (slots) {
    if (!slots.list || !slots.thread) return null;
    return (
      <>
        {createPortal(list, slots.list)}
        {createPortal(thread, slots.thread)}
      </>
    );
  }
  return (
    <>
      <div className="mc-list">
        {top}
        {list}
      </div>
      <div className="mc-thread">{thread}</div>
    </>
  );
}

import { useEffect, useRef } from "react";

import { playMessageSound } from "@/lib/chat-sound";

/**
 * Toca o som quando chega uma mensagem de outra pessoa com a conversa aberta. `lastIncomingKey` é o id da última mensagem
 * recebida: o histórico que carrega ao abrir só define o ponto de partida, não toca.
 */
export function useIncomingSound(lastIncomingKey: string | null, ready: boolean): void {
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!ready) return;
    if (prev.current === undefined) {
      prev.current = lastIncomingKey;
      return;
    }
    if (lastIncomingKey !== null && lastIncomingKey !== prev.current) playMessageSound();
    prev.current = lastIncomingKey;
  }, [lastIncomingKey, ready]);
}

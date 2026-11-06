/** Navegação entre criadores do painel superior (sem DOM, para testar). */

export interface PanelNeighbours {
  /** Posição do criador aberto na ordem do quadro (1-based); 0 quando ele não está na lista. */
  position: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
}

/** Anterior e próximo na ordem em que os cartões aparecem no quadro (da esquerda para a direita, de cima para baixo). */
export function panelNeighbours(orderedIds: readonly string[], currentId: string | null): PanelNeighbours {
  const total = orderedIds.length;
  const at = currentId == null ? -1 : orderedIds.indexOf(currentId);
  if (at < 0) return { position: 0, total, prevId: null, nextId: null };
  return {
    position: at + 1,
    total,
    prevId: at > 0 ? orderedIds[at - 1] : null,
    nextId: at < total - 1 ? orderedIds[at + 1] : null,
  };
}

/** Clicar no cartão já aberto recolhe o painel; clicar em outro troca o conteúdo sem fechá-lo. */
export function nextPanelId(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked;
}

/** Motivo da recusa: a observação da movimentação mais recente para "Recusados"; `null` quando não foi registrada. */
export function rejectionReason(
  history: ReadonlyArray<{ status: string; notes?: string; timestamp: string }> | undefined,
): { notes: string; timestamp: string } | null {
  const last = [...(history ?? [])]
    .filter((h) => h.status === "rejected")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  const notes = last?.notes?.trim();
  return last && notes ? { notes, timestamp: last.timestamp } : null;
}

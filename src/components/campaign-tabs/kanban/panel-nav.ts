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

/** Quem fez a movimentação, a partir da origem registrada (a API não devolve o nome da pessoa). */
export function historyActor(source: string | null | undefined): string | null {
  switch (source) {
    case "backoffice":
      return "Equipe";
    case "app":
      return "Criador";
    case "automation":
    case "scheduler":
    case "system":
      return "Automático";
    default:
      return null;
  }
}

/** As últimas `n` movimentações, da mais recente para a mais antiga. */
export function recentHistory<T extends { timestamp: string }>(history: readonly T[] | undefined, n: number): T[] {
  return [...(history ?? [])]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, n);
}

/** Etapas em que o valor negociado faz parte da decisão e por isso aparece já no painel compacto. */
export const NEGOTIATION_INLINE_COLUMNS: readonly string[] = [
  "price_proposed",
  "price_countered",
  "contract_pending",
  "payment_pending",
];

/**
 * Quanto do quadro uma coluna precisa rolar para ficar inteira à vista (px, positivo = para a direita), com `pad` de folga.
 * Zero quando já está toda visível. Se a coluna for mais larga que a área, alinha a borda esquerda.
 */
export function revealDelta(col: { left: number; right: number }, view: { left: number; right: number }, pad: number): number {
  if (col.right - col.left > view.right - view.left - pad * 2) return col.left - (view.left + pad);
  if (col.left < view.left + pad) return col.left - (view.left + pad);
  if (col.right > view.right - pad) return col.right - (view.right - pad);
  return 0;
}

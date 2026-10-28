/**
 * Reconcilia o item "selecionado" (snapshot mantido em estado local, ex.: o
 * influenciador aberto num modal) com a lista recém-buscada da API, casando por
 * `id`.
 *
 * Motivação: modais que renderizam a partir de um snapshot em `useState` ficam
 * com valores congelados após uma mutação que refetcha a lista (ex.: responder
 * a uma negociação de preço) — só atualizavam ao fechar/reabrir. Reaplicar esta
 * função sempre que a lista muda mantém o snapshot em dia.
 *
 * Regras:
 * - Sem seleção (`prev == null`) → mantém `null`.
 * - Item presente na nova lista → retorna a versão fresca (valores atualizados).
 * - Item ausente (ex.: refetch em voo, item removido) → mantém o snapshot atual
 *   (`prev`), para não fechar o modal por um estado transitório.
 *
 * Pura (sem I/O): testável isoladamente.
 */
export function reconcileSelectedById<T extends { id: string | number }>(
  prev: T | null,
  list: readonly T[],
): T | null {
  if (!prev) return prev;
  const fresh = list.find((item) => item.id === prev.id);
  return fresh ?? prev;
}

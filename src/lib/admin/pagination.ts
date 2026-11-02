/**
 * Conta de paginação por página (`AdminPageMeta`): quais botões numerados mostrar e o "X–Y de Z".
 * Funções puras, sem React, para testar sem montar tela.
 */

/** Item da barra numerada: um número de página ou um "…" (a chave diferencia o da esquerda do da direita). */
export type PageItem = number | "ellipsis-start" | "ellipsis-end";

/** `total_pages` do contrato é 0 quando a lista está vazia. */
export function totalPagesFor(total: number, perPage: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(perPage) || total <= 0 || perPage <= 0) return 0;
  return Math.ceil(total / perPage);
}

/** Mantém a página dentro de [1, totalPages]; lista vazia → 1. */
export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  if (totalPages < 1) return 1;
  return Math.min(Math.floor(page), totalPages);
}

/** "X–Y de Z": itens exibidos nesta página (`from`/`to` 1-based; ambos 0 quando não há itens). */
export function pageRange(page: number, perPage: number, total: number): { from: number; to: number } {
  if (total <= 0 || perPage <= 0) return { from: 0, to: 0 };
  const safePage = clampPage(page, totalPagesFor(total, perPage));
  const from = (safePage - 1) * perPage + 1;
  return { from, to: Math.min(safePage * perPage, total) };
}

/**
 * Botões numerados: primeira, última, a atual e `siblings` vizinhas de cada lado, com "…" nos buracos.
 * Até `2 * siblings + 5` páginas todas aparecem. Ex. (siblings 1): 1 2 3 4 5 … 20, 1 … 9 10 11 … 20, 1 … 16 17 18 19 20.
 *
 * A largura é sempre a mesma (`2 * siblings + 5` itens), e um "…" só entra quando esconde duas páginas ou
 * mais: esconder uma só ocuparia o mesmo lugar que o número dela.
 */
export function buildPageList(page: number, totalPages: number, siblings = 1): PageItem[] {
  if (totalPages < 1) return [];
  const current = clampPage(page, totalPages);
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  if (totalPages <= siblings * 2 + 5) return range(1, totalPages);

  const left = Math.max(current - siblings, 2);
  const right = Math.min(current + siblings, totalPages - 1);
  const gapLeft = left > 3;
  const gapRight = right < totalPages - 2;

  if (!gapLeft && gapRight) {
    return [...range(1, 3 + siblings * 2), "ellipsis-end", totalPages];
  }
  if (gapLeft && !gapRight) {
    return [1, "ellipsis-start", ...range(totalPages - (2 + siblings * 2), totalPages)];
  }
  return [1, "ellipsis-start", ...range(left, right), "ellipsis-end", totalPages];
}

/**
 * Normalização de texto para busca — precisa espelhar exatamente
 * `normalizeForSearch` em `hypeapp-api/src/modules/backoffice/influencer-selection.service.ts`.
 *
 * Se o cliente for mais estrito que o servidor, ele esconde resultados que a API
 * acabou de devolver; se for mais frouxo, mostra linhas que somem no próximo fetch.
 */

/** Minúsculas, sem acentos, sem "@" inicial e sem espaços nas pontas. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^@+/, "")
    .toLowerCase()
    .trim();
}

/** Termo pronto para uso, ou `""` quando não há busca ativa. */
export function parseSearchTerm(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  return normalizeForSearch(raw.slice(0, 100));
}

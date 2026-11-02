import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import type { AdminQuery } from "@/lib/admin/admin-client";
import {
  activeFilterKeys,
  readAdminListState,
  stateToApiQuery,
  stateToSearch,
  type AdminListState,
  type AdminListStateConfig,
  type AdminSortOrder,
} from "@/lib/admin/list-query";

type RawSearch = Record<string, unknown>;

export interface AdminSetPageOptions {
  replace?: boolean;
}

export interface AdminListQueryState<F extends string = never> extends AdminListState<F> {
  /** Parâmetros prontos para `adminList(path, params)` / `useAdminList({ params })`. Estável entre renders. */
  params: AdminQuery;
  /** Filtros fora do padrão (sem contar busca, página nem ordenação). */
  activeFilters: F[];
  hasActiveFilters: boolean;
  /**
   * Troca de página: entra no histórico (o "voltar" do navegador volta à página anterior).
   * `{ replace: true }` troca a entrada atual (usado pela correção de página fora do fim, ver `useAdminPageClamp`).
   */
  setPage: (page: number, options?: AdminSetPageOptions) => void;
  setPerPage: (perPage: number) => void;
  setSearch: (search: string) => void;
  setFilter: (key: F, value: string) => void;
  /** Vários filtros de uma vez (um único salto de URL; ex.: intervalo de datas). */
  setFilters: (patch: Partial<Record<F, string>>) => void;
  setSort: (sortBy: string, order?: AdminSortOrder) => void;
  /** Mesma coluna alterna asc/desc; coluna nova começa em `firstOrder`. */
  toggleSort: (sortBy: string, firstOrder?: AdminSortOrder) => void;
  /** "Limpar filtros": volta os filtros ao padrão e à página 1; mantém a busca digitada. */
  clearFilters: () => void;
  /** Tudo ao padrão: busca, filtros, ordenação, página. */
  reset: () => void;
}

/**
 * Página, busca, filtros e ordenação de uma lista do Admin **na URL** (parâmetros de busca do TanStack
 * Router): recarregar, voltar e compartilhar o link preservam a tela, e o Dashboard pode linkar para
 * `/admin/workspaces?status=suspended`.
 *
 * Busca, filtro, ordenação e tamanho de página substituem a entrada do histórico (`replace`) e voltam à
 * página 1; só a troca de página empilha. Chaves da URL que não são desta lista (`tab`, outras listas
 * com `prefix`) são preservadas.
 *
 * Não debounce: o `AdminSearchInput` já segura a digitação e só chama `setSearch` quando a pessoa para.
 * A rota deve declarar `validateSearch: createAdminListSearchValidator(config)` (de `@/lib/admin/list-query`)
 * para o objeto de busca ser tipado para quem linka para ela.
 *
 * `config` pode ser um literal no corpo do componente: só o conteúdo importa, não a identidade.
 */
export function useAdminListQueryState<const F extends string = never>(
  config: AdminListStateConfig<F> = {},
): AdminListQueryState<F> {
  const raw = useSearch({ strict: false }) as RawSearch;
  const navigate = useNavigate();

  // O chamador costuma passar um literal novo a cada render: a identidade muda, o conteúdo não.
  const configKey = JSON.stringify(config);
  const stableConfig = useMemo(() => config, [configKey]);

  const state = useMemo(() => readAdminListState(raw, stableConfig), [raw, stableConfig]);
  const params = useMemo(() => stateToApiQuery(state, stableConfig), [state, stableConfig]);
  const activeFilters = useMemo(() => activeFilterKeys(state, stableConfig), [state, stableConfig]);

  const update = useCallback(
    (change: (current: AdminListState<F>) => AdminListState<F>, mode: "push" | "replace" = "replace") => {
      navigate({
        to: ".",
        // Funcional: parte do que a URL tem *agora*, então duas mudanças seguidas não se atropelam.
        search: ((prev: RawSearch) => {
          const next = stateToSearch(change(readAdminListState(prev, stableConfig)), stableConfig);
          return mergeSearch(prev, next, stableConfig);
        }) as never,
        replace: mode === "replace",
        resetScroll: false,
      } as never);
    },
    [navigate, stableConfig],
  );

  const setPage = useCallback(
    (page: number, options?: AdminSetPageOptions) =>
      update((s) => ({ ...s, page: Math.max(1, Math.floor(page)) }), options?.replace ? "replace" : "push"),
    [update],
  );
  const setPerPage = useCallback((perPage: number) => update((s) => ({ ...s, perPage, page: 1 })), [update]);
  const setSearch = useCallback((search: string) => update((s) => ({ ...s, search: search.trim(), page: 1 })), [update]);
  const setFilters = useCallback(
    (patch: Partial<Record<F, string>>) =>
      update((s) => ({ ...s, page: 1, filters: { ...s.filters, ...(patch as Record<F, string>) } })),
    [update],
  );
  const setFilter = useCallback((key: F, value: string) => setFilters({ [key]: value } as Partial<Record<F, string>>), [setFilters]);
  const setSort = useCallback(
    (sortBy: string, order?: AdminSortOrder) => update((s) => ({ ...s, sortBy, order: order ?? s.order, page: 1 })),
    [update],
  );
  const toggleSort = useCallback(
    (sortBy: string, firstOrder: AdminSortOrder = "asc") =>
      update((s) => ({
        ...s,
        sortBy,
        order: s.sortBy === sortBy ? (s.order === "asc" ? "desc" : "asc") : firstOrder,
        page: 1,
      })),
    [update],
  );
  const clearFilters = useCallback(
    () =>
      update((s) => {
        const filters = { ...s.filters };
        for (const key of stableConfig.filterKeys ?? []) filters[key] = stableConfig.defaultFilters?.[key] ?? "";
        return { ...s, filters, page: 1 };
      }),
    [update, stableConfig],
  );
  const reset = useCallback(
    () => update(() => readAdminListState({}, stableConfig)),
    [update, stableConfig],
  );

  return {
    ...state,
    params,
    activeFilters,
    hasActiveFilters: activeFilters.length > 0,
    setPage,
    setPerPage,
    setSearch,
    setFilter,
    setFilters,
    setSort,
    toggleSort,
    clearFilters,
    reset,
  };
}

/** Troca as chaves que esta lista gerencia e deixa as demais da URL como estão. */
function mergeSearch(
  prev: RawSearch,
  next: Record<string, string | number>,
  config: AdminListStateConfig<string>,
): RawSearch {
  const prefix = config.prefix ?? "";
  const managed = ["page", "per_page", "search", "sort_by", "order", ...(config.filterKeys ?? [])].map(
    (name) => `${prefix}${name}`,
  );
  const out: RawSearch = { ...prev };
  for (const key of managed) delete out[key];
  return { ...out, ...next };
}

/**
 * Se a página pedida passou do fim (filtro encolheu a lista, registro excluído), volta para a última.
 * `totalPages` é o `meta.total_pages` da resposta (0 = lista vazia: fica na 1).
 *
 * A correção troca a entrada do histórico (`replace`), não empilha uma nova: com `push` o "voltar" cairia
 * na página inexistente, o efeito corrigiria de novo e a pessoa ficaria presa nessa lista.
 */
export function useAdminPageClamp(
  page: number,
  totalPages: number | undefined,
  setPage: (page: number, options?: AdminSetPageOptions) => void,
): void {
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages, { replace: true });
  }, [page, totalPages, setPage]);
}

/**
 * Hooks de consulta do Admin da plataforma: a política de cache e de erro vive aqui, uma vez só.
 *
 * - listas mantêm a página anterior na tela enquanto a próxima carrega (o mesmo efeito de `keepPreviousData`,
 *   mas só dentro da mesma lista): trocar de página, filtro ou ordenação não pisca nem volta ao esqueleto, e
 *   trocar de registro (membros de outro workspace) nunca mostra as linhas do anterior;
 * - nada de retry em 4xx (o resultado não muda) nem em resposta fora do contrato; 5xx/rede: até 2 vezes;
 * - o `signal` do React Query vai até o `fetch`: uma busca nova cancela a anterior;
 * - sem `refetchOnWindowFocus`: o Admin atualiza por ação da pessoa ou por intervalo explícito;
 * - a `queryKey` sai de `resource` + `scope` + `params` (via `adminKeys`): os parâmetros da chamada e os da
 *   chave são os mesmos por construção, então não existe lista "velha" por esquecer um filtro na chave.
 *   `adminKeys.resource('workspaces')` invalida tudo do recurso depois de uma ação.
 */
import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  AdminApiError,
  adminFeed,
  adminGet,
  adminList,
  isClientError,
  type AdminFeedResult,
  type AdminListResult,
  type AdminQuery,
} from "@/lib/admin/admin-client";

import { adminKeys, cleanAdminParams, type AdminKeyScope } from "./admin-query-keys";

export const ADMIN_LIST_STALE_MS = 30_000;
export const ADMIN_ITEM_STALE_MS = 15_000;

/** Política de retry do Admin (ver o cabeçalho do arquivo). */
export function adminRetry(failureCount: number, error: unknown): boolean {
  if (isClientError(error)) return false;
  if (error instanceof AdminApiError && error.code === "INVALID_RESPONSE") return false;
  return failureCount < 2;
}

/**
 * `true` quando as duas chaves são da mesma lista e só os parâmetros (o último item da chave) mudam: trocar de
 * página, filtro ou ordenação. Outro recurso ou outro registro (`['members', outroWorkspace]`) é outra lista.
 */
export function isSameListIdentity(previous: readonly unknown[] | undefined, next: readonly unknown[]): boolean {
  if (!previous || previous.length !== next.length) return false;
  for (let i = 0; i < next.length - 1; i += 1) if (previous[i] !== next[i]) return false;
  return true;
}

interface AdminQueryBase {
  /** Caminho depois de `/api/backoffice`, ex.: `/admin/workspaces` (use `adminPath` para ids). */
  path: string;
  params?: AdminQuery;
  enabled?: boolean;
  staleTime?: number;
  /** Atualização periódica (ms). Só para telas de acompanhamento (saúde, alertas). */
  refetchInterval?: number | false;
}

export interface AdminListOptions extends AdminQueryBase {
  /** `'workspaces'`, `'users'`...: prefixo da chave de cache. */
  resource: string;
  /** Sub-lista de um registro (`['members', workspaceId]`). */
  scope?: AdminKeyScope;
  /** Só para fugir da chave padrão. */
  queryKey?: readonly unknown[];
}

export interface AdminItemOptions extends AdminQueryBase {
  resource: string;
  /** Id do registro (workspace, usuário...). Sem id, é uma consulta avulsa (`overview`, `alerts`...). */
  id?: string | number;
  /** Parte do registro (`['financial']`, `['impact']`). */
  scope?: AdminKeyScope;
  queryKey?: readonly unknown[];
}

export interface AdminFeedOptions extends AdminQueryBase {
  resource: string;
  scope?: AdminKeyScope;
  queryKey?: readonly unknown[];
}

/**
 * Lista paginada: `data` é `{ data, meta }`. Mantém a página anterior enquanto a nova carrega, mas só quando é a
 * mesma lista (página, filtro, ordenação): ao trocar de registro nunca aparecem as linhas de outro.
 */
export function useAdminList<T>(options: AdminListOptions): UseQueryResult<AdminListResult<T>, unknown> {
  const { resource, scope, path, params, enabled = true, staleTime = ADMIN_LIST_STALE_MS, refetchInterval } = options;
  const queryKey = options.queryKey ?? adminKeys.list(resource, params, scope);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => adminList<T>(path, params, { signal }),
    placeholderData: (previous, previousQuery) =>
      isSameListIdentity(previousQuery?.queryKey, queryKey) ? previous : undefined,
    retry: adminRetry,
    refetchOnWindowFocus: false,
    enabled,
    staleTime,
    refetchInterval,
  });
}

/** Um registro (detalhe, resumo, impacto). Sem placeholder: nunca mostra os dados de outro registro. */
export function useAdminItem<T>(options: AdminItemOptions): UseQueryResult<T, unknown> {
  const { resource, id, scope = [], path, params, enabled = true, staleTime = ADMIN_ITEM_STALE_MS, refetchInterval } = options;
  const queryKey =
    options.queryKey ??
    (id !== undefined
      ? adminKeys.detail(resource, id, scope, params)
      : adminKeys.of(resource, "item", ...scope, cleanAdminParams(params)));
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => adminGet<T>(path, params, { signal }),
    retry: adminRetry,
    refetchOnWindowFocus: false,
    enabled,
    staleTime,
    refetchInterval,
  });
}

/** Feed por cursor (atividade, movimentações): "carregar mais" com `fetchNextPage`. */
export function useAdminFeed<T>(
  options: AdminFeedOptions,
): UseInfiniteQueryResult<InfiniteData<AdminFeedResult<T>, string | null>, unknown> {
  const { resource, scope, path, params, enabled = true, staleTime = ADMIN_LIST_STALE_MS, refetchInterval } = options;
  return useInfiniteQuery({
    queryKey: options.queryKey ?? adminKeys.feed(resource, params, scope),
    queryFn: ({ pageParam, signal }) =>
      adminFeed<T>(path, { ...params, cursor: pageParam ?? undefined }, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.next_cursor : undefined),
    retry: adminRetry,
    refetchOnWindowFocus: false,
    enabled,
    staleTime,
    refetchInterval,
  });
}

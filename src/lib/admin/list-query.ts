/**
 * Estado de uma lista do Admin (página, busca, filtros, ordenação) ⇄ parâmetros da URL ⇄ query da API.
 *
 * Os nomes são os do contrato (`page`, `per_page`, `search`, `sort_by`, `order` e as chaves de filtro,
 * como `status`/`kind`), então a URL da tela e a query da API usam a mesma linguagem e um link do
 * Dashboard (`/admin/workspaces?status=suspended`) é só um objeto de busca.
 *
 * Valores iguais ao padrão não vão para a URL (URLs curtas e sem ruído). O que vem da URL é sempre
 * revalidado: a barra de endereço é entrada de usuário.
 */
import type { AdminQuery } from "./admin-client";

export const ADMIN_PER_PAGE_OPTIONS = [25, 50, 100] as const;
export const ADMIN_DEFAULT_PER_PAGE = 25;
/** Limite de `search` no contrato. */
export const ADMIN_SEARCH_MAX_LENGTH = 100;

export type AdminSortOrder = "asc" | "desc";

export interface AdminListStateConfig<F extends string = never> {
  /** Chaves de filtro (texto; CSV vale, ex.: `status=active,suspended`). */
  filterKeys?: readonly F[];
  /** Filtros com valor padrão: igual ao padrão sai da URL e não conta como "filtro ativo". */
  defaultFilters?: Partial<Record<F, string>>;
  /** Lista branca de `sort_by`. Sem ela qualquer texto passa (o backend também valida). */
  sortKeys?: readonly string[];
  defaultSortBy?: string;
  defaultOrder?: AdminSortOrder;
  perPageOptions?: readonly number[];
  defaultPerPage?: number;
  /** Prefixo das chaves na URL (várias listas na mesma tela: `m_page`, `c_page`…). */
  prefix?: string;
}

export interface AdminListState<F extends string = never> {
  page: number;
  perPage: number;
  search: string;
  sortBy: string | undefined;
  order: AdminSortOrder;
  filters: Record<F, string>;
}

/** Forma do objeto de busca da rota (`validateSearch`): tudo opcional, só o que não é padrão. */
export type AdminListSearch<F extends string = never> = {
  page?: number;
  per_page?: number;
  search?: string;
  sort_by?: string;
  order?: AdminSortOrder;
} & { [K in F]?: string };

type RawSearch = Record<string, unknown>;

function scalarToString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return undefined;
}

function toPositiveInt(value: unknown): number | undefined {
  const text = scalarToString(value);
  if (text === undefined || !/^\d+$/.test(text.trim())) return undefined;
  const n = Number(text.trim());
  return Number.isSafeInteger(n) && n >= 1 ? n : undefined;
}

function toOrder(value: unknown): AdminSortOrder | undefined {
  const text = scalarToString(value)?.toLowerCase();
  return text === "asc" || text === "desc" ? text : undefined;
}

function toSearch(value: unknown): string | undefined {
  const text = scalarToString(value);
  if (text === undefined) return undefined;
  const trimmed = text.trim().slice(0, ADMIN_SEARCH_MAX_LENGTH);
  return trimmed === "" ? undefined : trimmed;
}

function urlKey(config: { prefix?: string }, name: string): string {
  return `${config.prefix ?? ""}${name}`;
}

/** Lê o estado a partir do objeto de busca da URL (já parseado pelo roteador), com padrões e validação. */
export function readAdminListState<F extends string = never>(
  raw: RawSearch,
  config: AdminListStateConfig<F> = {},
): AdminListState<F> {
  const perPageOptions = config.perPageOptions ?? ADMIN_PER_PAGE_OPTIONS;
  const defaultPerPage = config.defaultPerPage ?? ADMIN_DEFAULT_PER_PAGE;

  const perPageRaw = toPositiveInt(raw[urlKey(config, "per_page")]);
  const sortRaw = scalarToString(raw[urlKey(config, "sort_by")])?.trim();
  const sortValid = sortRaw && (!config.sortKeys || config.sortKeys.includes(sortRaw));

  const filters = {} as Record<F, string>;
  for (const key of config.filterKeys ?? []) {
    const value = scalarToString(raw[urlKey(config, key)])?.trim();
    filters[key] = value ? value : (config.defaultFilters?.[key] ?? "");
  }

  return {
    page: toPositiveInt(raw[urlKey(config, "page")]) ?? 1,
    perPage: perPageRaw !== undefined && perPageOptions.includes(perPageRaw) ? perPageRaw : defaultPerPage,
    search: toSearch(raw[urlKey(config, "search")]) ?? "",
    sortBy: sortValid ? sortRaw : config.defaultSortBy,
    order: toOrder(raw[urlKey(config, "order")]) ?? config.defaultOrder ?? "desc",
    filters,
  };
}

/**
 * Validador para `createFileRoute(...)({ validateSearch })`: devolve só os campos válidos e diferentes
 * do padrão. É o que deixa `<Link search={{ status: "suspended" }}>` e `navigate({ search })` tipados
 * para a rota da lista.
 */
export function createAdminListSearchValidator<const F extends string = never>(
  config: AdminListStateConfig<F> = {},
): (raw: RawSearch) => AdminListSearch<F> {
  return (raw) => {
    const state = readAdminListState(raw, config);
    return stateToSearch(state, config) as AdminListSearch<F>;
  };
}

/** Estado → objeto de busca da URL (sem valores padrão). */
export function stateToSearch<F extends string = never>(
  state: AdminListState<F>,
  config: AdminListStateConfig<F> = {},
): Record<string, string | number> {
  const defaultPerPage = config.defaultPerPage ?? ADMIN_DEFAULT_PER_PAGE;
  const out: Record<string, string | number> = {};
  if (state.page > 1) out[urlKey(config, "page")] = state.page;
  if (state.perPage !== defaultPerPage) out[urlKey(config, "per_page")] = state.perPage;
  if (state.search) out[urlKey(config, "search")] = state.search;
  if (state.sortBy && state.sortBy !== config.defaultSortBy) out[urlKey(config, "sort_by")] = state.sortBy;
  if (state.order !== (config.defaultOrder ?? "desc")) out[urlKey(config, "order")] = state.order;
  for (const key of config.filterKeys ?? []) {
    const value = state.filters[key];
    if (value && value !== (config.defaultFilters?.[key] ?? "")) out[urlKey(config, key)] = value;
  }
  return out;
}

/** Estado → query da API (`GET /admin/...?page=&per_page=&search=&sort_by=&order=&<filtros>`). */
export function stateToApiQuery<F extends string = never>(
  state: AdminListState<F>,
  config: AdminListStateConfig<F> = {},
): AdminQuery {
  const query: AdminQuery = { page: state.page, per_page: state.perPage };
  if (state.search) query.search = state.search;
  if (state.sortBy) {
    query.sort_by = state.sortBy;
    query.order = state.order;
  }
  for (const key of config.filterKeys ?? []) {
    const value = state.filters[key];
    // Padrão do servidor é igual ao padrão da tela quando `defaultFilters` o espelha; só envia o que muda.
    if (value && value !== (config.defaultFilters?.[key] ?? "")) query[key] = value;
  }
  return query;
}

/** Filtros que a pessoa mexeu (fora do padrão); não conta busca, página nem ordenação. */
export function activeFilterKeys<F extends string = never>(
  state: AdminListState<F>,
  config: AdminListStateConfig<F> = {},
): F[] {
  return (config.filterKeys ?? []).filter((key) => {
    const value = state.filters[key];
    return !!value && value !== (config.defaultFilters?.[key] ?? "");
  });
}

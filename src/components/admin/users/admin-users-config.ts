/**
 * Configuração da lista de Usuários, compartilhada pela tela e pela rota (`validateSearch`): os filtros e a
 * ordenação que moram na URL e os valores que a API já assume quando o parâmetro não vem.
 */
import type { AdminFilterOption } from "@/components/admin/platform";
import type { AdminListStateConfig } from "@/lib/admin/list-query";

export const ADMIN_USERS_FILTER_KEYS = ["status", "kind", "workspace_id", "created_from", "created_to", "trust_max"] as const;
export type AdminUsersFilterKey = (typeof ADMIN_USERS_FILTER_KEYS)[number];

/**
 * Padrão da tela: ativos e suspensos, SEM as contas em cadastro. A API, sem `status`, agora devolve também as
 * `pending`; por isso a consulta manda este valor sempre, explícito (ver `usersApiParams`).
 */
export const ADMIN_USERS_DEFAULT_STATUS = "active,suspended";
/** O que a API devolve sem `kind`: usuários de marca (types 20, 30 e 100); criadores têm a tela deles. */
export const ADMIN_USERS_DEFAULT_KIND = "brand";

export const ADMIN_USERS_LIST_CONFIG = {
  filterKeys: ADMIN_USERS_FILTER_KEYS,
  // Igual ao padrão da API: sem mexer nos filtros nada vai na URL nem na consulta.
  defaultFilters: { status: ADMIN_USERS_DEFAULT_STATUS, kind: ADMIN_USERS_DEFAULT_KIND },
  // `trust`: o servidor ordena por confiança em TODA a lista (nível e nota); asc = suspeitos primeiro.
  sortKeys: ["created_at", "name", "last_session", "trust"],
  defaultSortBy: "created_at",
  defaultOrder: "desc",
} as const satisfies AdminListStateConfig<AdminUsersFilterKey>;

/**
 * Estado da conta. O primeiro é o padrão da API ("ativos e suspensos"): sem ele não haveria como dizer, na
 * tela, o que a lista mostra quando ninguém mexeu no filtro. `all` inclui os excluídos.
 */
export const ADMIN_USERS_STATUS_OPTIONS: readonly AdminFilterOption[] = [
  { value: ADMIN_USERS_DEFAULT_STATUS, label: "Ativos e suspensos" },
  { value: "active", label: "Ativos" },
  { value: "suspended", label: "Suspensos" },
  { value: "pending", label: "Em cadastro" },
  { value: "deleted", label: "Excluídos" },
  { value: "all", label: "Todos" },
];

export const ADMIN_USERS_KIND_OPTIONS: readonly AdminFilterOption[] = [
  { value: ADMIN_USERS_DEFAULT_KIND, label: "Marca" },
  { value: "creator", label: "Criadores" },
  { value: "all", label: "Todos" },
];

/** Filtro "Só suspeitos": confiança nível 1 e 2. */
export const ADMIN_USERS_SUSPECT_TRUST_MAX = "2";

/** Parâmetros da consulta: os da URL e o `status` sempre explícito (o padrão da API agora inclui `pending`). */
export function usersApiParams<T extends Record<string, unknown>>(params: T, status: string | undefined): T & { status: string } {
  return { ...params, status: status || ADMIN_USERS_DEFAULT_STATUS };
}

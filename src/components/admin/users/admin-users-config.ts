/**
 * Configuração da lista de Usuários, compartilhada pela tela e pela rota (`validateSearch`): os filtros e a
 * ordenação que moram na URL e os valores que a API já assume quando o parâmetro não vem.
 */
import type { AdminFilterOption } from "@/components/admin/platform";
import type { AdminListStateConfig } from "@/lib/admin/list-query";

export const ADMIN_USERS_FILTER_KEYS = ["status", "account_status", "workspace_id", "created_from", "created_to"] as const;
export type AdminUsersFilterKey = (typeof ADMIN_USERS_FILTER_KEYS)[number];

/**
 * Padrão da tela: ativos e suspensos, SEM as contas em cadastro. A API, sem `status`, agora devolve também as
 * `pending`; por isso a consulta manda este valor sempre, explícito (ver `usersApiParams`).
 */
export const ADMIN_USERS_DEFAULT_STATUS = "active,suspended";

export const ADMIN_USERS_LIST_CONFIG = {
  filterKeys: ADMIN_USERS_FILTER_KEYS,
  // Igual ao padrão da API: sem mexer nos filtros nada vai na URL nem na consulta.
  defaultFilters: { status: ADMIN_USERS_DEFAULT_STATUS },
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


/** Situação da conta de criador no app (filtro `account_status` da API, CSV). Vazio = sem filtro. */
export const ADMIN_ACCOUNT_SITUATION_FILTER_OPTIONS: readonly AdminFilterOption[] = [
  { value: "", label: "Todas as situações" },
  { value: "active", label: "Ativa" },
  { value: "suspended", label: "Suspensa" },
];

/** Parâmetros da consulta: os da URL e o `status` sempre explícito (o padrão da API agora inclui `pending`). */
export function usersApiParams<T extends Record<string, unknown>>(params: T, status: string | undefined): T & { status: string } {
  return { ...params, status: status || ADMIN_USERS_DEFAULT_STATUS };
}

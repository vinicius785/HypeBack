/**
 * Configuração da lista de Usuários, compartilhada pela tela e pela rota (`validateSearch`): os filtros e a
 * ordenação que moram na URL e os valores que a API já assume quando o parâmetro não vem.
 */
import type { AdminFilterOption } from "@/components/admin/platform";
import type { AdminListStateConfig } from "@/lib/admin/list-query";

export const ADMIN_USERS_FILTER_KEYS = ["status", "kind", "workspace_id", "created_from", "created_to"] as const;
export type AdminUsersFilterKey = (typeof ADMIN_USERS_FILTER_KEYS)[number];

/** O que a API devolve sem `status`: ativos e suspensos (excluídos ficam de fora). */
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
  { value: "deleted", label: "Excluídos" },
  { value: "all", label: "Todos" },
];

export const ADMIN_USERS_KIND_OPTIONS: readonly AdminFilterOption[] = [
  { value: ADMIN_USERS_DEFAULT_KIND, label: "Marca" },
  { value: "creator", label: "Criadores" },
  { value: "all", label: "Todos" },
];

/**
 * Consultas e estado de URL dos criadores globais do Admin (`/admin/creators`), somente leitura.
 *
 * Uma rota, três abas na URL (`?tab=duplicates`, `?tab=inconsistencies`; a primeira não escreve nada):
 * cada aba tem o seu próprio conjunto de parâmetros, e `validateAdminCreatorsSearch` só deixa passar os da aba que
 * está aberta. Trocar de aba não arrasta filtro de uma para a outra.
 *
 * O que vem da URL é revalidado: UGC nunca é rede social (não vira filtro de rede), data inexistente e número
 * quebrado saem da busca em vez de virar um filtro que a tela não mostra ou uma consulta recusada com 400.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import {
  AdminApiError,
  adminGetEnvelope,
  type AdminListResult,
  type AdminQuery,
} from "@/lib/admin/admin-client";
import {
  createAdminListSearchValidator,
  type AdminListSearch,
  type AdminListStateConfig,
} from "@/lib/admin/list-query";
import type {
  AdminCreatorListItem,
  AdminCreatorRegistrationState,
  AdminDuplicateGroup,
  AdminDuplicateReason,
  AdminInconsistenciesResponse,
  AdminInconsistency,
} from "@/shared/admin-platform.types";

import { adminKeys } from "./admin-query-keys";
import { ADMIN_LIST_STALE_MS, adminRetry, useAdminList } from "./use-admin-queries";

// ---------------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------------

export type AdminCreatorsTab = "creators" | "duplicates" | "inconsistencies";

export const ADMIN_CREATORS_DEFAULT_TAB: AdminCreatorsTab = "creators";

export function parseAdminCreatorsTab(value: unknown): AdminCreatorsTab {
  return value === "duplicates" || value === "inconsistencies" ? value : ADMIN_CREATORS_DEFAULT_TAB;
}

// ---------------------------------------------------------------------------
// Aba "Criadores"
// ---------------------------------------------------------------------------

/** Redes sociais de verdade. UGC é um tipo de conteúdo, não uma rede: não é opção de filtro. */
export const ADMIN_CREATOR_NETWORKS = ["instagram", "instagram_facebook", "tiktok", "youtube"] as const;

export const ADMIN_CREATOR_REGISTRATIONS = [
  "complete",
  "incomplete",
  "stub",
] as const satisfies readonly AdminCreatorRegistrationState[];

export type AdminCreatorFilterKey = "network" | "registration" | "min_followers" | "created_from" | "created_to";

export const ADMIN_CREATOR_LIST_CONFIG = {
  filterKeys: ["network", "registration", "min_followers", "created_from", "created_to"],
  /** Ordenações do contrato (`sort_by`). */
  sortKeys: ["created_at", "followers", "campaigns", "name"],
  defaultSortBy: "created_at",
  defaultOrder: "desc",
} as const satisfies AdminListStateConfig<AdminCreatorFilterKey>;

// ---------------------------------------------------------------------------
// Aba "Duplicados"
// ---------------------------------------------------------------------------

export const ADMIN_DUPLICATE_REASONS = [
  "email",
  "phone",
  "document",
  "social_handle",
  "identity_conflict",
] as const satisfies readonly AdminDuplicateReason[];

export const ADMIN_DUPLICATE_CONFIDENCES = ["high", "possible"] as const;

export type AdminDuplicateFilterKey = "reason" | "confidence";

/** Cada grupo é um cartão alto (vários usuários): páginas menores que as das tabelas. */
export const ADMIN_DUPLICATES_LIST_CONFIG = {
  filterKeys: ["reason", "confidence"],
  /** A lista não ordena (o contrato não tem `sort_by` aqui): nada de `sort_by` na URL nem na consulta. */
  sortKeys: [],
  perPageOptions: [10, 25, 50],
  defaultPerPage: 10,
} as const satisfies AdminListStateConfig<AdminDuplicateFilterKey>;

// ---------------------------------------------------------------------------
// validateSearch da rota
// ---------------------------------------------------------------------------

export type AdminCreatorsSearch = {
  tab?: Exclude<AdminCreatorsTab, "creators">;
} & AdminListSearch<AdminCreatorFilterKey> &
  AdminListSearch<AdminDuplicateFilterKey>;

/** `YYYY-MM-DD` de um dia que existe (31/02 não existe). */
function isCivilDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const MAX_MIN_FOLLOWERS = 2_000_000_000;

const creatorsValidator = createAdminListSearchValidator(ADMIN_CREATOR_LIST_CONFIG);
const duplicatesValidator = createAdminListSearchValidator(ADMIN_DUPLICATES_LIST_CONFIG);

/**
 * O roteador junta a busca crua da URL com o que o validador devolve (`{ ...crua, ...validada }`): um valor recusado
 * precisa voltar como `undefined` de propósito, porque tirar a chave do objeto deixaria o valor da URL passar. Por
 * isso cada filtro com regra própria sempre aparece no resultado, com o valor aceito ou com `undefined`.
 */
function validateCreatorsList(raw: Record<string, unknown>): AdminListSearch<AdminCreatorFilterKey> {
  const search = { ...creatorsValidator(raw) };
  if (!search.network || !(ADMIN_CREATOR_NETWORKS as readonly string[]).includes(search.network)) search.network = undefined;
  if (!search.registration || !(ADMIN_CREATOR_REGISTRATIONS as readonly string[]).includes(search.registration)) {
    search.registration = undefined;
  }
  // Zero é o mesmo que não filtrar; o resto precisa ser um inteiro que o servidor aceita.
  const followers = search.min_followers !== undefined && /^\d+$/.test(search.min_followers) ? Number(search.min_followers) : NaN;
  search.min_followers =
    Number.isSafeInteger(followers) && followers >= 1 && followers <= MAX_MIN_FOLLOWERS ? String(followers) : undefined;
  if (!search.created_from || !isCivilDate(search.created_from)) search.created_from = undefined;
  if (!search.created_to || !isCivilDate(search.created_to)) search.created_to = undefined;
  if (search.created_from && search.created_to && search.created_from > search.created_to) {
    search.created_to = search.created_from;
  }
  return search;
}

function validateDuplicatesList(raw: Record<string, unknown>): AdminListSearch<AdminDuplicateFilterKey> {
  const search = { ...duplicatesValidator(raw) };
  delete search.order; // sem ordenação nesta lista
  if (!search.reason || !(ADMIN_DUPLICATE_REASONS as readonly string[]).includes(search.reason)) search.reason = undefined;
  if (!search.confidence || !(ADMIN_DUPLICATE_CONFIDENCES as readonly string[]).includes(search.confidence)) {
    search.confidence = undefined;
  }
  return search;
}

/** `validateSearch` da rota: só os parâmetros da aba aberta (a de criadores não escreve `tab`). */
export function validateAdminCreatorsSearch(raw: Record<string, unknown>): AdminCreatorsSearch {
  const tab = parseAdminCreatorsTab(raw.tab);
  if (tab === "duplicates") return { tab, ...validateDuplicatesList(raw) };
  if (tab === "inconsistencies") return { tab };
  return validateCreatorsList(raw);
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** `GET /admin/creators`: a página da lista. */
export function useAdminCreators(params: AdminQuery): UseQueryResult<AdminListResult<AdminCreatorListItem>, unknown> {
  return useAdminList<AdminCreatorListItem>({ resource: "creators", path: "/admin/creators", params });
}

/**
 * As redes de UM criador, para o detalhe do usuário. A API não tem rota de um criador só (nem manda as redes no detalhe do
 * usuário), então busca na lista pelo e-mail e pega a linha com o mesmo id. Só consulta para conta de criador.
 */
export function useAdminCreatorNetworks(user: { id: number; email: string; kind: string }): {
  creator: AdminCreatorListItem | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
} {
  const enabled = user.kind === "creator";
  const query = useAdminList<AdminCreatorListItem>({
    resource: "creators",
    path: "/admin/creators",
    params: { search: user.email, page: 1, per_page: 10 },
    scope: ["user-networks", user.id],
    enabled,
  });
  const creator = query.data?.data.find((item) => item.id === user.id) ?? null;
  return { creator, isLoading: enabled && query.isLoading, error: enabled ? query.error : null, refetch: () => void query.refetch() };
}

/** `GET /admin/creators/duplicates`: grupos de possíveis duplicados (só leitura). */
export function useAdminCreatorDuplicates(
  params: AdminQuery,
): UseQueryResult<AdminListResult<AdminDuplicateGroup>, unknown> {
  return useAdminList<AdminDuplicateGroup>({
    resource: "creators",
    scope: ["duplicates"],
    path: "/admin/creators/duplicates",
    params,
  });
}

export interface AdminInconsistenciesResult {
  items: AdminInconsistency[];
  /** Quando o servidor fez a conta (`meta.computed_at`). */
  computedAt: string | null;
}

/**
 * `GET /admin/creators/inconsistencies`. Não tem paginação (`{ data, meta: { computed_at } }`), e o `computed_at` é
 * parte do que a tela mostra, então não passa por `useAdminItem` (que guarda só o `data`). Mesma política de cache e
 * de retry das demais consultas do Admin.
 */
export function useAdminCreatorInconsistencies(): UseQueryResult<AdminInconsistenciesResult, unknown> {
  return useQuery({
    queryKey: adminKeys.of("creators", "inconsistencies"),
    queryFn: async ({ signal }) => {
      const { data, meta } = await adminGetEnvelope<AdminInconsistency[], AdminInconsistenciesResponse["meta"]>(
        "/admin/creators/inconsistencies",
        undefined,
        { signal },
      );
      if (!Array.isArray(data)) {
        throw new AdminApiError({
          status: 200,
          code: "INVALID_RESPONSE",
          message: "O servidor respondeu em um formato inesperado.",
          details: { reason: "`data` não é uma lista" },
        });
      }
      return { items: data, computedAt: meta?.computed_at ?? null };
    },
    retry: adminRetry,
    refetchOnWindowFocus: false,
    staleTime: ADMIN_LIST_STALE_MS,
  });
}

import { useQuery } from "@tanstack/react-query";

import {
  lookupUserById,
  lookupUsersByIds,
  type UserSummary,
} from "@/shared/services/users-lookup";

export const USER_LOOKUP_KEYS = {
  byId: (id: number) => ["user-lookup", "by-id", id] as const,
  byIds: (ids: number[]) => ["user-lookup", "by-ids", [...ids].sort()] as const,
};

export function useUserById(id: number | null | undefined) {
  return useQuery({
    queryKey: USER_LOOKUP_KEYS.byId(id ?? -1),
    queryFn: () => lookupUserById(id as number),
    enabled: id != null && id > 0,
    staleTime: 60_000,
    retry: 1,
  });
}

/**
 * Batch helper: resolve uma lista de ids num único request.
 * Útil para enriquecer linhas de tabela com info do user.
 */
export function useUsersByIds(ids: number[]) {
  const sortedKey = [...ids].sort((a, b) => a - b);
  return useQuery({
    queryKey: USER_LOOKUP_KEYS.byIds(sortedKey),
    queryFn: () => lookupUsersByIds(sortedKey),
    enabled: ids.length > 0,
    staleTime: 60_000,
    select: (rows): Map<number, UserSummary> =>
      new Map(rows.map((u) => [u.id, u])),
  });
}

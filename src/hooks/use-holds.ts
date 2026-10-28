import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelHold,
  listHolds,
  markAvailable,
  markAwaitingRelease,
  releaseExpired,
  reserveHold,
  withdrawHold,
  type Hold,
  type HoldStatus,
  type ListHoldsFilters,
  type ReserveHoldPayload,
} from "@/shared/services/holds";
import { HYPEPOINT_QUERY_KEYS } from "./use-hypepoint";

export const HOLDS_QUERY_KEYS = {
  all: ["holds"] as const,
  list: (filters: ListHoldsFilters) =>
    [...HOLDS_QUERY_KEYS.all, "list", filters] as const,
  byId: (id: number) => [...HOLDS_QUERY_KEYS.all, "by-id", id] as const,
};

export function useHoldsList(filters: ListHoldsFilters = {}) {
  return useQuery({
    queryKey: HOLDS_QUERY_KEYS.list(filters),
    queryFn: () => listHolds(filters),
    staleTime: 15_000,
  });
}

function useInvalidateHolds() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: HOLDS_QUERY_KEYS.all });
    qc.invalidateQueries({ queryKey: HYPEPOINT_QUERY_KEYS.all });
  };
}

export function useReserveHold() {
  const invalidate = useInvalidateHolds();
  return useMutation({
    mutationFn: (payload: ReserveHoldPayload) => reserveHold(payload),
    onSuccess: invalidate,
  });
}

export function useAdvanceToAwaitingRelease() {
  const invalidate = useInvalidateHolds();
  return useMutation({
    mutationFn: (holdId: number) => markAwaitingRelease(holdId),
    onSuccess: invalidate,
  });
}

export function useAdvanceToAvailable() {
  const invalidate = useInvalidateHolds();
  return useMutation({
    mutationFn: (params: { holdId: number; force?: boolean }) =>
      markAvailable(params.holdId, { force: params.force }),
    onSuccess: invalidate,
  });
}

export function useCancelHold() {
  const invalidate = useInvalidateHolds();
  return useMutation({
    mutationFn: (params: { holdId: number; reason?: string }) =>
      cancelHold(params.holdId, params.reason),
    onSuccess: invalidate,
  });
}

export function useWithdrawHold() {
  const invalidate = useInvalidateHolds();
  return useMutation({
    mutationFn: (holdId: number) => withdrawHold(holdId),
    onSuccess: invalidate,
  });
}

export function useReleaseExpired() {
  const invalidate = useInvalidateHolds();
  return useMutation({
    mutationFn: () => releaseExpired(),
    onSuccess: invalidate,
  });
}

export type { Hold, HoldStatus };

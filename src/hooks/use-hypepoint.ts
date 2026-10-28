import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getHypepointBalance,
  getHypepointInfo,
  listHypepointOperations,
  transferHypepoint,
  type TransferHypepointPayload,
} from "@/shared/services/hypepoint";

export const HYPEPOINT_QUERY_KEYS = {
  all: ["hypepoint"] as const,
  info: () => [...HYPEPOINT_QUERY_KEYS.all, "info"] as const,
  balance: () => [...HYPEPOINT_QUERY_KEYS.all, "balance"] as const,
  operations: (limit: number) =>
    [...HYPEPOINT_QUERY_KEYS.all, "operations", limit] as const,
};

export function useHypepointInfo() {
  return useQuery({
    queryKey: HYPEPOINT_QUERY_KEYS.info(),
    queryFn: getHypepointInfo,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useHypepointBalance() {
  return useQuery({
    queryKey: HYPEPOINT_QUERY_KEYS.balance(),
    queryFn: getHypepointBalance,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

export function useHypepointOperations(limit = 20) {
  return useQuery({
    queryKey: HYPEPOINT_QUERY_KEYS.operations(limit),
    queryFn: () => listHypepointOperations(limit),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useTransferHypepoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransferHypepointPayload) =>
      transferHypepoint(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HYPEPOINT_QUERY_KEYS.all });
    },
  });
}

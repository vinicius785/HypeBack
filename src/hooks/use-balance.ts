import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkspaceBalance, topUpWorkspace } from "@/shared/services/balance";
import { getWorkspaceId } from "@/lib/utils/api";

export const BALANCE_QUERY_KEYS = {
  workspace: (id: string) => ["balance", "workspace", id] as const,
};

export function useWorkspaceBalance() {
  const workspaceId = getWorkspaceId() ?? "";
  return useQuery({
    queryKey: BALANCE_QUERY_KEYS.workspace(workspaceId),
    queryFn: () => getWorkspaceBalance(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
    retry: 1,
  });
}

/**
 * Invalida o saldo do workspace. Use no `onSuccess` de qualquer mutação que o
 * backend reserve/libere valor (aceite de inscrição, convite, pré-seleção),
 * para que "Reservado/Disponível" no header e no Financeiro reflitam na hora.
 */
export function useInvalidateWorkspaceBalance() {
  const queryClient = useQueryClient();
  const workspaceId = getWorkspaceId() ?? "";
  return () => {
    if (!workspaceId) return;
    queryClient.invalidateQueries({
      queryKey: BALANCE_QUERY_KEYS.workspace(workspaceId),
    });
  };
}

export function useTopUpWorkspace() {
  const queryClient = useQueryClient();
  const workspaceId = getWorkspaceId() ?? "";

  return useMutation({
    mutationFn: (amount_cents: number) => topUpWorkspace(workspaceId, amount_cents),
    onSuccess: () => {
      // Invalida o saldo para forçar refetch após confirmação do PIX
      queryClient.invalidateQueries({ queryKey: BALANCE_QUERY_KEYS.workspace(workspaceId) });
    },
  });
}

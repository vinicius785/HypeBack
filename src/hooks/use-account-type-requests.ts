import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAccountTypeRequest,
  listAccountTypeRequests,
  type AccountType,
} from "@/shared/services/account-type-requests";

export const accountTypeRequestsKey = (workspaceId: string | undefined) => ["account-type-requests", workspaceId] as const;

/** Pedidos de troca do tipo de conta do workspace (o primeiro é o mais recente). */
export function useAccountTypeRequests(workspaceId: string | undefined) {
  return useQuery({
    queryKey: accountTypeRequestsKey(workspaceId),
    queryFn: () => listAccountTypeRequests(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  });
}

export function useCreateAccountTypeRequest(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { requested_type: AccountType; justification: string }) => createAccountTypeRequest(workspaceId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountTypeRequestsKey(workspaceId) }),
  });
}

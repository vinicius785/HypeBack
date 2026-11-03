import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acceptWorkspaceInvite,
  cancelWorkspaceInvite,
  declineWorkspaceInvite,
  listMyWorkspaceInvites,
  listWorkspaceInvites,
} from "@/shared/services/workspace-invites";

export const MY_INVITES_KEY = ["my-workspace-invites"] as const;

/** Convites que a pessoa logada recebeu e ainda não respondeu. */
export function useMyWorkspaceInvites({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: MY_INVITES_KEY,
    queryFn: listMyWorkspaceInvites,
    staleTime: 60 * 1000,
    enabled,
  });
}

/** Aceitar entra no time da marca: a lista de workspaces e a de convites precisam ser relidas. */
export function useAcceptWorkspaceInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: number) => acceptWorkspaceInvite(inviteId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["me-workspaces"] }),
        queryClient.invalidateQueries({ queryKey: MY_INVITES_KEY }),
      ]);
    },
  });
}

export function useDeclineWorkspaceInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: number) => declineWorkspaceInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_INVITES_KEY }),
  });
}

/** Convites pendentes da marca (tela de equipe). */
export function useWorkspaceInvitesQuery(workspaceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["workspace-invites", workspaceId],
    queryFn: () => listWorkspaceInvites(workspaceId!),
    enabled: !!workspaceId && enabled,
  });
}

export function useCancelWorkspaceInvite(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: number) => cancelWorkspaceInvite(workspaceId, inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace-invites", workspaceId] }),
  });
}

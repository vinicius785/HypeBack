import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  inviteWorkspaceMember,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  type InviteWorkspaceMemberInput,
} from "@/shared/services/workspace";
import type { WorkspaceRole } from "@/shared/types";

export function useWorkspaceMembersQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => listWorkspaceMembers(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useInviteWorkspaceMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteWorkspaceMemberInput) =>
      inviteWorkspaceMember(workspaceId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-members", workspaceId],
      });
    },
  });
}

export function useUpdateWorkspaceMemberRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      role,
      permissions,
    }: {
      userId: number;
      role: WorkspaceRole;
      permissions?: string[];
    }) => updateWorkspaceMemberRole(workspaceId, userId, role, permissions),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-members", workspaceId],
      });
    },
  });
}

export function useRemoveWorkspaceMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      removeWorkspaceMember(workspaceId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["workspace-members", workspaceId],
      });
    },
  });
}

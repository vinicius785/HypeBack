import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  downloadSignedContract,
  getCampaignContracts,
  getContractStatus,
  getContractTemplates,
  getContractVariables,
  getWorkspaceContractDefaults,
  resendContract,
  sendContractTemplate,
  uploadCustomContract,
  upsertWorkspaceContractDefaults,
  type SendContractTemplateData,
  type UploadCustomContractData,
} from "@/shared/services/contract";
import type { WorkspaceContractDefaults } from "@/shared/types";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";
import { invalidateCampaignTaskBoards } from "@/hooks/use-invalidate-task-boards";

// ---------------------------------------------------------------------------
// Listagem / status
// ---------------------------------------------------------------------------

export function useCampaignContracts(
  campaignId: string,
  filters?: { status?: string; influencer_id?: string },
) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "contracts", filters],
      workspaceId,
    ),
    queryFn: () => getCampaignContracts(campaignId, filters),
    enabled: !!campaignId && !!workspaceId,
    // Refetch periódico para refletir webhooks DocuSign sem bloquear UI.
    refetchInterval: 10_000,
  });
}

export function useContractStatus(campaignId: string, contractId: string) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "contracts", contractId],
      workspaceId,
    ),
    queryFn: () => getContractStatus(campaignId, contractId),
    enabled: !!campaignId && !!contractId && !!workspaceId,
    refetchInterval: 5_000,
  });
}

// ---------------------------------------------------------------------------
// Templates / variáveis / defaults
// ---------------------------------------------------------------------------

export function useContractTemplates() {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(["contract-templates"], workspaceId),
    queryFn: () => getContractTemplates(),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Variáveis exibidas no painel lateral do upload — raramente mudam, cache longo. */
export function useContractVariables() {
  return useQuery({
    queryKey: ["contract-variables"],
    queryFn: () => getContractVariables(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useWorkspaceContractDefaults() {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(["workspace-contract-defaults"], workspaceId),
    queryFn: () => getWorkspaceContractDefaults(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    // Endpoint pode retornar 404 quando ainda não há defaults — não vale tentar de novo.
    retry: false,
  });
}

export function useUpsertWorkspaceContractDefaults() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  return useMutation({
    mutationFn: (payload: WorkspaceContractDefaults) =>
      upsertWorkspaceContractDefaults(workspaceId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-contract-defaults"],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations de envio / reenvio / upload / download
// ---------------------------------------------------------------------------

function invalidateCampaignContracts(
  queryClient: ReturnType<typeof useQueryClient>,
  campaignId: string,
) {
  queryClient.invalidateQueries({
    queryKey: ["campaigns", campaignId, "contracts"],
  });
  invalidateCampaignTaskBoards(queryClient, campaignId);
}

export function useSendContractTemplate(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SendContractTemplateData) =>
      sendContractTemplate(campaignId, data),
    onSuccess: () => invalidateCampaignContracts(queryClient, campaignId),
  });
}

export function useUploadCustomContract(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UploadCustomContractData) =>
      uploadCustomContract(campaignId, data),
    onSuccess: () => invalidateCampaignContracts(queryClient, campaignId),
  });
}

export function useResendContract(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contractId: string) => resendContract(campaignId, contractId),
    onSuccess: () => invalidateCampaignContracts(queryClient, campaignId),
  });
}

export function useDownloadContract(campaignId: string) {
  return useMutation({
    mutationFn: ({
      contractId,
      filename,
    }: {
      contractId: string;
      filename?: string;
    }) => downloadSignedContract(campaignId, contractId, filename),
  });
}

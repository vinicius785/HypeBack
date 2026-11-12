import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  activateCampaignBoost,
  type CreateCampaignData,
  type UpdateCampaignData,
} from "@/shared/services/campaign";
import type { CampaignBoost } from "@/shared/types";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

export function useCampaigns(options?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(["campaigns"], workspaceId),
    queryFn: getCampaigns,
    enabled: (options?.enabled !== false) && !!workspaceId,
  });
}

export function useCampaign(campaignId: string) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(["campaigns", campaignId], workspaceId),
    queryFn: () => getCampaign(campaignId),
    enabled: !!campaignId && !!workspaceId,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCampaignData) => createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      data,
    }: {
      campaignId: string;
      data: UpdateCampaignData;
    }) => updateCampaign(campaignId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({
        queryKey: ["campaigns", variables.campaignId],
      });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) => deleteCampaign(campaignId),
    onSuccess: (_, campaignId) => {
      // A campanha deixou de existir: tira dela do cache ANTES de invalidar, para a tela que ainda a mostra não
      // refazer a consulta (404) e piscar um erro no instante da exclusão.
      queryClient.removeQueries({ queryKey: ["campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}


/**
 * Usar o Boost. No sucesso grava o `boost` devolvido direto no detalhe da campanha em cache (o cartão muda na hora) e
 * consulta de novo; numa recusa (409: já usado, campanha não publicada ou inscrições fechadas) só consulta de novo, para o
 * cartão refletir o que a API diz.
 */
export function useActivateCampaignBoost(campaignId: string) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();
  const detailKey = withWorkspaceKey(["campaigns", campaignId], workspaceId);

  return useMutation({
    mutationFn: () => activateCampaignBoost(campaignId),
    onSuccess: (boost: CampaignBoost) => {
      queryClient.setQueryData(detailKey, (current: unknown) =>
        current && typeof current === "object" ? { ...current, boost } : current,
      );
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });
}

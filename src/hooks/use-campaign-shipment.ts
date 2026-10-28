import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCampaignShipments,
  createShipment,
  type CreateShipmentDto,
} from "@/shared/services/campaign-shipment";

export function useCampaignShipments(campaignId: string) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "shipments"],
    queryFn: () => listCampaignShipments(campaignId),
    enabled: !!campaignId,
    staleTime: 30_000,
  });
}

export function useCreateShipment(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      influencerId,
      dto,
    }: {
      influencerId: string;
      dto: CreateShipmentDto;
    }) => createShipment(campaignId, influencerId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "shipments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "management"],
      });
    },
  });
}

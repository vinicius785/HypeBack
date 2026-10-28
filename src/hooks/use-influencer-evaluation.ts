import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInfluencerEvaluation,
  createInfluencerEvaluation,
  getBrandEvaluation,
  type CreateEvaluationDto,
} from "@/shared/services/influencer-evaluation";

export function useInfluencerEvaluation(campaignId: string, influencerId: string | null) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "users", influencerId, "evaluation"],
    queryFn: () => getInfluencerEvaluation(campaignId, influencerId!),
    enabled: !!campaignId && !!influencerId,
    staleTime: 30_000,
    retry: false,
  });
}

export function useBrandEvaluation(campaignId: string, influencerId: string | null) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "users", influencerId, "brand-evaluation"],
    queryFn: () => getBrandEvaluation(campaignId, influencerId!),
    enabled: !!campaignId && !!influencerId,
    staleTime: 30_000,
    retry: false,
  });
}

export function useCreateInfluencerEvaluation(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      influencerId,
      dto,
    }: {
      influencerId: string;
      dto: CreateEvaluationDto;
    }) => createInfluencerEvaluation(campaignId, influencerId, dto),
    onSuccess: (_data, { influencerId }) => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "users", influencerId, "evaluation"],
      });
    },
  });
}

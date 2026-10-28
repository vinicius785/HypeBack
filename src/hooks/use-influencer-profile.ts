import { useQuery } from "@tanstack/react-query";
import { getInfluencerProfile } from "@/shared/services/influencer";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

export function useInfluencerProfile(influencerId: string, metricsPosts = 10) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["influencers", influencerId, "profile", metricsPosts],
      workspaceId,
    ),
    queryFn: () => getInfluencerProfile(influencerId, metricsPosts),
    enabled: Boolean(influencerId) && !!workspaceId,
  });
}

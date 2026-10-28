import { useQuery } from "@tanstack/react-query";
import {
  getCampaignDashboard,
  transformDashboardPhase,
  transformDashboardInfluencer,
  transformDashboardContent,
  type DashboardResponse,
} from "@/shared/services/dashboard";
import type { CampaignPhase, Influencer, CampaignContent } from "@/shared/types";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

export interface CampaignDashboardData {
  phases: CampaignPhase[];
  influencers: Influencer[];
  contents: CampaignContent[];
  metrics: {
    reach: number;
    engagement: number;
    publishedContent: number;
    activeInfluencers: number;
    /** Progresso da campanha (0–100) calculado pelo backend. */
    progress: number;
  };
}

/** Mesma transformação de `useCampaignDashboard` — útil para `useQueries` no overview do workspace. */
export async function fetchCampaignDashboardData(
  campaignId: string,
): Promise<CampaignDashboardData> {
  const data: DashboardResponse = await getCampaignDashboard(campaignId);
  return {
    phases: data.phases.map(transformDashboardPhase),
    influencers: data.influencers.map(transformDashboardInfluencer),
    contents: data.contents.map(transformDashboardContent),
    metrics: {
      reach: data.metrics.reach,
      engagement: data.metrics.engagement,
      publishedContent: data.metrics.published_content,
      activeInfluencers: data.metrics.active_influencers,
      progress: data.metrics.progress,
    },
  };
}

/**
 * GET .../dashboard — influenciadores, conteúdos e métricas agregadas.
 * Fases podem vir em GET /campaigns/:id (`phases`); o front prefere essas e usa o dashboard só como fallback para fases.
 */
export function useCampaignDashboard(campaignId: string) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "dashboard"],
      workspaceId,
    ),
    queryFn: () => fetchCampaignDashboardData(campaignId),
    enabled: !!campaignId && !!workspaceId,
    staleTime: 30000, // 30 segundos - cache por 30s
  });
}


import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import type { Influencer } from "../types";

export interface CatalogFilters {
  social_network?: string;
  age_range?: string;
  gender?: string;
  followers_min?: number;
  followers_max?: number;
  niche?: string;
  country?: string;
  state?: string;
  city?: string;
}

export interface Recommendation {
  influencer: {
    id: string;
    name: string;
    avatar: string;
  };
  reason: string;
}

/** Agregados retornados em `data` (formato atual do endpoint). */
export interface InfluencersCatalogStats {
  influencer_count: number;
  total_followers: number;
  followers_by_network?: Record<string, number>;
}

export interface InfluencersCatalogResult {
  /** Vazio quando a API só devolve agregados em `data`. */
  items: Influencer[];
  stats?: InfluencersCatalogStats;
}

/**
 * Lista o catálogo de influenciadores disponíveis
 */
export async function getInfluencersCatalog(
  filters?: CatalogFilters
): Promise<InfluencersCatalogResult> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const params = new URLSearchParams();
  if (filters?.social_network)
    params.append("social_network", filters.social_network);
  if (filters?.age_range) params.append("age_range", filters.age_range);
  if (filters?.gender) params.append("gender", filters.gender);
  if (filters?.followers_min)
    params.append("followers_min", filters.followers_min.toString());
  if (filters?.followers_max)
    params.append("followers_max", filters.followers_max.toString());
  if (filters?.niche) params.append("niche", filters.niche);
  if (filters?.country) params.append("country", filters.country);
  if (filters?.state) params.append("state", filters.state);
  if (filters?.city) params.append("city", filters.city);

  const url = `/influencers/catalog${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  const request = await fetch(getApiUrl(url), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
      "Workspace-Id": workspaceId,
    },
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to get influencers catalog" };
    }
    throw errorData || "Failed to get influencers catalog";
    }

  const response = await request.json();
  const raw = response as {
    data?: unknown;
    meta?: {
      total_followers?: number;
      followers_by_network?: Record<string, number>;
    };
  };

  const asNum = (v: unknown): number | undefined =>
    typeof v === "number" && !Number.isNaN(v) ? v : undefined;

  const parseFollowersByNetwork = (
    v: unknown
  ): Record<string, number> | undefined => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(v)) {
      const n = asNum(val);
      if (n !== undefined) out[k] = n;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };

  const d = raw.data;

  // Formato atual: data = { influencer_count, total_followers, followers_by_network }
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const o = d as Record<string, unknown>;
    const influencer_count = asNum(o.influencer_count) ?? 0;
    const total_followers = asNum(o.total_followers) ?? 0;
    const followers_by_network = parseFollowersByNetwork(
      o.followers_by_network
    );
    const items = Array.isArray(o.influencers)
      ? (o.influencers as Influencer[])
      : [];
    return {
      items,
      stats: {
        influencer_count,
        total_followers,
        ...(followers_by_network ? { followers_by_network } : {}),
      },
    };
  }

  // Legado: data = array de influenciadores; meta opcional com totais
  if (Array.isArray(d)) {
    const items = d as Influencer[];
    const m = raw.meta;
    let stats: InfluencersCatalogStats | undefined;
    if (m && typeof m === "object" && asNum(m.total_followers) !== undefined) {
      const byNet = parseFollowersByNetwork(m.followers_by_network);
      stats = {
        influencer_count: items.length,
        total_followers: asNum(m.total_followers)!,
        ...(byNet ? { followers_by_network: byNet } : {}),
      };
    }
    return { items, stats };
  }

  return { items: [], stats: undefined };
}

/**
 * Retorna recomendações automáticas de influenciadores para a campanha
 */
export async function getCampaignRecommendations(
  campaignId: string
): Promise<Recommendation[]> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/influencers/campaigns/${campaignId}/recommendations`),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to get campaign recommendations" };
    }
    throw errorData || "Failed to get campaign recommendations";
    }

  const response = await request.json();
  return response.data;
}


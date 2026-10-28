import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import type { ContentMetrics, IdentifiedPost } from "../types";

/** Normaliza linha da API (snake_case) para ContentMetrics */
export function normalizeContentMetricsPayload(
  raw: Record<string, unknown>
): ContentMetrics {
  const id = String(raw.content_id ?? raw.contentId ?? "");
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    contentId: id,
    views: num(raw.views),
    likes: num(raw.likes),
    comments: num(raw.comments),
    shares: num(raw.shares),
    engagement: num(raw.engagement),
    reach: num(raw.reach),
  };
}

export interface CampaignContentsMetricsMapResponse {
  by_content_id: Record<string, ContentMetrics>;
}

export interface CampaignTopCityRow {
  rank: number;
  city_name: string;
  state: string;
  engagement_score: number;
}

export interface AudienceAgeBucket {
  label: string;
  percent: number;
}

export interface AudienceNetworkAgeData {
  has_data: boolean;
  age_buckets: AudienceAgeBucket[];
}

export interface CampaignAudienceByAgeResponse {
  networks: Record<string, AudienceNetworkAgeData>;
}

function compareAudienceAgeLabels(a: string, b: string): number {
  const n = (s: string) => {
    const m = /(\d+)/.exec(s);
    return m ? parseInt(m[1], 10) : 0;
  };
  return n(a) - n(b);
}

export interface AudienceBarSeries {
  labels: string[];
  instagram: number[];
  youtube: number[];
  /** Rede tem faixas etárias reais — só então a série dela pode ser plotada. */
  hasInstagram: boolean;
  hasYoutube: boolean;
}

/**
 * Cruza faixas etárias de Instagram e YouTube em séries alinhadas por label
 * (para gráfico de barras).
 *
 * Retorna `null` quando NENHUMA rede tem dados — a UI não deve desenhar nada
 * nesse caso. Os flags `hasInstagram`/`hasYoutube` existem para não plotar a
 * série zerada de uma rede que o influenciador nem cadastrou: sem eles, um
 * perfil só de Instagram ganhava um YouTube fantasma no gráfico.
 */
export function buildAudienceBarSeries(
  networks: Record<string, AudienceNetworkAgeData> | undefined
): AudienceBarSeries | null {
  if (!networks || Object.keys(networks).length === 0) return null;
  const ig = networks.instagram;
  const yt = networks.youtube;
  const igBuckets: AudienceAgeBucket[] =
    ig?.has_data && ig.age_buckets?.length ? ig.age_buckets : [];
  const ytBuckets: AudienceAgeBucket[] =
    yt?.has_data && yt.age_buckets?.length ? yt.age_buckets : [];
  if (igBuckets.length === 0 && ytBuckets.length === 0) return null;
  const labelSet = new Set<string>();
  igBuckets.forEach((b) => b.label && labelSet.add(b.label));
  ytBuckets.forEach((b) => b.label && labelSet.add(b.label));
  const labels = Array.from(labelSet).sort(compareAudienceAgeLabels);
  const mapPct = (buckets: AudienceAgeBucket[], label: string) => {
    const hit = buckets.find((x) => x.label === label);
    return hit ? hit.percent : 0;
  };
  return {
    labels,
    instagram: labels.map((l) => mapPct(igBuckets, l)),
    youtube: labels.map((l) => mapPct(ytBuckets, l)),
    hasInstagram: igBuckets.length > 0,
    hasYoutube: ytBuckets.length > 0,
  };
}

/** Faixa etária com maior percentual (para título “Maior público …”). */
export function topAgeBracketLabel(
  buckets: AudienceAgeBucket[] | undefined
): string {
  if (!buckets?.length) return "—";
  const top = buckets.reduce(
    (best, cur) => (cur.percent > best.percent ? cur : best),
    buckets[0]
  );
  if (!top?.label) return "—";
  return top.label.includes("–") ? top.label : top.label.replace(/-/g, "–");
}

export interface CampaignMetrics {
  reach: number;
  engagement: number;
  published_content: number;
  active_influencers: number;
  conversion_rate?: number;
}

export interface InfluencerMetrics {
  influencer_id: string;
  influencer_name: string;
  influencer_avatar: string;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_reach: number;
  average_engagement: number;
  contents_count: number;
}

/**
 * Busca métricas gerais da campanha
 */
export async function getCampaignMetrics(
  campaignId: string
): Promise<CampaignMetrics> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(getApiUrl(`/campaigns/${campaignId}/metrics`), {
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
      errorData = { message: "Failed to get campaign metrics" };
    }
    throw errorData || "Failed to get campaign metrics";
    }

  const response = await request.json();
  return response.data;
}

/**
 * Busca métricas por influenciador
 */
export async function getInfluencerMetrics(
  campaignId: string
): Promise<InfluencerMetrics[]> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/metrics/influencers`),
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
      errorData = { message: "Failed to get influencer metrics" };
    }
    throw errorData || "Failed to get influencer metrics";
    }

  const response = await request.json();
  return response.data;
}

/**
 * Mapa em lote: métricas por conteúdo publicado (identified_posts).
 * GET /campaigns/:campaignId/metrics/contents
 */
export async function getCampaignContentsMetricsMap(
  campaignId: string
): Promise<CampaignContentsMetricsMapResponse> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/metrics/contents`),
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
      errorData = { message: "Failed to get campaign contents metrics map" };
    }
    throw errorData || "Failed to get campaign contents metrics map";
  }

  const response = await request.json();
  const rawMap = response.data?.by_content_id;
  const by_content_id: Record<string, ContentMetrics> = {};

  if (rawMap && typeof rawMap === "object" && !Array.isArray(rawMap)) {
    for (const [key, value] of Object.entries(rawMap)) {
      if (value && typeof value === "object") {
        const m = normalizeContentMetricsPayload(value as Record<string, unknown>);
        by_content_id[key] = {
          ...m,
          contentId: m.contentId || key,
        };
      }
    }
  }

  return { by_content_id };
}

/**
 * Ranking de cidades por engajamento agregado.
 * GET /campaigns/:campaignId/metrics/top-cities
 */
export async function getCampaignTopCities(
  campaignId: string,
  limit = 5
): Promise<CampaignTopCityRow[]> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const params = new URLSearchParams();
  params.set("limit", String(Math.min(50, Math.max(1, limit))));

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/metrics/top-cities?${params.toString()}`),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Client-Type": "backoffice",
        "Workspace-Id": workspaceId,
        Authorization: `Bearer ${getAuthToken()}`,
      },
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to get top cities metrics" };
    }
    throw errorData || "Failed to get top cities metrics";
  }

  const response = await request.json();
  const rows = response.data;
  if (!Array.isArray(rows)) return [];
  return rows.map((row: Record<string, unknown>) => ({
    rank: Number(row.rank) || 0,
    city_name: String(row.city_name ?? ""),
    state: String(row.state ?? ""),
    engagement_score: Number(row.engagement_score) || 0,
  }));
}

/**
 * Demografia por idade (metadata dos posts identificados).
 * GET /campaigns/:campaignId/metrics/audience-by-age
 */
export async function getCampaignAudienceByAge(
  campaignId: string
): Promise<CampaignAudienceByAgeResponse> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/metrics/audience-by-age`),
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
      errorData = { message: "Failed to get audience by age" };
    }
    throw errorData || "Failed to get audience by age";
  }

  const response = await request.json();
  const networksRaw = response.data?.networks;
  const networks: Record<string, AudienceNetworkAgeData> = {};

  if (networksRaw && typeof networksRaw === "object" && !Array.isArray(networksRaw)) {
    for (const [netKey, netVal] of Object.entries(networksRaw)) {
      if (!netVal || typeof netVal !== "object") continue;
      const n = netVal as Record<string, unknown>;
      const bucketsRaw = n.age_buckets;
      const age_buckets: AudienceAgeBucket[] = Array.isArray(bucketsRaw)
        ? bucketsRaw.map((b: Record<string, unknown>) => ({
            label: String(b.label ?? ""),
            percent: Number(b.percent) || 0,
          }))
        : [];
      networks[netKey.toLowerCase()] = {
        has_data: Boolean(n.has_data),
        age_buckets,
      };
    }
  }

  return { networks };
}

/**
 * Busca métricas de um conteúdo específico
 * GET /campaigns/:campaignId/metrics/contents/:contentId
 */
export async function getContentMetrics(
  campaignId: string,
  contentId: string
): Promise<ContentMetrics> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/metrics/contents/${contentId}`),
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
      errorData = { message: "Failed to get content metrics" };
    }
    throw errorData || "Failed to get content metrics";
  }

  const response = await request.json();
  const d = response.data as Record<string, unknown>;
  return normalizeContentMetricsPayload(d);
}

/**
 * Busca publicações identificadas automaticamente
 */
export async function getIdentifiedPosts(
  campaignId: string,
  filters?: {
    phase_id?: string;
  }
): Promise<IdentifiedPost[]> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const params = new URLSearchParams();
  if (filters?.phase_id) params.append("phase_id", filters.phase_id);

  const url = `/campaigns/${campaignId}/metrics/identified-posts${
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
      errorData = { message: "Failed to get identified posts" };
    }
    throw errorData || "Failed to get identified posts";
    }

  const response = await request.json();
  return response.data;
}


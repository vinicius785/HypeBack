import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import type { Influencer } from "../types";
import type { AudienceNetworkAgeData } from "./metrics";

/** Métricas por rede (ex.: instagram, tiktok, youtube) */
export interface MetricsByNetwork {
  gender_split?: { women_percent?: number; men_percent?: number };
  followers?: number;
  likes?: number;
  average_reach?: number;
  engagement_percent?: number;
  total_posts_in_hypeapp?: number;
  campaigns_participated_in_hypeapp?: number;

  // Instagram — posts normais (IMAGE / CAROUSEL_ALBUM)
  posts_likes_sum?: number;
  posts_likes_avg?: number;
  posts_views_sum?: number;
  posts_views_avg?: number;
  posts_fetched?: number;

  // Instagram — reels (REELS / VIDEO)
  reels_likes_sum?: number;
  reels_likes_avg?: number;
  reels_views_sum?: number;
  reels_views_avg?: number;
  reels_reach_sum?: number;
  reels_reach_avg?: number;
  reels_fetched?: number;

  // TikTok
  tiktok_likes_sum?: number;
  tiktok_likes_avg?: number;
  tiktok_views_sum?: number;
  tiktok_views_avg?: number;
  tiktok_fetched?: number;

  // YouTube — Shorts (duração ≤ 60s)
  yt_shorts_likes_sum?: number;
  yt_shorts_likes_avg?: number;
  yt_shorts_views_sum?: number;
  yt_shorts_views_avg?: number;
  yt_shorts_fetched?: number;

  // YouTube — Vídeos longos (duração > 60s)
  yt_videos_likes_sum?: number;
  yt_videos_likes_avg?: number;
  yt_videos_views_sum?: number;
  yt_videos_views_avg?: number;
  yt_videos_fetched?: number;

  // Distribuição etária da audiência (retornada dentro de metrics_by_network)
  age_split?: Array<{ label: string; percent: number }>;
}

/** Item de top conteúdos */
export interface TopContentItem {
  id: string;
  image_url?: string | null;
  is_video?: boolean;
  views?: number;
  likes?: number;
  post_url?: string | null;
}

/** Campanha do influenciador no Hypeapp */
export interface HypeappCampaignItem {
  id: string;
  logo_url?: string | null;
  campaign_name?: string | null;
  brand_name?: string | null;
  date?: string | null;
  rating?: number | null;
  description?: string | null;
  delivery_thumbnails?: string[];
  views?: number;
  likes?: number;
}

/**
 * Perfil do influenciador no backoffice.
 * `campaign` é preenchido quando o backend quiser breadcrumb de contexto (opcional na rota standalone).
 */
export interface CampaignInfluencerProfileResponse {
  campaign?: {
    id: string;
    title: string;
  } | null;
  influencer: {
    id: string;
    name: string;
    /** Contato do cadastro (#1/#34). */
    email?: string | null;
    phone?: string | null;
    username: string;
    /** Username único do app (chave da URL pública /u/:username). */
    app_username?: string | null;
    avatar: string | null;
    followers: number;
    engagement: number;
    niche?: string;
    niche_name: string | null;
    sub_niche_names?: string[];
    status?: string;
    phase?: string;
    social_networks?: Array<{
      id: number | string;
      type: string;
      name: string;
      username?: string;
      members?: number;
      status?: string;
      photo?: string | null;
      bio?: string | null;
    }>;
    is_external?: boolean;
    pre_registered_social_profiles?: Array<{
      network: string;
      profile_url: string;
    }>;
    location?: { state?: string; city?: string };
    bio?: string | null;
    rating?: number | null;
    rating_max?: number;
    /** Endereço de envio da permuta/produto (dado cadastral do usuário). */
    shipping_address?: {
      street: string;
      number: string;
      complement?: string | null;
      neighborhood: string;
      city: string;
      state: string;
      zip: string;
      country?: string;
    } | null;
  };
  metrics_by_network?: Record<string, MetricsByNetwork>;
  total_posts_in_hypeapp?: number;
  campaigns_participated_in_hypeapp?: number;
  trust_index?: number | null;
  top_contents?: TopContentItem[];
  hypeapp_campaigns?: HypeappCampaignItem[];
  /**
   * Audiência por idade (mesmo formato de GET .../metrics/audience-by-age).
   * Opcional até o backend incluir em GET /influencers/:id/profile.
   */
  audience_by_age?: {
    networks: Record<string, AudienceNetworkAgeData>;
  } | null;
}

/**
 * Perfil do influenciador (página dedicada, fora da URL da campanha).
 * GET /influencers/:influencerId/profile
 * O identificador deve ser o mesmo usado nas navegações “Ver perfil” (alinhar com o backend).
 */
export async function getInfluencerProfile(
  influencerId: string,
  metricsPosts = 10
): Promise<CampaignInfluencerProfileResponse> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/influencers/${influencerId}/profile?metrics_posts=${metricsPosts}`),
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
    if (request.status === 404) {
      const error = new Error("Influenciador não encontrado") as any;
      error.status = 404;
      throw error;
    }
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to get influencer profile" };
    }
    const error = new Error(
      errorData?.message || "Failed to get influencer profile"
    ) as any;
    error.status = request.status;
    throw error;
  }

  const response = await request.json();
  return response.data;
}

/**
 * Perfil PÚBLICO do influenciador (página compartilhável `/u/:username`).
 * GET /backoffice/public/influencers/:username — SEM auth/workspace (endpoint
 * aberto no backend, `PublicInfluencersController`). Mesmo shape do perfil do
 * backoffice (portfólio global). `username` aqui é o `users.username` (app),
 * não o handle da rede social.
 */
export async function getPublicInfluencerProfile(
  username: string
): Promise<CampaignInfluencerProfileResponse> {
  const request = await fetch(
    getApiUrl(`/public/influencers/${encodeURIComponent(username)}`),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Client-Type": "backoffice",
      },
    }
  );

  if (!request.ok) {
    if (request.status === 404) {
      const error = new Error("Influenciador não encontrado") as Error & { status?: number };
      error.status = 404;
      throw error;
    }
    let errorData: { message?: string } | undefined;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to get public influencer profile" };
    }
    const error = new Error(
      errorData?.message || "Failed to get public influencer profile"
    ) as Error & { status?: number };
    error.status = request.status;
    throw error;
  }

  const response = await request.json();
  return response.data;
}

export interface InfluencerStatusUpdate {
  influencer_id: string;
  status: string;
  feedback?: string;
  network_id?: number | string;
}

export interface InfluencerProfile {
  id: string;
  type: string; // "tiktok", "youtube", "instagram", etc.
  type_label: string; // "TikTok", "YouTube", "Instagram", etc.
  name: string;
  username: string;
  members: number; // Número de seguidores/membros
  created_at?: string;
  /** Foto do perfil na rede (path de upload ou URL) */
  avatar?: string | null;
  /** Engajamento % nesta rede social */
  engagement_percent?: number | null;
  /** Quando a API lista todos os perfis, indica se pode ser convidado nesta campanha */
  can_invite?: boolean;
}

function numOrUndef(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function firstString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** Normaliza item da API (camelCase ou snake_case) */
function normalizeInfluencerProfile(raw: unknown): InfluencerProfile {
  const p = raw as Record<string, unknown>;
  const engagement =
    numOrUndef(p.engagement_percent) ??
    numOrUndef(p.engagement_rate) ??
    numOrUndef(p.engagement);
  const inviteFalse =
    p.can_invite === false ||
    p.invite_eligible === false ||
    p.eligible_for_invite === false;
  const inviteTrue =
    p.can_invite === true ||
    p.invite_eligible === true ||
    p.eligible_for_invite === true;

  return {
    id: String(p.id ?? ""),
    type: String(p.type ?? ""),
    type_label: String(p.type_label ?? p.type ?? ""),
    name: String(p.name ?? ""),
    username: String(p.username ?? p.handle ?? p.user_name ?? ""),
    members:
      numOrUndef(p.members) ??
      numOrUndef(p.followers) ??
      numOrUndef(p.followers_count) ??
      0,
    created_at: p.created_at != null ? String(p.created_at) : undefined,
    avatar:
      firstString(
        p.avatar,
        p.photo,
        p.picture,
        p.image_url,
        p.profile_picture,
        p.profile_image_url,
        p.thumbnail_url,
        p.thumbnail
      ) ?? null,
    engagement_percent:
      engagement != null ? engagement : null,
    can_invite: inviteFalse ? false : inviteTrue ? true : undefined,
  };
}

export interface InfluencerInviteData {
  influencer_id: string;
  message?: string;
  profile_ids?: string[]; // IDs dos perfis selecionados
  /**
   * Valor proposto ao criador, em centavos (BRL). Obrigatório quando a campanha
   * usa `payment_method === "individual_price"`; ignorado nos demais métodos.
   */
  proposed_price_cents?: number;
  /**
   * Preço POR REDE (individual_price por rede). Quando presente, abre uma
   * negociação por rede. Redes fora da campanha são descartadas no backend.
   */
  network_prices?: { network_id: number; proposed_price_cents: number }[];
}

/**
 * Normaliza status de português para inglês
 * Garante que todos os status sejam sempre em inglês, usando os valores do enum do backend
 * Baseado em CampaignUserStatusEnum do backend
 */
function normalizeStatus(status: string | undefined): string {
  if (!status) return "applications";

  const statusMap: { [key: string]: string } = {
    // Valores corretos do enum do backend (mantém como está)
    applications: "applications",
    curation: "curation",
    invited: "invited",
    approved: "approved",
    pending_approval: "pending_approval",
    in_correction: "in_correction",
    content_approved: "content_approved",
    published: "published",
    rejected: "rejected",
    // Valores antigos do frontend (mapeia para valores corretos)
    inscriptions: "applications",
    approved_progress: "approved",
    awaiting_approval: "pending_approval",
    selected: "applications",
    active: "approved",
    // Status em português (converte para inglês usando valores do enum)
    inscricoes: "applications",
    aprovado: "approved",
    curadoria: "curation",
    recusado: "rejected",
    convidados: "invited",
    aprovados: "approved",
    rejeitados: "rejected",
    conteudo_submetido: "pending_approval",
    conteudo_aprovado: "content_approved",
    conteudo_rejeitado: "in_correction",
  };

  return statusMap[status.toLowerCase()] || status;
}

/**
 * Lista influenciadores de uma campanha
 */
export async function getCampaignInfluencers(
  campaignId: string
): Promise<Influencer[]> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/influencers`),
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
      errorData = { message: "Failed to get campaign influencers" };
    }
    throw errorData || "Failed to get campaign influencers";
  }

  const response = await request.json();
  // Normalizar status de todos os influenciadores para inglês
  return response.data.map((influencer: Influencer) => ({
    ...influencer,
    status: normalizeStatus(influencer.status),
  }));
}

/**
 * Atualiza status de um influenciador na campanha
 */
export async function updateInfluencerStatus(
  campaignId: string,
  data: InfluencerStatusUpdate
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/users/${data.influencer_id}/status`),
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: JSON.stringify({
        status: data.status,
        feedback: data.feedback,
        network_id: data.network_id,
      }),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to update influencer status" };
    }
    throw errorData || "Failed to update influencer status";
  }
}

/**
 * Busca os perfis (contas sociais) de um influenciador
 */
export async function getInfluencerProfiles(
  influencerId: string
): Promise<InfluencerProfile[]> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/influencers/${influencerId}/profiles`),
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
      errorData = { message: "Failed to get influencer profiles" };
    }
    throw errorData || "Failed to get influencer profiles";
  }

  const response = await request.json();
  const profiles = response.data?.profiles;

  if (!profiles) {
    return [];
  }

  if (!Array.isArray(profiles)) {
    return [];
  }

  return profiles.map((item) => normalizeInfluencerProfile(item));
}

function extractProfilesFromCampaignInfluencerResponse(response: {
  data?: unknown;
}): unknown[] {
  const d = response.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === "object") {
    const o = d as Record<string, unknown>;
    if (Array.isArray(o.profiles)) return o.profiles;
    if (Array.isArray(o.invitable_profiles)) return o.invitable_profiles;
    if (Array.isArray(o.invite_profiles)) return o.invite_profiles;
  }
  return [];
}

/**
 * Perfis do influenciador que podem ser convidados nesta campanha (regras da campanha / vínculos).
 * GET /campaigns/:campaignId/influencers/:influencerId/invite-profiles
 */
export async function getCampaignInfluencerInvitableProfiles(
  campaignId: string,
  influencerId: string
): Promise<InfluencerProfile[]> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(
      `/campaigns/${campaignId}/influencers/${influencerId}/invite-profiles`
    ),
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

  if (request.status === 404) {
    const all = await getInfluencerProfiles(influencerId);
    const anyInviteFlag = all.some((p) => p.can_invite !== undefined);
    return anyInviteFlag ? all.filter((p) => p.can_invite !== false) : all;
  }

  if (!request.ok) {
    const error = await request.json().catch(() => ({}));
    throw error || "Failed to get invitable influencer profiles";
  }

  const response = await request.json();
  const raw = extractProfilesFromCampaignInfluencerResponse(response);
  const mapped = raw.map((item) => normalizeInfluencerProfile(item));
  return mapped.filter((profile) => profile.can_invite !== false);
}

/**
 * Convida um influenciador para a campanha
 */
export async function inviteInfluencer(
  campaignId: string,
  data: InfluencerInviteData
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  // Usa a rota do recurso `users` (campaign-users.controller): é o endpoint
  // canônico que suporta `network_prices` (negociação individual_price POR REDE)
  // além do escalar, e dispara a notificação real ao criador — simétrico ao
  // `addToPreSelection` (/users/pre-selection). A rota legada
  // `/influencers/invite` (campaigns.controller) é escalar-only e ignorava
  // `network_prices` → convidar lista em campanha individual_price falhava com
  // "informe proposed_price_cents".
  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/users/invite`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: JSON.stringify(data),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to invite influencer" };
    }
    throw errorData || "Failed to invite influencer";
  }
}

/**
 * Move um influenciador para pré-seleção (POST backoffice/campaigns/:campaignId/users/pre-selection).
 * Body igual ao convite: InviteInfluencerDto (influencer_id obrigatório; network_id/social_network_id/profile_ids e message opcionais).
 */
export async function addToPreSelection(
  campaignId: string,
  data: InfluencerInviteData
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/users/pre-selection`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: JSON.stringify(data),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to add influencer to pre-selection" };
    }
    throw errorData || "Failed to add influencer to pre-selection";
  }
}

/** Body para mover da pré-seleção para curadoria da pré-seleção (MoveToCurationDto) */
export interface MoveToPreSelectionCurationData {
  network_id?: number;
  notes?: string;
}

/**
 * Move um influenciador da pré-seleção para curadoria da pré-seleção.
 * POST .../campaigns/:campaignId/users/:influencerId/pre-selection-curation
 */
export async function moveToPreSelectionCuration(
  campaignId: string,
  influencerId: string,
  data: MoveToPreSelectionCurationData = {}
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/users/${influencerId}/pre-selection-curation`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: JSON.stringify(data),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to move to pre-selection curation" };
    }
    throw errorData || "Failed to move to pre-selection curation";
  }
}

/** Resposta do backoffice a uma contraproposta de "valor individual por criador". */
export interface CampaignPriceResponseData {
  action: "accept" | "counter" | "reject";
  /** Obrigatório quando action = "counter" (centavos BRL). */
  proposed_price_cents?: number;
  message?: string;
  /**
   * Rede-alvo (individual_price POR REDE). Quando presente, a resposta afeta só
   * essa rede; ausente = negociação única (legada/escalar).
   */
  social_network_id?: number;
}

/**
 * Responde a uma contraproposta de preço do criador.
 * POST .../campaigns/:campaignId/users/:userId/price-response
 * `userId` é o `users.id` do influenciador.
 */
export async function respondToPriceCounter(
  campaignId: string,
  userId: string,
  data: CampaignPriceResponseData,
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/users/${userId}/price-response`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: JSON.stringify(data),
    },
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to respond to price counter" };
    }
    throw errorData || "Failed to respond to price counter";
  }
}

/**
 * Busca o histórico de mudanças de status do influenciador
 */
export async function getInfluencerHistory(
  campaignId: string,
  influencerId: string
): Promise<
  Array<{
    id: string;
    status: string;
    timestamp: string;
    notes?: string;
  }>
> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(
      `/campaigns/${campaignId}/influencers/${influencerId}/history`
    ),
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
      errorData = { message: "Failed to get influencer history" };
    }
    throw errorData || "Failed to get influencer history";
  }

  const response = await request.json();
  return response.data;
}

/**
 * Aprova múltiplos influenciadores em massa
 */
export async function bulkApproveInfluencers(
  campaignId: string,
  influencerIds: string[],
  feedback?: string,
  network_id?: number | string
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/users/bulk/approve`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: JSON.stringify({
        influencer_ids: influencerIds,
        feedback,
        network_id,
      }),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to bulk approve influencers" };
    }
    throw errorData || "Failed to bulk approve influencers";
  }
}

/**
 * Reprova múltiplos influenciadores em massa
 */
export async function bulkRejectInfluencers(
  campaignId: string,
  influencerIds: string[],
  feedback: string,
  network_id?: number | string
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/users/bulk/reject`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: JSON.stringify({
        influencer_ids: influencerIds,
        feedback,
        network_id,
      }),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to bulk reject influencers" };
    }
    throw errorData || "Failed to bulk reject influencers";
  }
}


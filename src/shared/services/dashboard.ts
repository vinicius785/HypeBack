import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import type { CampaignPhase, Influencer, CampaignContent } from "../types";
import { formatReais } from "@/shared/utils/masks";

/**
 * Tipos retornados pela API do dashboard
 */
export interface DashboardPhase {
  id: string;
  /** Alguns endpoints enviam só `public_id` */
  public_id?: string;
  order: number;
  objective: string;
  publish_date: string;
  /** Pode vir ausente na API; o front usa 18:00 como padrão */
  publish_time?: string | null;
  content_submission_deadline?: string | null;
  correction_submission_deadline?: string | null;
  requires_product_receipt?: boolean;
  hashtag?: string | null;
  contents?: Array<{
    type: string;
    options: Array<{
      type: string;
      quantity: number;
      /** Valor unitário do formato em centavos. Ausente em campanhas legadas/swap. */
      price?: number | null;
    }>;
  }>;
  created_at: string;
  updated_at: string;
}

export interface DashboardInfluencer {
  /**
   * `campaign_users.id` — relação influencer ↔ campanha.
   * É o `campaign_user_id` exigido pelo backend de contratos.
   * Distinto de `user_id` (id interno do usuário).
   */
  id: string;
  /** `users.id` — id interno do usuário. Em geral não é o que o backend espera nos endpoints da campanha. */
  user_id?: string;
  name: string;
  username: string;
  avatar: string | null;
  followers: number;
  engagement: number;
  niche: string | undefined;
  social_network: string | undefined;
  social_networks?: Array<{
    id: number | string;
    type: string;
    name: string;
    username?: string;
    members?: number;
    status?: string;
  }>;
  status: string;
  phase: string | undefined;
}

export interface DashboardContent {
  id: string;
  campaign_id: string;
  influencer_id: string;
  influencer_name: string;
  influencer_avatar: string | null;
  social_network: string | null;
  content_type: string;
  preview_url: string | null;
  post_url: string | null;
  status: string;
  phase_id: string | null;
  submitted_at: string;
  published_at: string | null;
  feedback: string | null;
  ai_evaluation: any | null;
}

export interface DashboardMetrics {
  reach: number;
  engagement: number;
  published_content: number;
  active_influencers: number;
  /**
   * Progresso da campanha em % (0–100), calculado pelo backend.
   * Substitui o cálculo local antigo (published / total contents).
   */
  progress: number;
}

export interface DashboardResponse {
  phases: DashboardPhase[];
  influencers: DashboardInfluencer[];
  contents: DashboardContent[];
  metrics: DashboardMetrics;
}

export interface PublicationTrackingCheckResult {
  checked: number;
  published: number;
  notPublished: number;
  errors: Array<{
    message?: string;
    influencerId?: string;
    platform?: string;
  }>;
}

/**
 * Busca todos os dados da campanha em uma única chamada
 */
export async function getCampaignDashboard(
  campaignId: string
): Promise<DashboardResponse> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/dashboard`),
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
      errorData = { message: "Failed to get campaign dashboard" };
    }

    const error = new Error(
      errorData?.message || "Failed to get campaign dashboard"
    ) as any;
    error.status = request.status;
    throw error;
  }

  const response = await request.json();
  return response.data;
}

/**
 * Dispara varredura de publicacoes para validar posts publicados.
 */
export async function checkCampaignPublicationTracking(
  campaignId: string,
  params?: { phase_id?: number; date?: string }
): Promise<PublicationTrackingCheckResult> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const queryParams = new URLSearchParams();
  if (typeof params?.phase_id === "number") {
    queryParams.append("phase_id", String(params.phase_id));
  }
  if (params?.date) {
    queryParams.append("date", params.date);
  }

  const url = `/campaigns/${campaignId}/publication-tracking/check${
    queryParams.toString() ? `?${queryParams.toString()}` : ""
  }`;

  const request = await fetch(getApiUrl(url), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
      "Workspace-Id": workspaceId,
    },
    body: JSON.stringify({}),
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Falha ao verificar publicações" };
    }
    throw errorData || "Falha ao verificar publicações";
  }

  const response = await request.json();
  return response.data;
}

/** API: `HH:MM` ou `HH:MM:SS` → `HH:MM` (ex.: 18:00:00 → 18:00) */
function normalizePublishTimeToClock(raw: string): string {
  const s = raw.trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (!m) return s;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/**
 * Transforma DashboardPhase para CampaignPhase (formato usado no frontend)
 */
export function transformDashboardPhase(phase: DashboardPhase): CampaignPhase {
  const publishTimeRaw =
    phase.publish_time != null ? String(phase.publish_time).trim() : "";
  const postTime =
    publishTimeRaw !== ""
      ? normalizePublishTimeToClock(publishTimeRaw)
      : "18:00";
  const hashtag =
    phase.hashtag != null && String(phase.hashtag).trim() !== ""
      ? String(phase.hashtag).trim()
      : undefined;

  const phaseId = phase.id || phase.public_id || "";
  return {
    id: phaseId,
    order: phase.order,
    createdAt: phase.created_at,
    objective: phase.objective,
    postDate: phase.publish_date ?? "",
    postTime,
    contentSubmissionDeadline:
      phase.content_submission_deadline?.trim() || undefined,
    correctionSubmissionDeadline:
      phase.correction_submission_deadline?.trim() || undefined,
    requiresProductReceipt: phase.requires_product_receipt === true,
    hashtag,
    formats: (phase.contents ?? []).flatMap((content) =>
      (content.options ?? []).map((option, idx) => ({
        id: `${content.type}-${option.type}-${option.quantity}-${idx}`,
        socialNetwork: content.type,
        contentType: option.type,
        quantity: String(option.quantity ?? 1),
        ...(option.price != null ? { price: formatReais(option.price / 100) } : {}),
      }))
    ),
    files: "", // Não vem na API do dashboard
  };
}

/**
 * Fases em GET /campaigns/:id costumam ter o mesmo shape que em GET .../dashboard.
 * Use no front para não depender do dashboard só por fases (influenciadores/conteúdos/métricas continuam no /dashboard até a API unificar).
 */
export function mapApiPhasesToCampaignPhases(
  phases: DashboardPhase[] | undefined | null
): CampaignPhase[] {
  if (!phases?.length) return [];
  return phases.map(transformDashboardPhase);
}

/** Lista vinda do GET campanha sem fases → usar fallback (ex.: dashboard). */
export function campaignPhasesListIsPresent(
  phases: DashboardPhase[] | undefined | null
): boolean {
  return Array.isArray(phases) && phases.length > 0;
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
 * Transforma DashboardInfluencer para Influencer (formato usado no frontend)
 */
export function transformDashboardInfluencer(
  influencer: DashboardInfluencer
): Influencer {
  // Garantir que o status seja preservado em cada perfil e normalizado
  const social_networks: Influencer["social_networks"] = influencer.social_networks?.map((network) => ({
    id: network.id,
    type: network.type,
    name: network.name,
    username: network.username,
    members: network.members,
    status: network.status ? (normalizeStatus(network.status) as "applications" | "curation" | "invited" | "contract_pending" | "approved" | "script_pending" | "content_pending" | "pending_approval" | "in_correction" | "content_approved" | "payment_pending" | "published" | "rejected" | undefined) : undefined,
  }));
  
  return {
    // `dashboard.id` é o `campaign_users.id` (= campaign_user_id no backend).
    id: influencer.id,
    campaign_user_id: influencer.id,
    user_id: influencer.user_id,
    name: influencer.name,
    username: influencer.username,
    avatar: influencer.avatar || "",
    followers: influencer.followers,
    engagement: influencer.engagement,
    niche: influencer.niche || "",
    status: normalizeStatus(influencer.status) as Influencer["status"],
    phase: influencer.phase,
    social_networks,
  };
}

/**
 * Transforma DashboardContent para CampaignContent (formato usado no frontend)
 */
export function transformDashboardContent(
  content: DashboardContent
): CampaignContent {
  return {
    id: content.id,
    phase_id: content.phase_id,
    influencerId: content.influencer_id,
    influencerName: content.influencer_name,
    influencerAvatar: content.influencer_avatar || "",
    socialNetwork: content.social_network || "",
    contentType: content.content_type,
    previewUrl: content.preview_url || "",
    postUrl: content.post_url || "",
    status: content.status as CampaignContent["status"],
    submittedAt: content.submitted_at,
    publishedAt: content.published_at || undefined,
    feedback: content.feedback || undefined,
  };
}

import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/http-client";
import type { CampaignPhaseUpsertPayload, CreatePhaseData } from "./phase";
import type { DashboardPhase } from "./dashboard";
import type { Campaign } from "../types";

export interface CampaignListItem {
  id: string;
  title: string;
  description: string;
  status: string;
  max_influencers: number;
  banner?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignDetail extends Campaign {
  id: string;
  public_id?: string;
  workspace_id?: string;
  /** Quando presente no GET /campaigns/:id, substitui a necessidade de fases vindas só do /dashboard */
  phases?: DashboardPhase[];
  /** Nichos raízes (parent_id: null) retornados pela API. */
  niches?: Array<{ id: number; name: string; parent_id: null }>;
  secondary_niches?: Array<{ id: number; name: string; parent_id?: number | null }>;
  payment_method_details?: {
    amount?: number;
    currency?: string;
    description?: string;
  };
  segment_min_followers?: number;
  segment_state?: string[];
  segment_city?: string[];
  segment_genders?: string[];
  image_rights_period?: number;
  rules_does?: string;
  rules_does_not?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignData {
  title: string;
  description: string;
  objective: string;
  secondary_niches: number[];
  max_influencers: number;
  payment_method: string;
  payment_method_details: {
    amount?: number;
    currency?: string;
    description?: string;
  };
  benefits?: string[]; // Array de itens
  rules_does: string[]; // Array de itens
  rules_does_not: string[]; // Array de itens
  segment_min_followers?: number;
  segment_state?: string[];
  segment_city?: string[];
  segment_genders?: string[];
  /** Obrigatório na API; inteiro ≥ 0 */
  image_rights_period: number;
  /**
   * Fases criadas na mesma transação da campanha (POST /backoffice/campaigns).
   * Omitir ou `[]` cria só a campanha; fases podem ser criadas depois via POST /campaigns/:id/phases.
   */
  phases?: CreatePhaseData[];
  banner?: string | null;
  // banner por upload: use uploadCampaignBanner após o create
}

/**
 * PUT `/campaigns/:id` — ver `api-backoffice-update-campaign.md`.
 * Campos opcionais omitidos preservam valor no servidor; `phases` omitido não altera fases.
 */
export interface UpdateCampaignData extends Partial<Omit<CreateCampaignData, "phases">> {
  phases?: CampaignPhaseUpsertPayload[];
  status?: string;
}

/**
 * Lista todas as campanhas do workspace
 */
export async function getCampaigns(): Promise<CampaignListItem[]> {
  return apiGet<CampaignListItem[]>("/campaigns");
}

/**
 * Busca uma campanha específica por ID
 */
export async function getCampaign(campaignId: string): Promise<CampaignDetail> {
  return apiGet<CampaignDetail>(`/campaigns/${campaignId}`);
}

/**
 * Resposta 201: ou `{ data: campaign }` ou `{ data: { campaign, phases } }` quando `phases` veio no body.
 */
function parseCreateCampaignResponseBody(data: unknown): CampaignDetail {
  if (
    data &&
    typeof data === "object" &&
    "campaign" in data &&
    (data as { campaign: unknown }).campaign &&
    typeof (data as { campaign: unknown }).campaign === "object"
  ) {
    return (data as { campaign: CampaignDetail }).campaign;
  }
  return data as CampaignDetail;
}

/**
 * Cria uma nova campanha (draft). Opcionalmente envia `phases` no mesmo POST (uma transação no servidor).
 */
export async function createCampaign(
  data: CreateCampaignData
): Promise<CampaignDetail> {
  const raw = await apiPost<unknown>("/campaigns", data);
  return parseCreateCampaignResponseBody(raw);
}

/**
 * Faz upload do banner da campanha (usa FormData — não passa pelo apiPost genérico).
 */
export async function uploadCampaignBanner(
  campaignId: string,
  banner: File
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) throw new Error("Workspace ID é obrigatório");

  const formData = new FormData();
  formData.append("banner", banner);

  const request = await fetch(getApiUrl(`/campaigns/${campaignId}/banner`), {
    method: "POST",
    headers: {
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken() ?? ""}`,
      "Workspace-Id": workspaceId,
    },
    body: formData,
  });

  if (!request.ok) {
    let message = "Failed to upload campaign banner";
    try {
      const body = await request.json();
      if (typeof body?.message === "string") message = body.message;
    } catch { /* ignore */ }
    const error = Object.assign(new Error(message), { status: request.status });
    throw error;
  }
}

/**
 * Atualiza uma campanha existente
 */
export async function updateCampaign(
  campaignId: string,
  data: UpdateCampaignData
): Promise<void> {
  await apiPut(`/campaigns/${campaignId}`, data);
}

/**
 * Exclui uma campanha
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  await apiDelete(`/campaigns/${campaignId}`);
}


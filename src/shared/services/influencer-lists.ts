import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";

export interface InfluencerList {
  id: string;
  name: string;
  created_at: string;
  influencer_count: number;
}

export interface InfluencerListDetail {
  id: string;
  name: string;
  influencers: Array<{
    id: number;
    name: string;
    email: string;
    photo: string | null;
  }>;
  created_at: string;
}

export interface BulkAddInfluencersRequest {
  influencer_ids?: string[];
  list_id?: string;
}

/** Um perfil (influenciador × rede) convidável, resolvido pelo preview de import. */
export interface ImportPreviewProfile {
  user_id: number;
  name: string | null;
  photo: string | null;
  social_network_id: number;
  network_type: string;
  username: string | null;
}

export interface ImportPreviewResult {
  payment_method: string;
  allowed_networks: string[];
  profiles: ImportPreviewProfile[];
  discarded: { user_id: number; name: string | null; reason: string }[];
  summary: { members: number; profiles: number; discarded: number };
}

/**
 * Preview de import: expande a lista em perfis convidáveis (1 por rede da
 * campanha), descartando perfis/redes que não fazem parte da campanha.
 */
export async function getCampaignImportPreview(
  campaignId: string,
  data: BulkAddInfluencersRequest
): Promise<ImportPreviewResult> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/users/import/preview`),
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
      errorData = { message: "Failed to get import preview" };
    }
    throw errorData || "Failed to get import preview";
  }

  const response = await request.json();
  return response.data;
}

/**
 * Lista todas as listas de influenciadores do workspace
 */
export async function getInfluencerLists(): Promise<InfluencerList[]> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(getApiUrl("/influencer-lists"), {
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
      errorData = { message: "Failed to get influencer lists" };
    }
    throw errorData || "Failed to get influencer lists";
    }

  const response = await request.json();
  return response.data;
}

/**
 * Obtém detalhes de uma lista específica
 */
export async function getInfluencerList(
  listId: string
): Promise<InfluencerListDetail> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(getApiUrl(`/influencer-lists/${listId}`), {
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
      errorData = { message: "Failed to get influencer list" };
    }
    throw errorData || "Failed to get influencer list";
    }

  const response = await request.json();
  return response.data;
}

/**
 * Adiciona múltiplos influenciadores à campanha (por IDs ou lista)
 */
export async function bulkAddInfluencersToCampaign(
  campaignId: string,
  data: BulkAddInfluencersRequest
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/users/bulk/add`),
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
      errorData = { message: "Failed to bulk add influencers" };
    }
    throw errorData || "Failed to bulk add influencers";
    }
}


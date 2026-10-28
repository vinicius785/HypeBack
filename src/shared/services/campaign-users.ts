import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";

export interface CampaignUser {
  id: number | string; // campaignUserId (ID da tabela campaign_users) - usar este para WebSocket
  user_id?: number | string; // userId/influencerId (user_id do usuário) - NÃO usar como campaignUserId
  name: string;
  username: string;
  avatar: string;
  followers: number;
  engagement: number;
  niche?: string;
  status: string;
  social_networks?: Array<{
    id: number | string;
    type: string;
    name: string;
    username?: string;
    members?: number;
  }>;
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
 * Lista usuários inscritos na campanha
 */
export async function getCampaignUsers(
  campaignId: string
): Promise<CampaignUser[]> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/users`),
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
      errorData = { message: "Failed to get campaign users" };
    }
    throw errorData || "Failed to get campaign users";
    }

  const response = await request.json();

  // Normalizar status de todos os usuários para inglês
  return response.data.map((user: CampaignUser) => ({
    ...user,
    status: normalizeStatus(user.status),
  }));
}

export interface UpdateUserStatusData {
  action: "approved" | "curation" | "rejected" | "applications";
}

/**
 * Atualiza o status de um usuário na campanha
 */
export async function updateCampaignUserStatus(
  campaignId: string,
  userId: string,
  data: UpdateUserStatusData
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/users/${userId}`),
    {
      method: "PUT",
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
      errorData = { message: "Failed to update campaign user status" };
    }
    throw errorData || "Failed to update campaign user status";
    }
}


import {
  getApiUrl,
  getAuthToken,
  getWorkspaceId,
} from "@/lib/utils/api";

export interface CampaignCommunityGroup {
  id: string;
  name: string;
  description: string;
  cover_url?: string | null;
  members_count: number;
  auto_join_on_approval: boolean;
  remove_on_campaign_exit: boolean;
  share_url: string;
}

export interface CampaignGroupParticipant {
  campaign_user_id: number;
  user_id: number;
  name: string;
  email: string;
  campaign_status: string;
  is_member: boolean;
  sync_status?: "joined" | "failed" | "removed" | null;
  sync_attempts?: number | null;
  sync_error?: string | null;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

interface ApiPage<T> {
  data: T[];
  meta: PaginationMeta;
}

function headers(json = false): Record<string, string> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) throw new Error("Workspace ID é obrigatório");
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    "Client-Type": "backoffice",
    Authorization: `Bearer ${getAuthToken() ?? ""}`,
    "Workspace-Id": workspaceId,
  };
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    let message = fallback;
    try {
      const body = await response.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // Mantém a mensagem segura; o corpo pode não ser JSON.
    }
    throw Object.assign(new Error(message), { status: response.status });
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const base = (campaignId: string) =>
  `/campaigns/${encodeURIComponent(campaignId)}/community-groups`;

export async function listCampaignGroups(
  campaignId: string,
): Promise<CampaignCommunityGroup[]> {
  const response = await fetch(getApiUrl(base(campaignId)), {
    headers: headers(),
  });
  const body = await parse<{ data: CampaignCommunityGroup[] }>(
    response,
    "Falha ao carregar grupos da campanha",
  );
  return body.data;
}

export async function createCampaignGroup(
  campaignId: string,
  payload: {
    name: string;
    description: string;
    auto_join_on_approval: boolean;
    remove_on_campaign_exit: boolean;
  },
): Promise<CampaignCommunityGroup> {
  const response = await fetch(getApiUrl(base(campaignId)), {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify(payload),
  });
  const body = await parse<{ data: CampaignCommunityGroup }>(
    response,
    "Falha ao criar grupo",
  );
  return body.data;
}

export async function updateCampaignGroupLink(
  campaignId: string,
  groupId: string,
  payload: {
    auto_join_on_approval: boolean;
    remove_on_campaign_exit: boolean;
  },
): Promise<void> {
  const response = await fetch(
    getApiUrl(`${base(campaignId)}/${encodeURIComponent(groupId)}`),
    {
      method: "PUT",
      headers: headers(true),
      body: JSON.stringify(payload),
    },
  );
  await parse(response, "Falha ao salvar configuração do grupo");
}

/**
 * Envia/atualiza a capa (cover) de um grupo da campanha (#25). Multipart —
 * não define Content-Type manualmente (o browser adiciona o boundary).
 */
export async function uploadCampaignGroupCover(
  campaignId: string,
  groupId: string,
  file: File,
): Promise<{ cover_url: string }> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) throw new Error("Workspace ID é obrigatório");

  const form = new FormData();
  form.append("file", file);

  const response = await fetch(
    getApiUrl(`${base(campaignId)}/${encodeURIComponent(groupId)}/cover`),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken() ?? ""}`,
        "Workspace-Id": workspaceId,
      },
      body: form,
    },
  );
  const body = await parse<{ data: { cover_url: string } }>(
    response,
    "Falha ao enviar a capa do grupo",
  );
  return body.data;
}

export async function listCampaignGroupParticipants(
  campaignId: string,
  groupId: string,
  params: { page: number; per_page: number; search?: string; status?: string },
): Promise<ApiPage<CampaignGroupParticipant>> {
  const query = new URLSearchParams({
    page: String(params.page),
    per_page: String(params.per_page),
  });
  if (params.search) query.set("search", params.search);
  if (params.status && params.status !== "all") {
    query.set("status", params.status);
  }
  const response = await fetch(
    getApiUrl(
      `${base(campaignId)}/${encodeURIComponent(groupId)}/participants?${query}`,
    ),
    { headers: headers() },
  );
  return parse<ApiPage<CampaignGroupParticipant>>(
    response,
    "Falha ao carregar participantes",
  );
}

export async function bulkAddCampaignGroupMembers(
  campaignId: string,
  groupId: string,
  campaignUserIds: number[],
): Promise<{
  data: Array<{
    campaign_user_id: number;
    status: "joined" | "already_member" | "failed";
    error?: string;
  }>;
  meta: {
    requested: number;
    joined: number;
    already_member: number;
    failed: number;
  };
}> {
  const response = await fetch(
    getApiUrl(`${base(campaignId)}/${encodeURIComponent(groupId)}/members/bulk`),
    {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ campaign_user_ids: campaignUserIds }),
    },
  );
  return parse(response, "Falha ao adicionar participantes ao grupo");
}

export interface CampaignGroupPost {
  id: string;
  content: string;
  origin: string;
  created_at: string;
  author_name: string;
}

/** Publicações já enviadas ao grupo (mais recentes primeiro). */
export async function listCampaignGroupPosts(
  campaignId: string,
  groupId: string,
  params: { page: number; per_page: number },
): Promise<ApiPage<CampaignGroupPost>> {
  const query = new URLSearchParams({
    page: String(params.page),
    per_page: String(params.per_page),
  });
  const response = await fetch(
    getApiUrl(
      `${base(campaignId)}/${encodeURIComponent(groupId)}/posts?${query}`,
    ),
    { headers: headers() },
  );
  return parse<ApiPage<CampaignGroupPost>>(
    response,
    "Falha ao carregar publicações do grupo",
  );
}

export async function createCampaignGroupPost(
  campaignId: string,
  groupId: string,
  content: string,
): Promise<void> {
  const clientRequestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
          const random = Math.floor(Math.random() * 16);
          const value = token === "x" ? random : (random & 0x3) | 0x8;
          return value.toString(16);
        });
  const response = await fetch(
    getApiUrl(`${base(campaignId)}/${encodeURIComponent(groupId)}/posts`),
    {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({
        content,
        client_request_id: clientRequestId,
      }),
    },
  );
  await parse(response, "Falha ao publicar no grupo");
}

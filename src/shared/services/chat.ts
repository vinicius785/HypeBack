import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import type { ChatMessage } from "../types";
import { getCampaignUsers } from "./campaign-users";

/** Limite de requisições (HTTP 429): `retryAfterMs` vem do cabeçalho Retry-After (segundos ou data) quando a API o envia. */
export class RateLimitError extends Error {
  readonly status = 429;
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super("Muitas requisições. Aguarde um instante e tente de novo.");
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

const DEFAULT_RETRY_AFTER_MS = 30_000;
const MAX_RETRY_AFTER_MS = 5 * 60_000;

/** Lê o Retry-After (segundos ou data HTTP) em milissegundos, com piso e teto. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number {
  if (!value) return DEFAULT_RETRY_AFTER_MS;
  const secs = Number(value);
  const ms = Number.isFinite(secs) ? secs * 1000 : new Date(value).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_RETRY_AFTER_MS;
  return Math.min(Math.max(ms, 1000), MAX_RETRY_AFTER_MS);
}

export interface SendMessageData {
  message: string;
  attachments?: string[];
}

export async function uploadChatAttachment(
  campaignId: string,
  influencerId: string,
  file: File,
): Promise<{ url: string; name: string; mime_type: string; size: number }> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const body = new FormData();
  body.append("file", file);
  const request = await fetch(
    getApiUrl(
      `/campaigns/${campaignId}/influencers/${influencerId}/messages/attachments`,
    ),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body,
    },
  );
  if (!request.ok) {
    let message = "Não foi possível enviar o anexo";
    try {
      const error = await request.json();
      if (typeof error?.message === "string") message = error.message;
    } catch {
      // Mantém mensagem segura.
    }
    throw new Error(message);
  }
  const response = await request.json();
  return response.data;
}

/**
 * Obtém o campaignUserId a partir do influencerId (user_id)
 */
export async function getCampaignUserId(
  campaignId: string,
  influencerId: number | string
): Promise<number | null> {
  try {
    const users = await getCampaignUsers(campaignId);
    const influencerIdNum = typeof influencerId === "string" ? parseInt(influencerId, 10) : influencerId;
    
    // Encontrar o usuário pelo user_id
    const user = users.find((u) => {
      const userId = typeof u.user_id === "string" ? parseInt(u.user_id, 10) : u.user_id;
      return userId === influencerIdNum;
    });
    
    if (user) {
      // O id do CampaignUser é o campaignUserId
      const campaignUserId = typeof user.id === "string" ? parseInt(user.id, 10) : user.id;
      return campaignUserId;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Lista todas as mensagens do chat com o influenciador
 */
const inFlight = new Map<string, Promise<ChatMessage[]>>();

/**
 * Lista as mensagens do chat com o influenciador. Não repete a chamada enquanto uma igual está em andamento (quem pedir
 * junto recebe a mesma resposta) e, em 429, falha com `RateLimitError` para quem chamou esperar antes de tentar de novo.
 */
export function getInfluencerMessages(campaignId: string, influencerId: string): Promise<ChatMessage[]> {
  const key = `${getWorkspaceId()}:${campaignId}:${influencerId}`;
  const running = inFlight.get(key);
  if (running) return running;
  const p = fetchInfluencerMessages(campaignId, influencerId).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function fetchInfluencerMessages(
  campaignId: string,
  influencerId: string
): Promise<ChatMessage[]> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(
      `/campaigns/${campaignId}/influencers/${influencerId}/messages`
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

  if (request.status === 429) {
    throw new RateLimitError(parseRetryAfter(request.headers.get("Retry-After")));
  }

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to get influencer messages" };
    }
    throw errorData || "Failed to get influencer messages";
    }

  const response = await request.json();
  // Normalizar mensagens para o formato esperado
  return response.data.map((msg: any) => ({
    id: msg.id,
    campaign_id: msg.campaign_id,
    influencer_id: msg.influencer_id,
    sender_id: msg.sender_id,
    sender_name: msg.sender_name,
    sender_avatar: msg.sender_avatar || null,
    message: msg.message,
    attachments: msg.attachments || [],
    read_at: msg.read_at || null,
    created_at: msg.created_at,
  }));
}

/**
 * Envia uma mensagem para o influenciador
 */
export async function sendMessage(
  campaignId: string,
  influencerId: string,
  data: SendMessageData
): Promise<ChatMessage> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(
      `/campaigns/${campaignId}/influencers/${influencerId}/messages`
    ),
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
      errorData = { message: "Failed to send message" };
    }
    throw errorData || "Failed to send message";
    }

  const response = await request.json();
  return response.data;
}

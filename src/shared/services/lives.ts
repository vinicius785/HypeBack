/**
 * Camada de API das Lives da Comunidade — workspace-scoped.
 *
 * Base: `/community/lives` (resolve para `/api/backoffice/community/lives` via
 * `VITE_SERVER_URL`). Streaming é WebRTC/LiveKit: o backend só fornece as
 * credenciais (`/start`, `/broadcaster-token`); a mídia é publicada no navegador
 * com `livekit-client`.
 *
 * Contrato: hypeapp-api/docs/backoffice-community-lives.md
 */
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/http-client";
import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import type {
  BroadcasterCredentials,
  CreateLivePayload,
  Live,
  LivePage,
  LiveStatusFilter,
  StartLiveResponse,
  UpdateLivePayload,
} from "@/shared/types";

const BASE = "/community/lives";

// ---------------------------------------------------------------------------
// Validação de thumbnail (client-side) — limite 5MB, jpeg/png/webp.
// ---------------------------------------------------------------------------

export const LIVE_THUMBNAIL_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  acceptedMimes: ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const,
} as const;

export function validateLiveThumbnailFile(file: File): string | null {
  if (file.size > LIVE_THUMBNAIL_LIMITS.maxBytes) {
    return `A imagem "${file.name}" excede o limite de 5 MB.`;
  }
  if (
    !(LIVE_THUMBNAIL_LIMITS.acceptedMimes as readonly string[]).includes(
      file.type,
    )
  ) {
    return `Formato inválido (${file.type || "desconhecido"}). Use JPEG, PNG ou WebP.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Listagem (cursor) — preserva `meta`, que o apiGet genérico descartaria.
// ---------------------------------------------------------------------------

export interface ListLivesParams {
  status?: LiveStatusFilter;
  limit?: number;
  cursor?: string | null;
}

export async function listLives(params: ListLivesParams = {}): Promise<LivePage> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório. Selecione um workspace.");
  }

  const qs = new URLSearchParams();
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  const res = await fetch(getApiUrl(`${BASE}${suffix}`), {
    headers: {
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken() ?? ""}`,
      "Workspace-Id": workspaceId,
    },
  });

  if (!res.ok) {
    let message = `Falha ao listar lives (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error(message), { status: res.status });
  }

  const json = await res.json();
  return {
    items: (json.data ?? []) as Live[],
    meta: json.meta ?? { next_cursor: null, has_more: false },
  };
}

// ---------------------------------------------------------------------------
// Detalhe / criação / edição
// ---------------------------------------------------------------------------

export async function getLive(id: string): Promise<Live> {
  return apiGet<Live>(`${BASE}/${id}`);
}

export async function createLive(payload: CreateLivePayload): Promise<Live> {
  return apiPost<Live>(BASE, payload);
}

export async function updateLive(
  id: string,
  payload: UpdateLivePayload,
): Promise<Live> {
  return apiPatch<Live>(`${BASE}/${id}`, payload);
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

/** `upcoming → live`. Cria a sala, inicia gravação e devolve credenciais de publish. */
export async function startLive(id: string): Promise<StartLiveResponse> {
  return apiPost<StartLiveResponse>(`${BASE}/${id}/start`);
}

/** Re-minta o publish token (reconexão / token expirado). Só com `status = live`. */
export async function refreshBroadcasterToken(
  id: string,
): Promise<BroadcasterCredentials> {
  return apiPost<BroadcasterCredentials>(`${BASE}/${id}/broadcaster-token`);
}

/** `live → ended`. Finaliza sala + gravação. */
export async function endLive(id: string): Promise<Live> {
  return apiPost<Live>(`${BASE}/${id}/end`);
}

/** Credenciais RTMP p/ transmitir de um encoder externo (OBS/vMix) — #41. */
export interface LiveIngressCredentials {
  rtmp_url: string;
  stream_key: string;
  ingress_id: string;
}

/** Recupera o destino RTMP já criado; `null` quando ainda não foi configurado. */
export async function getLiveIngress(
  id: string,
): Promise<LiveIngressCredentials | null> {
  return apiGet<LiveIngressCredentials | null>(`${BASE}/${id}/ingress`);
}

/** Gera (ou reusa) o destino RTMP antes ou durante a live. */
export async function createLiveIngress(
  id: string,
): Promise<LiveIngressCredentials> {
  return apiPost<LiveIngressCredentials>(`${BASE}/${id}/ingress`);
}

/** `upcoming → cancelled` (soft-delete; some do app). */
export async function cancelLive(id: string): Promise<Live> {
  return apiPost<Live>(`${BASE}/${id}/cancel`);
}

/** Remove do histórico por soft delete; a API preserva auditoria e rollback. */
export async function removeLive(id: string): Promise<void> {
  return apiDelete(`${BASE}/${id}`);
}

// ---------------------------------------------------------------------------
// Upload de thumbnail (multipart, campo `image`) — fluxo: subir → usar a `url`
// retornada no `thumbnail_url` ao criar/editar.
// ---------------------------------------------------------------------------

export async function uploadLiveThumbnail(file: File): Promise<{ url: string }> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) throw new Error("Workspace ID é obrigatório");

  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(getApiUrl(`${BASE}/uploads`), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken() ?? ""}`,
      "Workspace-Id": workspaceId,
      // Sem Content-Type — o browser injeta o boundary do multipart.
    },
    body: formData,
  });

  if (!res.ok) {
    let message = "Falha ao enviar a imagem";
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error(message), { status: res.status });
  }

  const json = await res.json();
  return (json.data ?? json) as { url: string };
}

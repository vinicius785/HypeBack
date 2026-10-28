import { getApiUrl, getAuthToken } from "@/lib/utils/api";
import type {
  AdminAudienceEstimate,
  AdminAudienceFilter,
  AdminNotificationCreatePayload,
  AdminNotificationDetail,
  AdminNotificationListItem,
  AdminNotificationStatus,
} from "@/shared/types";

/**
 * Service do Super Admin Notifications.
 *
 * Particularidades:
 * - NÃO envia header `Workspace-Id` — escopo global.
 * - Backend protege com `PlatformAdminGuard` (ver doc).
 * - `POST /admin/notifications` é idempotente via header `Idempotency-Key`
 *   — passamos um UUID por mutação pra evitar duplicidade em retry.
 *
 * Contrato detalhado: `docs/api-super-admin-notifications.md`.
 */

function buildHeaders(extra: HeadersInit = {}): HeadersInit {
  return {
    Accept: "application/json",
    "Client-Type": "backoffice",
    Authorization: `Bearer ${getAuthToken()}`,
    ...extra,
  };
}

async function handleResponse<T>(res: Response, fallbackMsg: string): Promise<T> {
  if (!res.ok) {
    let body: { message?: string } = {};
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const err = new Error(body?.message || fallbackMsg) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

/** UUID v4 — usado como `Idempotency-Key` em POSTs. */
function generateIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback simples (suficiente para idempotency, não criptográfico).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface AdminNotificationsListParams {
  /** Filtra por status. Omitido = todos. */
  status?: AdminNotificationStatus;
  page?: number;
  per_page?: number;
}

export async function fetchAdminNotificationsList(
  params: AdminNotificationsListParams = {},
): Promise<AdminNotificationListItem[]> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.per_page) search.set("per_page", String(params.per_page));
  const qs = search.toString();
  const res = await fetch(
    getApiUrl(`/admin/notifications${qs ? `?${qs}` : ""}`),
    { method: "GET", headers: buildHeaders() },
  );
  return handleResponse<AdminNotificationListItem[]>(
    res,
    "Falha ao consultar notificações",
  );
}

export async function fetchAdminNotificationDetail(
  id: string,
): Promise<AdminNotificationDetail> {
  const res = await fetch(getApiUrl(`/admin/notifications/${id}`), {
    method: "GET",
    headers: buildHeaders(),
  });
  return handleResponse<AdminNotificationDetail>(
    res,
    "Falha ao consultar notificação",
  );
}

export async function estimateAdminAudience(
  audience: AdminAudienceFilter,
): Promise<AdminAudienceEstimate> {
  const res = await fetch(
    getApiUrl(`/admin/notifications/estimate-audience`),
    {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ audience }),
    },
  );
  return handleResponse<AdminAudienceEstimate>(
    res,
    "Falha ao estimar audiência",
  );
}

export async function createAdminNotification(
  payload: AdminNotificationCreatePayload,
): Promise<AdminNotificationDetail> {
  const res = await fetch(getApiUrl(`/admin/notifications`), {
    method: "POST",
    headers: buildHeaders({
      "Content-Type": "application/json",
      "Idempotency-Key": generateIdempotencyKey(),
    }),
    body: JSON.stringify(payload),
  });
  return handleResponse<AdminNotificationDetail>(
    res,
    "Falha ao criar notificação",
  );
}

export interface AdminCampaignLookupItem {
  id: string;
  title: string;
  workspace_name: string | null;
}

/**
 * Lookup global de campanhas para uso no audience builder (filtro `campaign`).
 * Resposta enxuta — só id/title/workspace_name. Backend deve indexar por
 * `title` para suportar busca rápida (LIKE/ILIKE com `pg_trgm` é suficiente).
 */
export async function fetchAdminCampaignLookup(
  search = "",
): Promise<AdminCampaignLookupItem[]> {
  const qs = search.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : "";
  const res = await fetch(
    getApiUrl(`/admin/notifications/options/campaigns${qs}`),
    { method: "GET", headers: buildHeaders() },
  );
  return handleResponse<AdminCampaignLookupItem[]>(
    res,
    "Falha ao consultar campanhas",
  );
}

export async function cancelAdminNotification(
  id: string,
): Promise<AdminNotificationDetail> {
  const res = await fetch(
    getApiUrl(`/admin/notifications/${id}/cancel`),
    {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
    },
  );
  return handleResponse<AdminNotificationDetail>(
    res,
    "Falha ao cancelar notificação",
  );
}

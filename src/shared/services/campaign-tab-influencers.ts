import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import type { Influencer } from "@/shared/types";
import {
  transformDashboardInfluencer,
  type DashboardInfluencer,
} from "@/shared/services/dashboard";
import { extractNicheFromApiRow } from "@/shared/utils/niche-display";

/** @see docs/API_INSCRICOES_CURADORIA.md §3 */
export type InscriptionsSegment = "applications" | "pre_selection";

/** @see docs/API_INSCRICOES_CURADORIA.md §4 */
export type CurationColumn = "pending" | "approved" | "rejected";

/** Resposta GET .../users/inscriptions (formato atual da API) */
export interface InscriptionApiUser {
  id: string;
  name: string;
  avatar?: string | null;
  gender?: string | null;
}

export interface InscriptionApiSocialNetwork {
  id: number;
  type: string;
  name: string;
  username?: string | null;
  members?: number | null;
  photo?: string | null;
  status?: string | null;
  /**
   * Engajamento (%) do perfil, quando o backend calcula a partir das métricas
   * da conta (mesma definição do catálogo de criadores).
   */
  engagement_percent?: number | null;
  /**
   * Preços por formato (centavos BRL) definidos pelo influenciador.
   * Presente quando o backend inclui o bloco — usado para cálculo de
   * custo de aprovação quando `payment_method === "price"`.
   */
  prices?: Record<string, number> | null;
}

export interface InscriptionApiRow {
  campaign_user_id?: string | number;
  user_id?: string | number;
  user: InscriptionApiUser;
  social_network?: InscriptionApiSocialNetwork | null;
  status: string;
  niche?: string | null;
  niche_id?: string | number | null;
  niche_name?: string | null;
  engagement?: number | null;
  engagement_percent?: number | null;
  updated_at?: string | null;
  is_external?: boolean | null;
}

export interface InscriptionsListResponse {
  data: unknown[];
  meta?: {
    segment?: string;
    count?: number;
  };
}

function isInscriptionApiRow(row: unknown): row is InscriptionApiRow {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  if (!r.user || typeof r.user !== "object") return false;
  const u = r.user as Record<string, unknown>;
  return typeof u.id === "string" || typeof u.id === "number";
}

function normalizeInscriptionStatus(s: string): Influencer["status"] {
  const v = s.toLowerCase().trim();
  const allowed = new Set([
    "applications",
    "pre_selection",
    "pre_selection_curation",
    "curation",
    "invited",
    "contract_pending",
    "approved",
    "script_pending",
    "content_pending",
    "pending_approval",
    "in_correction",
    "content_approved",
    "payment_pending",
    "published",
    "rejected",
  ]);
  return (allowed.has(v) ? v : "applications") as Influencer["status"];
}

/**
 * Normaliza dict de preços do influenciador (mantém só valores numéricos
 * finitos; descarta entradas inválidas). Retorna `undefined` quando o
 * backend não envia preços ou o dict é vazio.
 */
function normalizePricesDict(
  raw: Record<string, number> | null | undefined,
): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Engajamento da linha. O backend expõe o valor em chaves diferentes conforme a
 * origem (`engagement` calculado na campanha, `engagement_percent` vindo das
 * métricas do perfil). Quem se inscreveu ainda não publicou nada na campanha, então
 * o valor de campanha vem 0 — preferimos qualquer métrica de perfil disponível.
 */
function resolveRowEngagement(row: InscriptionApiRow): number {
  const candidates = [
    row.social_network?.engagement_percent,
    row.engagement_percent,
    row.engagement,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (c != null && Number.isFinite(n) && n > 0) return n;
  }
  const fallback = Number(row.engagement);
  return row.engagement != null && Number.isFinite(fallback) ? fallback : 0;
}

/**
 * Linha enriquecida: user + social_network + campaign_user_id (lista de inscrições).
 */
export function mapInscriptionApiRowToInfluencer(row: InscriptionApiRow): Influencer {
  const u = row.user;
  const sn = row.social_network;
  const uid = String(row.user_id ?? u.id ?? "");
  const rowStatus = normalizeInscriptionStatus(String(row.status || "applications"));
  const netStatus = normalizeInscriptionStatus(
    String(sn?.status || row.status || "applications")
  );

  const userAvatar = typeof u.avatar === "string" ? u.avatar : "";
  const networkPhoto =
    typeof sn?.photo === "string" && sn.photo.trim() !== ""
      ? sn.photo.trim()
      : "";

  const { niche: nicheId, nicheName } = extractNicheFromApiRow(
    row as unknown as Record<string, unknown>
  );

  const influencer: Influencer = {
    id: uid,
    name: (u.name || "").trim() || "—",
    username: (sn?.username ?? "").trim() || (u.name || "").trim() || "—",
    /** Preferir foto do perfil na rede; senão avatar do usuário */
    avatar: networkPhoto || userAvatar,
    followers: sn?.members != null && !Number.isNaN(Number(sn.members)) ? Number(sn.members) : 0,
    engagement: resolveRowEngagement(row),
    niche: nicheId,
    nicheName,
    status: rowStatus,
    campaign_user_id:
      row.campaign_user_id != null && row.campaign_user_id !== ""
        ? String(row.campaign_user_id)
        : undefined,
    updated_at: row.updated_at ?? undefined,
    is_external: row.is_external ?? undefined,
    social_networks: sn
      ? [
          {
            id: sn.id,
            type: sn.type,
            name: (sn.name || sn.type || "").trim() || sn.type,
            username: sn.username ?? undefined,
            members:
              sn.members != null && !Number.isNaN(Number(sn.members))
                ? Number(sn.members)
                : undefined,
            photo: networkPhoto || null,
            status: netStatus,
            prices: normalizePricesDict(sn.prices),
          },
        ]
      : [],
  };

  return influencer;
}

function mapRowToInfluencer(row: unknown): Influencer {
  const base = transformDashboardInfluencer(row as DashboardInfluencer);
  if (row && typeof row === "object") {
    const { niche: extractedNiche, nicheName } = extractNicheFromApiRow(
      row as Record<string, unknown>
    );
    return {
      ...base,
      ...(extractedNiche ? { niche: extractedNiche } : {}),
      ...(nicheName ? { nicheName } : {}),
    };
  }
  return base;
}

async function fetchTabInfluencers<T>(url: string): Promise<T> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
      "Workspace-Id": workspaceId,
    },
  });

  if (!request.ok) {
    let body: { message?: string } = {};
    try {
      body = await request.json();
    } catch {
      body = { message: request.statusText };
    }
    const err = new Error(
      body?.message || "Falha ao carregar influenciadores"
    ) as Error & { status?: number };
    err.status = request.status;
    throw err;
  }

  return request.json();
}

/**
 * GET .../users/inscriptions?segment=applications|pre_selection
 */
export async function getCampaignInscriptions(
  campaignId: string,
  segment: InscriptionsSegment
): Promise<Influencer[]> {
  const url = getApiUrl(
    `/campaigns/${campaignId}/users/inscriptions?segment=${encodeURIComponent(segment)}`
  );
  const response = await fetchTabInfluencers<InscriptionsListResponse>(url);
  const list = response.data;
  if (!Array.isArray(list)) return [];
  return list.map((row) =>
    isInscriptionApiRow(row)
      ? mapInscriptionApiRowToInfluencer(row)
      : mapRowToInfluencer(row)
  );
}

/**
 * GET .../users/curation?column=pending|approved|rejected
 */
export async function getCampaignCuration(
  campaignId: string,
  column: CurationColumn
): Promise<Influencer[]> {
  const url = getApiUrl(
    `/campaigns/${campaignId}/users/curation?column=${encodeURIComponent(column)}`
  );
  const response = await fetchTabInfluencers<{ data?: unknown[] }>(url);
  const list = response.data;
  if (!Array.isArray(list)) return [];
  return list.map((row) =>
    isInscriptionApiRow(row)
      ? mapInscriptionApiRowToInfluencer(row)
      : mapRowToInfluencer(row)
  );
}

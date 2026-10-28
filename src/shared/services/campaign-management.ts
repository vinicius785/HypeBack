import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import { extractNicheFromApiRow } from "@/shared/utils/niche-display";

/** Item de `status_history` conforme `API_CAMPAIGN_MANAGEMENT.md` */
export interface CampaignManagementStatusHistoryItem {
  id: string;
  status: string;
  previous_status?: string | null;
  source?: string | null;
  timestamp: string;
  notes?: string;
}

/** Participante retornado por `GET /campaigns/:campaignId/management` */
export interface CampaignManagementParticipant {
  id: string;
  user_id?: string;
  name: string;
  username: string;
  avatar: string;
  followers: number;
  engagement: number;
  niche?: string;
  nicheName?: string;
  gender?: string;
  social_network?: string;
  social_networks?: Array<{
    id: number | string;
    type: string;
    name: string;
    username?: string;
    members?: number;
    photo?: string | null;
    status?: string;
  }>;
  status?: string;
  phase?: string;
  /** Criador externo (pré-cadastro via link público / link de premiação, sem conta no app) — etiqueta "Externo" (#17/#31). */
  is_external?: boolean;
  /** Negociação de "valor individual por criador" (quando presente). */
  price_negotiation?: {
    proposed_price_cents: number | null;
    counter_price_cents: number | null;
    agreed_price_cents: number | null;
    price_status: string | null;
    origin: string | null;
    /**
     * Detalhe POR REDE (individual_price por rede). Presente quando a negociação
     * vive em linhas por rede; os escalares acima trazem os somatórios. A marca
     * responde por rede enviando `social_network_id`.
     */
    networks?: Array<{
      social_network_id: number | null;
      network_type: string;
      proposed_price_cents: number | null;
      counter_price_cents: number | null;
      agreed_price_cents: number | null;
      price_status: string | null;
      awaiting_creator: boolean;
    }>;
  } | null;
  status_history: CampaignManagementStatusHistoryItem[];
}

export interface CampaignManagementResponse {
  participants: CampaignManagementParticipant[];
}

function normalizeParticipant(raw: Record<string, unknown>): CampaignManagementParticipant | null {
  if (raw == null || typeof raw !== "object") return null;
  const id = raw.id != null ? String(raw.id) : "";
  if (!id) return null;
  const shRaw = raw.status_history;
  const status_history: CampaignManagementStatusHistoryItem[] = Array.isArray(shRaw)
    ? shRaw
        .map((item) => {
          const h = item as Record<string, unknown>;
          if (h?.id == null || h?.timestamp == null) return null;
          return {
            id: String(h.id),
            status: String(h.status ?? ""),
            previous_status:
              h.previous_status === undefined || h.previous_status === null
                ? null
                : String(h.previous_status),
            source:
              h.source === undefined || h.source === null
                ? null
                : String(h.source),
            timestamp: String(h.timestamp),
            notes: h.notes != null ? String(h.notes) : undefined,
          };
        })
        .filter(Boolean) as CampaignManagementStatusHistoryItem[]
    : [];

  const { niche: nicheId, nicheName } = extractNicheFromApiRow(raw);

  return {
    id,
    user_id: raw.user_id != null ? String(raw.user_id) : undefined,
    name: String(raw.name ?? ""),
    username: String(raw.username ?? ""),
    avatar: String(raw.avatar ?? ""),
    followers: typeof raw.followers === "number" ? raw.followers : 0,
    engagement: typeof raw.engagement === "number" ? raw.engagement : 0,
    niche: nicheId || undefined,
    nicheName,
    gender: raw.gender != null ? String(raw.gender) : undefined,
    social_network:
      raw.social_network != null ? String(raw.social_network) : undefined,
    social_networks: Array.isArray(raw.social_networks)
      ? (raw.social_networks as CampaignManagementParticipant["social_networks"])
      : undefined,
    status: raw.status != null ? String(raw.status) : undefined,
    phase: raw.phase != null ? String(raw.phase) : undefined,
    is_external:
      typeof raw.is_external === "boolean"
        ? raw.is_external
        : raw.is_external === "true"
          ? true
          : undefined,
    price_negotiation: normalizePriceNegotiation(raw.price_negotiation),
    status_history,
  };
}

/** Normaliza o bloco de negociação de preço (tolera ausência/nulos da API). */
function normalizePriceNegotiation(
  raw: unknown,
): CampaignManagementParticipant["price_negotiation"] {
  if (raw == null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === "number" ? v : v == null || v === "" ? null : Number(v);
  const networks = Array.isArray(r.networks)
    ? (r.networks as Record<string, unknown>[])
        .map((n) => {
          if (n == null || typeof n !== "object") return null;
          return {
            social_network_id: num(n.social_network_id),
            network_type: String(n.network_type ?? ""),
            proposed_price_cents: num(n.proposed_price_cents),
            counter_price_cents: num(n.counter_price_cents),
            agreed_price_cents: num(n.agreed_price_cents),
            price_status: n.price_status != null ? String(n.price_status) : null,
            awaiting_creator: n.awaiting_creator === true,
          };
        })
        .filter(Boolean)
    : undefined;
  return {
    proposed_price_cents: num(r.proposed_price_cents),
    counter_price_cents: num(r.counter_price_cents),
    agreed_price_cents: num(r.agreed_price_cents),
    price_status: r.price_status != null ? String(r.price_status) : null,
    origin: r.origin != null ? String(r.origin) : null,
    ...(networks && networks.length > 0
      ? {
          networks: networks as NonNullable<
            CampaignManagementParticipant["price_negotiation"]
          >["networks"],
        }
      : {}),
  };
}

/**
 * Lista canônica de participantes para o kanban (histórico de status incluído).
 * @see API_CAMPAIGN_MANAGEMENT.md
 */
export async function getCampaignManagement(
  campaignId: string
): Promise<CampaignManagementResponse> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/management`),
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
    let errorData: { message?: string } = {};
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to get campaign management" };
    }
    const err = new Error(
      errorData?.message || "Failed to get campaign management"
    ) as Error & { status?: number };
    err.status = request.status;
    throw err;
  }

  const response = (await request.json()) as {
    data?: { participants?: unknown[] };
  };
  const list = response.data?.participants;
  const participants: CampaignManagementParticipant[] = Array.isArray(list)
    ? list
        .map((row) =>
          normalizeParticipant(row as Record<string, unknown>)
        )
        .filter((p): p is CampaignManagementParticipant => p != null)
    : [];

  return { participants };
}

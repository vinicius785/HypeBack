/**
 * Balance movements / consumo por campanha / gasto CPM.
 *
 * Endpoints especificados em `docs/api-financial-page.md`. Enquanto o backend
 * não implementa, `safeApiGet` trata 404 como "endpoint ausente" e retorna
 * `null` — os hooks convertem para estado vazio elegante na UI (sem mocks).
 *
 * Performance:
 *  - Paginação cursor keyset em `/movements` (cf. seção 5 da doc).
 *  - Projeção `?fields=` exposta opcionalmente nos params.
 *  - GETs ficam atrás de TanStack Query (cache + dedupe).
 *
 * Segurança:
 *  - Auth/tenancy injetadas via headers padronizados (mesmo conjunto do
 *    `http-client`).
 *  - 404 → vazio, mas 401/403 NÃO são silenciados (propagam erro).
 */
import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
// Tipos compartilhados
// ---------------------------------------------------------------------------

export type MovementType =
  | "top_up_pending"
  | "top_up_confirmed"
  | "top_up_expired"
  | "top_up_refunded"
  | "reserve_created"
  | "reserve_released"
  | "reserve_cancelled"
  | "adjustment_credit"
  | "adjustment_debit"
  | "payout";

export interface MovementActor {
  type: "system" | "user";
  user_id: number | null;
  name: string;
}

export interface MovementRelated {
  charge_id: string | null;
  campaign_id: number | null;
  campaign_user_id: number | null;
  hold_id: number | null;

  // ---------------------------------------------------------------------
  // Enriquecimento opcional (server-side join — ver docs/api-financial-movements-enriched.md).
  // Backend faz LEFT JOIN nas tabelas relacionadas para evitar N+1 do frontend.
  // Front exibe quando presentes, com fallback elegante quando ausentes.
  // ---------------------------------------------------------------------

  /** Título da campanha vinculada ao movimento (quando aplicável). */
  campaign_title?: string | null;
  /** Public_id da campanha (UUID) — usado para deep-link futuro. */
  campaign_public_id?: string | null;
  /** Path do banner da campanha (resolver via `getUploadUrl`). */
  campaign_banner_url?: string | null;
  /** Método de pagamento da campanha — exibido como chip para contexto. */
  campaign_payment_method?: PaymentMethod | null;

  /** Nome do influenciador (resolvido pelo `campaign_user_id` → `users`). */
  influencer_name?: string | null;
  /** Handle público do perfil envolvido no movimento (sem `@`). */
  influencer_username?: string | null;
  /** Path do avatar do influenciador. */
  influencer_avatar?: string | null;

  /** Tipo da rede social (instagram, tiktok, youtube, ugc…). */
  social_network?: string | null;
  /** Rótulo já resolvido pelo backend (opcional — front faz fallback via getNetworkLabel). */
  social_network_label?: string | null;
  /** Formato do conteúdo associado ao movimento (post, reels, video, etc.). */
  content_type?: string | null;
}

export interface BalanceMovement {
  id: string;
  type: MovementType;
  amount_cents: number;
  /**
   * Snapshots de saldo imediatamente após o movimento.
   * Opcionais: o backend só popula quando há tabela append-only com running
   * sum. Quando ausentes, o front esconde a coluna correspondente.
   */
  balance_after_cents?: number;
  available_after_cents?: number;
  committed_after_cents?: number;
  description: string;
  occurred_at: string;
  actor: MovementActor;
  related: MovementRelated;
}

export interface MovementsResponse {
  items: BalanceMovement[];
  next_cursor: string | null;
}

export interface MovementsFilters {
  cursor?: string | null;
  limit?: number;
  type?: MovementType[];
  from?: string;
  to?: string;
}

// ---- Consumo por campanha -------------------------------------------------

export type CampaignStatus = "active" | "finished" | "draft" | "all";
export type PaymentMethod = "fixed" | "cpm" | "cpa" | "swap" | "price";
export type ConsumptionOrder =
  | "committed_desc"
  | "committed_asc"
  | "spent_desc"
  | "started_desc";

export interface CampaignConsumptionItem {
  campaign_id: number;
  campaign_public_id: string;
  title: string;
  banner_url: string | null;
  status: Exclude<CampaignStatus, "all">;
  payment_method: PaymentMethod;
  started_at: string | null;
  ends_at: string | null;
  committed_cents: number;
  spent_cents: number;
  max_budget_cents: number | null;
  influencers: { active: number; approved: number; total: number };
  last_movement_at: string | null;
}

export interface CampaignConsumptionResponse {
  items: CampaignConsumptionItem[];
  totals: {
    committed_cents: number;
    spent_cents: number;
    max_budget_cents: number;
    campaign_count: number;
  };
  snapshot_at: string;
}

export interface CampaignConsumptionFilters {
  status?: CampaignStatus;
  payment_method?: PaymentMethod;
  order?: ConsumptionOrder;
  limit?: number;
}

// ---- CPM spend ------------------------------------------------------------

export interface CpmPublication {
  content_id: number;
  campaign_user_id: number;
  social_network: string;
  published_at: string;
  window_end_at: string;
  is_within_window: boolean;
  views_tracked: number;
  spent_cents: number;
  last_synced_at: string;
}

export interface CpmCampaignSpend {
  campaign_id: number;
  campaign_public_id: string;
  title: string;
  status: Exclude<CampaignStatus, "all">;
  cpm_rate_cents: number;
  totals: {
    views_tracked: number;
    views_billable: number;
    spent_cents: number;
    committed_cents: number;
    remaining_budget_cents: number;
  };
  tracking_window: {
    first_publication_at: string | null;
    last_publication_at: string | null;
    earliest_window_end: string | null;
    latest_window_end: string | null;
    active_publications: number;
    expired_publications: number;
  };
  publications?: CpmPublication[];
  updated_at: string;
}

export interface CpmSpendResponse {
  items: CpmCampaignSpend[];
}

export interface CpmSpendFilters {
  campaign_id?: number;
  include_finished?: boolean;
  expand_publications?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * GET que diferencia "endpoint não existe ainda" (404) de erro real.
 * - 404 → retorna `null` (hook trata como empty state)
 * - 401/403/5xx → propaga Error (front mostra mensagem)
 */
async function safeApiGet<T>(path: string): Promise<T | null> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId || /^\d+$/.test(workspaceId)) {
    throw new Error("Workspace ID inválido. Selecione um workspace válido.");
  }

  const res = await fetch(getApiUrl(path), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken() ?? ""}`,
      "Workspace-Id": workspaceId,
    },
  });

  // Endpoint ainda não implementado pelo backend — silencia para UX
  if (res.status === 404) return null;

  if (!res.ok) {
    let message = `Request failed: ${path} (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // body não-JSON; mantém fallback
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  const json = await res.json();
  return (json.data !== undefined ? json.data : json) as T;
}

function buildQueryString(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) usp.set(key, value.join(","));
    } else {
      usp.set(key, String(value));
    }
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------------------
// Endpoints públicos
// ---------------------------------------------------------------------------

const EMPTY_MOVEMENTS: MovementsResponse = { items: [], next_cursor: null };
const EMPTY_CONSUMPTION: CampaignConsumptionResponse = {
  items: [],
  totals: {
    committed_cents: 0,
    spent_cents: 0,
    max_budget_cents: 0,
    campaign_count: 0,
  },
  snapshot_at: new Date(0).toISOString(),
};
const EMPTY_CPM: CpmSpendResponse = { items: [] };

export async function getMovements(
  workspaceId: string,
  filters: MovementsFilters = {},
): Promise<MovementsResponse> {
  const qs = buildQueryString({
    cursor: filters.cursor,
    limit: filters.limit ?? 20,
    type: filters.type,
    from: filters.from,
    to: filters.to,
  });
  const result = await safeApiGet<MovementsResponse>(
    `/balance/workspace/${workspaceId}/movements${qs}`,
  );
  return result ?? EMPTY_MOVEMENTS;
}

export async function getCampaignConsumption(
  workspaceId: string,
  filters: CampaignConsumptionFilters = {},
): Promise<CampaignConsumptionResponse> {
  const qs = buildQueryString({
    status: filters.status ?? "active",
    payment_method: filters.payment_method,
    order: filters.order ?? "committed_desc",
    limit: filters.limit ?? 50,
  });
  const result = await safeApiGet<CampaignConsumptionResponse>(
    `/balance/workspace/${workspaceId}/campaign-consumption${qs}`,
  );
  return result ?? EMPTY_CONSUMPTION;
}

export async function getCpmSpend(
  workspaceId: string,
  filters: CpmSpendFilters = {},
): Promise<CpmSpendResponse> {
  const qs = buildQueryString({
    campaign_id: filters.campaign_id,
    include_finished: filters.include_finished,
    expand: filters.expand_publications ? "publications" : undefined,
  });
  const result = await safeApiGet<CpmSpendResponse>(
    `/balance/workspace/${workspaceId}/campaigns/cpm-spend${qs}`,
  );
  return result ?? EMPTY_CPM;
}

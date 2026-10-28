import { apiGet, apiPost } from "@/lib/http-client";

export type ShipmentKind = "physical" | "digital";
export type ShipmentMethod =
  | "correios"
  | "carrier"
  | "email"
  | "whatsapp"
  | "in_person";

/**
 * Endereço de entrega estruturado (cf. doc backend).
 * Front coleta em campos separados; backend valida campo-a-campo.
 */
export interface ShipmentAddress {
  recipient_name?: string;
  phone?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  state: string;
  zip: string;
  /** ISO-3166 alpha-2. Default "BR". */
  country?: string;
  reference?: string;
  delivery_notes?: string;
}

export interface ShipmentItemDto {
  /** UUID do produto do catálogo. Omita para item ad-hoc. */
  product_id?: string;
  product_name: string;
  product_description?: string;
  /** Em BRL (não em centavos), conforme contrato `_brl`. */
  product_market_value_brl?: number;
  /** Livre — sku, cor, tamanho, variação, etc. */
  product_metadata?: Record<string, unknown>;
  /** Default 1, range 1-10000 no backend. */
  quantity?: number;
}

export interface ShipmentItemRecord {
  id: number;
  product_id: number | null;
  product_name: string;
  product_description: string | null;
  product_market_value_brl: string | null;
  product_metadata: Record<string, unknown> | null;
  quantity: number;
}

export type ShipmentStatus =
  | "pending_shipment"
  | "shipped"
  | "received"
  | "cancelled";

export interface ShipmentRecord {
  id: number;
  campaign_user_id?: number;
  kind: ShipmentKind;
  method: ShipmentMethod;
  status?: ShipmentStatus;
  /** Snapshot do primeiro item (back-compat). `items` é a fonte de verdade. */
  product_name: string;
  product_description?: string | null;
  product_market_value_brl?: number | string | null;
  items?: ShipmentItemRecord[];
  recipient_address?: ShipmentAddress | string | null;
  delivery_target?: string | null;
  tracking_code?: string | null;
  notes?: string | null;
  product_id?: string | null;
  shipped_at?: string | null;
  received_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateShipmentDto {
  kind: ShipmentKind;
  method: ShipmentMethod;
  /**
   * Lista de produtos do envio (mín. 1, máx. 20).
   * Substitui o formato legado (`product_name` no nível raiz) — backend
   * continua aceitando o legado, mas o front sempre envia `products[]`.
   */
  products: ShipmentItemDto[];
  /** Apenas persistido se `kind = "physical"`. Máx 64 chars. */
  tracking_code?: string;
  /** Obrigatório se `kind = "physical"`. */
  recipient_address?: ShipmentAddress;
  /** Obrigatório se `method ∈ {"email", "whatsapp"}`. */
  delivery_target?: string;
  /** Máx 2000 chars. */
  notes?: string;
}

/** Status exibido na aba Envios (derivado no backend do envio + etapa). */
export type ShipmentStageStatus =
  | "awaiting_shipment"
  | "awaiting_receipt"
  | "received";

interface CampaignShipmentRaw {
  campaign_user_id: number;
  user_id: number;
  status: ShipmentStageStatus;
  user: {
    name: string;
    email: string;
    phone?: string | null;
    photo: string | null;
  };
  shipping_address?: ShipmentAddress | null;
  shipment: ShipmentRecord | null;
}

export interface CampaignShipmentEntry {
  campaign_user_id: number;
  user_id: string;
  name: string;
  email: string;
  avatar: string | null;
  status: ShipmentStageStatus;
  shipment: ShipmentRecord | null;
  shippingAddress: ShipmentAddress | null;
}

function normalizeEntry(raw: CampaignShipmentRaw): CampaignShipmentEntry {
  return {
    campaign_user_id: raw.campaign_user_id,
    user_id: String(raw.user_id),
    name: raw.user?.name ?? "",
    email: raw.user?.email ?? "",
    avatar: raw.user?.photo ?? null,
    status: raw.status,
    shipment: raw.shipment ?? null,
    shippingAddress: raw.shipping_address ?? null,
  };
}

export async function listCampaignShipments(
  campaignId: string,
): Promise<CampaignShipmentEntry[]> {
  const result = await apiGet<
    { data: CampaignShipmentRaw[] } | CampaignShipmentRaw[]
  >(`/campaigns/${campaignId}/users/shipments`);
  const raw = Array.isArray(result)
    ? result
    : ((result as { data: CampaignShipmentRaw[] }).data ?? []);
  return raw.map(normalizeEntry);
}

export async function createShipment(
  campaignId: string,
  influencerId: string,
  dto: CreateShipmentDto,
): Promise<ShipmentRecord> {
  const { data } = await apiPost<{ data: ShipmentRecord }>(
    `/campaigns/${campaignId}/users/${influencerId}/shipment`,
    dto,
  );
  return data;
}

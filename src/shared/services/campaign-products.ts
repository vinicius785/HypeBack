import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/http-client";
import type { CampaignProductDraft } from "@/shared/types";
import { currencyToNumber } from "@/shared/utils/masks";
import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";

/**
 * Limites obrigatórios (cf. doc backend):
 *  - 5 imagens totais por produto
 *  - 5 MB por arquivo
 *  - mimes aceitos: jpeg, jpg, png, webp
 *
 * Front valida antes de enviar para evitar 400 round-trip.
 */
export const PRODUCT_IMAGE_LIMITS = {
  maxPerProduct: 5,
  maxBytes: 5 * 1024 * 1024,
  acceptedMimes: ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const,
} as const;

export type AcceptedImageMime = (typeof PRODUCT_IMAGE_LIMITS.acceptedMimes)[number];

export function validateProductImageFile(file: File): string | null {
  if (file.size > PRODUCT_IMAGE_LIMITS.maxBytes) {
    return `Imagem "${file.name}" excede o limite de 5 MB.`;
  }
  if (!(PRODUCT_IMAGE_LIMITS.acceptedMimes as readonly string[]).includes(file.type)) {
    return `Formato inválido (${file.type || "desconhecido"}) em "${file.name}". Use JPEG, PNG ou WebP.`;
  }
  return null;
}

export interface CampaignProduct {
  id: string;
  name: string;
  description?: string | null;
  market_value_cents?: number | null;
  weight_grams?: number | null;
  dimensions?: { width_cm?: number; height_cm?: number; length_cm?: number } | null;
  images?: string[] | null;
  brand?: string | null;
  sku?: string | null;
  notes?: string | null;
  created_at?: string;
}

interface ProductPayload {
  name: string;
  description?: string;
  market_value_cents?: number;
  weight_grams?: number;
  dimensions?: { width_cm?: number; height_cm?: number; length_cm?: number };
  /**
   * URLs públicas das imagens **já existentes** que devem ser mantidas.
   * Arquivos novos NÃO vão aqui — vão no campo `files[]` do multipart.
   */
  images?: string[];
  brand?: string;
  sku?: string;
  notes?: string;
}

/**
 * Sync porque arquivos binários (`pendingImageFiles`) são tratados separadamente
 * via multipart `files[]`, não embutidos no JSON. Aqui só montamos a parte
 * estruturada do produto + URLs de imagens existentes a manter.
 */
function draftToPayload(draft: CampaignProductDraft): ProductPayload {
  const payload: ProductPayload = { name: draft.name.trim() };
  if (draft.description?.trim()) payload.description = draft.description.trim();
  if (draft.market_value) {
    const cents = Math.round(currencyToNumber(draft.market_value) * 100);
    if (cents > 0) payload.market_value_cents = cents;
  }
  if (draft.weight_grams) {
    const g = parseInt(draft.weight_grams, 10);
    if (!isNaN(g) && g > 0) payload.weight_grams = g;
  }
  const w = draft.width_cm ? parseFloat(draft.width_cm) : undefined;
  const h = draft.height_cm ? parseFloat(draft.height_cm) : undefined;
  const l = draft.length_cm ? parseFloat(draft.length_cm) : undefined;
  if (w || h || l) {
    payload.dimensions = {};
    if (w) payload.dimensions.width_cm = w;
    if (h) payload.dimensions.height_cm = h;
    if (l) payload.dimensions.length_cm = l;
  }
  if (draft.brand?.trim()) payload.brand = draft.brand.trim();
  if (draft.sku?.trim()) payload.sku = draft.sku.trim();
  if (draft.notes?.trim()) payload.notes = draft.notes.trim();

  // URLs já hospedadas que devem ser preservadas no PUT.
  // Quando PUT chega sem `images`, o backend pode apagar todas — sempre enviar.
  const existing = (draft.images ?? []).filter(
    (u) => typeof u === "string" && u.trim() && !u.startsWith("data:"),
  );
  if (existing.length > 0) {
    payload.images = existing;
  }

  return payload;
}

/**
 * Faz POST/PUT do produto com payload JSON + arquivos binários no mesmo
 * round-trip. Quando não há `files`, usa o caminho JSON-puro (mais leve).
 *
 * Multipart segue exatamente o contrato da doc:
 *  - Campo `data`: JSON stringificado com os campos do produto
 *  - Campo `files`: arquivos binários (Files)
 *  - Browser define o `Content-Type: multipart/form-data; boundary=...`
 *
 * NÃO setamos Content-Type manualmente — qualquer override quebra o
 * boundary auto-gerado.
 */
async function sendProductRequest(
  method: "POST" | "PUT",
  path: string,
  payload: ProductPayload,
  files: File[],
): Promise<CampaignProduct> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) throw new Error("Workspace ID é obrigatório");

  // Caminho JSON puro (sem arquivos novos)
  if (files.length === 0) {
    return method === "POST"
      ? apiPost<CampaignProduct>(path, payload)
      : apiPut<CampaignProduct>(path, payload);
  }

  // Validações cliente-side (espelham backend) — falham cedo, sem round-trip
  if (files.length > PRODUCT_IMAGE_LIMITS.maxPerProduct) {
    throw new Error(
      `Limite de ${PRODUCT_IMAGE_LIMITS.maxPerProduct} imagens por produto.`,
    );
  }
  for (const file of files) {
    const err = validateProductImageFile(file);
    if (err) throw new Error(err);
  }

  // Caminho multipart
  const formData = new FormData();
  formData.append("data", JSON.stringify(payload));
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(getApiUrl(path), {
    method,
    headers: {
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken() ?? ""}`,
      "Workspace-Id": workspaceId,
    },
    body: formData,
  });

  if (!res.ok) {
    let message = `Falha ao salvar produto (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // body não-JSON; usa fallback
    }
    throw new Error(message);
  }

  const json = await res.json();
  return (json.data ?? json) as CampaignProduct;
}

export async function getCampaignProducts(campaignId: string): Promise<CampaignProduct[]> {
  return apiGet<CampaignProduct[]>(`/campaigns/${campaignId}/products`);
}

export async function createCampaignProduct(
  campaignId: string,
  draft: CampaignProductDraft,
): Promise<CampaignProduct> {
  const payload = draftToPayload(draft);
  const files = draft.pendingImageFiles ?? [];
  return sendProductRequest(
    "POST",
    `/campaigns/${campaignId}/products`,
    payload,
    files,
  );
}

export async function updateCampaignProduct(
  campaignId: string,
  productId: string,
  draft: CampaignProductDraft,
): Promise<CampaignProduct> {
  const payload = draftToPayload(draft);
  const files = draft.pendingImageFiles ?? [];
  return sendProductRequest(
    "PUT",
    `/campaigns/${campaignId}/products/${productId}`,
    payload,
    files,
  );
}

export async function deleteCampaignProduct(
  campaignId: string,
  productId: string,
): Promise<void> {
  return apiDelete(`/campaigns/${campaignId}/products/${productId}`);
}

/**
 * Cria todos os produtos de um draft de campanha em paralelo, **com as
 * imagens já no payload** (multipart com `files[]`). Sem fase 2 separada.
 */
export async function createAllCampaignProducts(
  campaignId: string,
  drafts: CampaignProductDraft[],
): Promise<void> {
  const valid = drafts.filter((d) => d.name.trim());
  if (!valid.length) return;
  await Promise.all(valid.map((draft) => createCampaignProduct(campaignId, draft)));
}

// ---------------------------------------------------------------------------
// Endpoints alternativos pra imagens — mantidos para callers externos.
// O fluxo principal de criação/edição usa multipart inline via `sendProductRequest`.
// ---------------------------------------------------------------------------

export async function uploadProductImages(
  campaignId: string,
  productId: string,
  files: File[],
): Promise<CampaignProduct> {
  if (!files.length) {
    throw new Error("Envie ao menos uma imagem.");
  }
  if (files.length > PRODUCT_IMAGE_LIMITS.maxPerProduct) {
    throw new Error(
      `Limite de ${PRODUCT_IMAGE_LIMITS.maxPerProduct} imagens por upload.`,
    );
  }
  for (const file of files) {
    const err = validateProductImageFile(file);
    if (err) throw new Error(err);
  }

  const workspaceId = getWorkspaceId();
  if (!workspaceId) throw new Error("Workspace ID é obrigatório");

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(
    getApiUrl(`/campaigns/${campaignId}/products/${productId}/images`),
    {
      method: "POST",
      headers: {
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken() ?? ""}`,
        "Workspace-Id": workspaceId,
      },
      body: formData,
    },
  );

  if (!res.ok) {
    let message = `Falha ao enviar imagens (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const json = await res.json();
  return (json.data ?? json) as CampaignProduct;
}

export async function deleteProductImage(
  campaignId: string,
  productId: string,
  url: string,
): Promise<CampaignProduct> {
  return apiDelete<CampaignProduct>(
    `/campaigns/${campaignId}/products/${productId}/images`,
    { url },
  );
}

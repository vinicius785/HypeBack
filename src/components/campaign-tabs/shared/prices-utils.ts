/**
 * Lógica de preços de influenciador × formatos de campanha.
 * Compartilhado entre o card (modal de preços) e as abas (gating de aprovação).
 *
 * Toda a aritmética é em **centavos de BRL** (Web2, saldo real do workspace).
 * Nada aqui depende de HYPE/blockchain.
 */

// ---------------------------------------------------------------------------
// Vocabulário e aliases entre form (campanha) e prices (influenciador)
// ---------------------------------------------------------------------------

/**
 * Para cada (rede, formato exigido pela campanha), a lista de keys candidatas
 * no dict de prices do influenciador, em ordem de preferência.
 *
 *   Campanha (form)                   Influenciador (prices)
 *   ─────────────────                 ──────────────────────
 *   instagram: post, reels, stories   instagram: feed, reels, stories
 *   tiktok:    video, live            tiktok:    feed, live
 *   youtube:   video_dedicated,       youtube:   shorts, videos, live
 *              insertion,
 *              preroll_endroll,
 *              shorts, live
 *   ugc:       image, video_1min,     ugc:       images, videos
 *              video_10min,
 *              video_1hour
 *
 * Observação: no YouTube/UGC o influencer tem um único preço genérico
 * (`videos`) que cobre múltiplos tipos. Aplicamos o mesmo preço a cada
 * tipo pedido — se a campanha pede 3 tipos de vídeo, o admin paga 3× o
 * preço unitário.
 */
export const CAMPAIGN_FORMAT_FALLBACKS: Record<string, Record<string, string[]>> = {
  instagram: {
    post: ["post", "feed", "publication", "publicacao"],
    reels: ["reels", "reel"],
    stories: ["stories", "story"],
  },
  instagram_facebook: {
    post: ["post", "feed", "publication", "publicacao"],
    reels: ["reels", "reel"],
    stories: ["stories", "story"],
  },
  tiktok: {
    video: ["video", "videos", "feed"],
    live: ["live"],
  },
  youtube: {
    video_dedicated: ["video_dedicated", "videos", "video"],
    insertion: ["insertion", "videos", "video"],
    preroll_endroll: ["preroll_endroll", "videos", "video"],
    shorts: ["shorts"],
    live: ["live"],
  },
  ugc: {
    image: ["image", "images"],
    video_1min: ["video_1min", "videos", "video"],
    video_10min: ["video_10min", "videos", "video"],
    video_1hour: ["video_1hour", "videos", "video"],
  },
};

export function getCampaignFormatFallbacks(network: string, campaignFmt: string): string[] {
  const net = network.toLowerCase().trim();
  const fmt = campaignFmt.toLowerCase().trim();
  return CAMPAIGN_FORMAT_FALLBACKS[net]?.[fmt] ?? [fmt];
}

export const FORMAT_LABELS: Record<string, string> = {
  post: "Post",
  reels: "Reels",
  stories: "Stories",
  video: "Vídeo",
  live: "LIVE",
  shorts: "Shorts",
  image: "Imagem",
  video_1min: "Vídeo 1min",
  video_10min: "Vídeo 10min",
  video_1hour: "Vídeo 1h",
  insertion: "Inserção",
  preroll_endroll: "Pre/End-roll",
  video_dedicated: "Vídeo dedicado",
  feed: "Feed",
  publication: "Post",
  publicacao: "Post",
  reel: "Reels",
  story: "Stories",
  videos: "Vídeos",
  images: "Imagens",
};

// ---------------------------------------------------------------------------
// Tipos e formatação
// ---------------------------------------------------------------------------

export interface PriceRow {
  fmt: string;
  cents: number | null;
  isRequiredByCampaign: boolean;
}

export interface PriceData {
  rows: PriceRow[];
  requiredRows: PriceRow[];
  extraRows: PriceRow[];
  totalCents: number;
  missingRequired: number;
  isFiltered: boolean;
  hasRequirements: boolean;
}

export const fmtBRL = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------------------------------------------------------------------------
// Cálculo de preços (price mode) — usado no modal e no badge da aba
// ---------------------------------------------------------------------------

/**
 * Constrói as linhas de preço aplicando fallback per-network.
 * O total soma só `requiredRows` com preço definido.
 * Retorna `null` quando não há nada a exibir (sem preços E sem exigências).
 */
export function computePriceData(
  prices: Record<string, number> | undefined,
  allowedPriceFormats: readonly string[] | undefined,
  network: string,
): PriceData | null {
  const isFiltered = allowedPriceFormats !== undefined;

  const pricesLower: Record<string, number> = {};
  if (prices) {
    for (const [k, v] of Object.entries(prices)) {
      const n = Number(v);
      if (Number.isFinite(n)) pricesLower[k.toLowerCase().trim()] = n;
    }
  }

  const consumedKeys = new Set<string>();
  const requiredRows: PriceRow[] = isFiltered
    ? allowedPriceFormats.map((campaignFmt) => {
        const fmt = campaignFmt.toLowerCase().trim();
        const fallbacks = getCampaignFormatFallbacks(network, fmt);

        let cents: number | null = null;
        for (const candidate of fallbacks) {
          if (typeof pricesLower[candidate] === "number") {
            cents = pricesLower[candidate];
            consumedKeys.add(candidate);
            break;
          }
        }

        return { fmt, cents, isRequiredByCampaign: true };
      })
    : [];

  const extraRows: PriceRow[] = Object.entries(pricesLower)
    .filter(([key]) => !consumedKeys.has(key))
    .map(([key, value]) => ({
      fmt: key,
      cents: value,
      isRequiredByCampaign: false,
    }))
    .sort((a, b) => {
      const la = FORMAT_LABELS[a.fmt] ?? a.fmt;
      const lb = FORMAT_LABELS[b.fmt] ?? b.fmt;
      return la.localeCompare(lb, "pt-BR");
    });

  if (requiredRows.length === 0 && extraRows.length === 0) return null;

  const rows = [...requiredRows, ...extraRows];
  const totalCents = requiredRows.reduce((acc, r) => acc + (r.cents ?? 0), 0);
  const missingRequired = requiredRows.filter((r) => r.cents == null).length;

  return {
    rows,
    requiredRows,
    extraRows,
    totalCents,
    missingRequired,
    isFiltered,
    hasRequirements: requiredRows.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Custo de aprovação — usado no gating das abas (applications / curation)
// ---------------------------------------------------------------------------

export interface CampaignPhaseForCost {
  formats?: Array<{
    socialNetwork: string;
    contentType?: string;
    quantity?: string;
    /** Preço em BRL formatado (ex.: "1.500,00") — usado quando paymentType === "fixed". */
    price?: string;
  }>;
}

/**
 * Converte string BRL formatada ("1.500,00") → centavos (150000).
 * Aceita variações de input. Retorna 0 quando inválido.
 */
export function parsePriceBRLToCents(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Lista os `contentType`s exigidos pela campanha para uma rede específica.
 * Usa lowercase consistente — o caller pode passar profileType cru.
 */
export function getRequiredFormatsForNetwork(
  phases: ReadonlyArray<CampaignPhaseForCost>,
  network: string,
): string[] {
  const net = network.toLowerCase().trim();
  const out: string[] = [];
  for (const phase of phases) {
    for (const fmt of phase.formats ?? []) {
      if ((fmt.socialNetwork ?? "").toLowerCase() === net && fmt.contentType) {
        out.push(fmt.contentType);
      }
    }
  }
  return out;
}

/**
 * Custo de aprovação em centavos (BRL) para um card específico.
 *
 *  - "price" / "fixed" / "fixed_value": cálculo local com os dados disponíveis.
 *  - Outras modalidades (swap, cpa, cpm): retorna `null` (sem custo monetário).
 *
 * Retorna `null` quando dados insuficientes (ex.: "price" sem prices do
 * influenciador) — caller decide se permite aprovar sem gating.
 */
export function computeApprovalCostCents(
  paymentMethod: string | null | undefined,
  network: string,
  influencerPrices: Record<string, number> | undefined,
  phases: ReadonlyArray<CampaignPhaseForCost>,
): number | null {
  if (!paymentMethod) return null;
  const method = paymentMethod.toLowerCase();

  if (method === "price") {
    if (!influencerPrices) return null;
    const required = getRequiredFormatsForNetwork(phases, network);
    if (required.length === 0) return null; // campanha não usa essa rede
    const data = computePriceData(influencerPrices, required, network);
    return data?.totalCents ?? 0;
  }

  if (method === "fixed" || method === "fixed_value") {
    const net = network.toLowerCase().trim();
    let totalCents = 0;
    for (const phase of phases) {
      for (const fmt of phase.formats ?? []) {
        if ((fmt.socialNetwork ?? "").toLowerCase() !== net) continue;
        const unitCents = parsePriceBRLToCents(fmt.price);
        const qty = Math.max(1, parseInt(fmt.quantity ?? "1", 10) || 1);
        totalCents += unitCents * qty;
      }
    }
    return totalCents;
  }

  return null;
}

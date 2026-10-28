import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import { extractNicheFromApiRow } from "@/shared/utils/niche-display";

/** Perfil social em um item de seleção (documentação INFLUENCER_SELECTION_API.md) */
export interface InfluencerSelectionSocialNetwork {
  id: number;
  type: string;
  name: string;
  username: string;
  members: number;
  photo: string | null;
  /** Preços por formato definidos pelo influenciador (centavos). Presente quando payment_method === "price". */
  prices?: Record<string, number>;
}

export interface InfluencerSelectionUser {
  id: number;
  name: string;
  photo: string | null;
  gender: string | null;
}

export interface InfluencerSelectionProfileItem {
  social_network: InfluencerSelectionSocialNetwork;
  user: InfluencerSelectionUser;
  niche_ids: number[];
  /** Nome legível quando a API envia (ex.: niche_name). */
  niche_name?: string;
  /** Todos os nomes quando a API envia lista (ex.: nichos aninhados). */
  niche_names?: string[];
  /**
   * Engajamento (%) da conta — mesma definição do catálogo de criadores.
   * `null` quando a API ainda não tem métricas calculadas.
   */
  engagement?: number | null;
  /** Presente apenas em `recommended` */
  match_reason?: string;
}

export interface InfluencerSelectionNetworkGroup {
  type: string;
  label: string;
  recommended: InfluencerSelectionProfileItem[];
  catalog: InfluencerSelectionProfileItem[];
}

export interface CampaignInfluencerSelectionData {
  campaign: { id: string; title: string };
  networks: InfluencerSelectionNetworkGroup[];
}

function readRecord(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function normalizeSocialNetwork(
  raw: unknown
): InfluencerSelectionSocialNetwork | null {
  const o = readRecord(raw);
  if (!o) return null;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  let prices: Record<string, number> | undefined;
  const rawPrices = o.prices;
  if (rawPrices && typeof rawPrices === "object" && !Array.isArray(rawPrices)) {
    const parsed: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawPrices as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) parsed[k] = n;
    }
    if (Object.keys(parsed).length > 0) prices = parsed;
  }

  return {
    id,
    type: String(o.type ?? ""),
    name: String(o.name ?? ""),
    username: String(o.username ?? ""),
    members: Number(o.members ?? 0) || 0,
    photo: o.photo != null && o.photo !== "" ? String(o.photo) : null,
    prices,
  };
}

function normalizeUser(raw: unknown): InfluencerSelectionUser | null {
  const o = readRecord(raw);
  if (!o) return null;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    name: String(o.name ?? ""),
    photo: o.photo != null && o.photo !== "" ? String(o.photo) : null,
    gender: o.gender != null ? String(o.gender) : null,
  };
}

function normalizeProfileItem(raw: unknown): InfluencerSelectionProfileItem | null {
  const o = readRecord(raw);
  if (!o) return null;
  const sn = normalizeSocialNetwork(o.social_network ?? o.socialNetwork);
  const user = normalizeUser(o.user);
  if (!sn || !user) return null;
  const nicheRaw = o.niche_ids ?? o.nicheIds;
  const niche_ids: number[] = [];
  let niche_name: string | undefined;
  if (Array.isArray(nicheRaw)) {
    for (const x of nicheRaw) {
      if (typeof x === "number" && Number.isFinite(x)) {
        niche_ids.push(x);
        continue;
      }
      if (typeof x === "string" && x.trim()) {
        const n = Number(x);
        if (Number.isFinite(n)) niche_ids.push(n);
        continue;
      }
      if (x != null && typeof x === "object" && !Array.isArray(x)) {
        const ox = x as Record<string, unknown>;
        const id = Number(ox.id);
        if (Number.isFinite(id)) niche_ids.push(id);
        const nm = ox.name;
        if (typeof nm === "string" && nm.trim()) {
          niche_name = niche_name ?? nm.trim();
        }
      }
    }
  }
  const mr = o.match_reason ?? o.matchReason;
  const match_reason =
    typeof mr === "string" && mr.trim() ? mr.trim() : undefined;

  const engRaw = o.engagement;
  const engagement =
    typeof engRaw === "number" && Number.isFinite(engRaw)
      ? engRaw
      : engRaw == null
        ? null
        : Number.isFinite(Number(engRaw))
          ? Number(engRaw)
          : null;

  const nn = o.niche_name ?? o.nicheName;
  if (typeof nn === "string" && nn.trim()) niche_name = niche_name ?? nn.trim();

  let niche_names: string[] | undefined;
  if (Array.isArray(o.niche_names)) {
    const strs = o.niche_names
      .map((e) => (typeof e === "string" ? e.trim() : ""))
      .filter(Boolean);
    if (strs.length) {
      niche_names = strs;
      niche_name = niche_name ?? strs[0];
    }
  }

  const primaryNiche = o.primary_niche ?? o.primaryNiche;
  if (!niche_name && primaryNiche && typeof primaryNiche === "object") {
    const pn = primaryNiche as Record<string, unknown>;
    const pnm = pn.name;
    if (typeof pnm === "string" && pnm.trim()) niche_name = pnm.trim();
  }

  const subNm = o.sub_niche_name ?? o.subNicheName ?? o.subniche_name;
  if (typeof subNm === "string" && subNm.trim()) {
    niche_name = niche_name ?? subNm.trim();
  }

  const fromRoot = extractNicheFromApiRow(o);
  if (fromRoot.nicheName) niche_name = niche_name ?? fromRoot.nicheName;

  if (o.user && typeof o.user === "object") {
    const fromUser = extractNicheFromApiRow(o.user as Record<string, unknown>);
    if (fromUser.nicheName) niche_name = niche_name ?? fromUser.nicheName;
  }

  const nichesArr = o.niches ?? o.user_niches ?? o.influencer_niches;
  if (Array.isArray(nichesArr)) {
    for (const el of nichesArr) {
      if (el != null && typeof el === "object" && !Array.isArray(el)) {
        const en = el as Record<string, unknown>;
        const nm = en.name;
        if (typeof nm === "string" && nm.trim()) {
          niche_name = niche_name ?? nm.trim();
          break;
        }
      }
    }
  }

  return {
    social_network: sn,
    user,
    niche_ids,
    niche_name,
    niche_names,
    engagement,
    match_reason,
  };
}

function normalizeItems(arr: unknown): InfluencerSelectionProfileItem[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => normalizeProfileItem(item))
    .filter((x): x is InfluencerSelectionProfileItem => x != null);
}

function normalizeNetworkGroup(raw: unknown): InfluencerSelectionNetworkGroup | null {
  const o = readRecord(raw);
  if (!o) return null;
  const type = String(o.type ?? "");
  const label = String(o.label ?? type);
  return {
    type,
    label,
    recommended: normalizeItems(o.recommended),
    catalog: normalizeItems(o.catalog),
  };
}

/** Ordem sugerida no doc; tipos desconhecidos entram ao final */
const NETWORK_TYPE_ORDER = [
  "instagram",
  "instagram_facebook",
  "tiktok",
  "youtube",
  "ugc",
] as const;

const NETWORK_TYPE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  instagram_facebook: "Instagram / Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  ugc: "UGC",
};

function labelForNetworkType(typeKey: string): string {
  const k = typeKey.toLowerCase();
  return (
    NETWORK_TYPE_LABELS[k] ??
    (k ? k.charAt(0).toUpperCase() + k.slice(1) : "Outros")
  );
}

/**
 * API pode devolver listas planas em `data.recommended` e `data.catalog`
 * (em vez de `data.networks[]`). Agrupa por `social_network.type`.
 */
function buildNetworksFromRootLists(
  recommendedRaw: unknown,
  catalogRaw: unknown
): InfluencerSelectionNetworkGroup[] {
  const recommended = normalizeItems(recommendedRaw);
  const catalog = normalizeItems(catalogRaw);
  const byType = new Map<
    string,
    {
      recommended: InfluencerSelectionProfileItem[];
      catalog: InfluencerSelectionProfileItem[];
    }
  >();

  const bucket = (type: string) => {
    const k = type.toLowerCase().trim() || "_";
    let b = byType.get(k);
    if (!b) {
      b = { recommended: [], catalog: [] };
      byType.set(k, b);
    }
    return b;
  };

  for (const item of recommended) {
    bucket(item.social_network.type).recommended.push(item);
  }
  for (const item of catalog) {
    bucket(item.social_network.type).catalog.push(item);
  }

  const ordered: InfluencerSelectionNetworkGroup[] = [];

  for (const t of NETWORK_TYPE_ORDER) {
    const g = byType.get(t);
    if (g && (g.recommended.length > 0 || g.catalog.length > 0)) {
      ordered.push({
        type: t,
        label: labelForNetworkType(t),
        recommended: g.recommended,
        catalog: g.catalog,
      });
      byType.delete(t);
    }
  }

  const rest = Array.from(byType.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  for (const [t, g] of rest) {
    if (g.recommended.length > 0 || g.catalog.length > 0) {
      ordered.push({
        type: t,
        label: labelForNetworkType(t),
        recommended: g.recommended,
        catalog: g.catalog,
      });
    }
  }

  return ordered;
}

/**
 * Seleção de influenciadores por campanha: recomendados + catálogo por rede.
 * GET /campaigns/:campaignId/influencer-selection
 */
export async function getCampaignInfluencerSelection(
  campaignId: string,
  /**
   * Nicho selecionado na tela. Vai para o servidor porque o corte de 120
   * recomendados/catálogo acontece lá: filtrar só no cliente prendia a busca
   * aos 120 perfis com mais seguidores, sempre os mesmos.
   */
  nicheId?: string | number | null,
  /**
   * Busca por nome ou @handle. Vai para o servidor pelo mesmo motivo do nicho:
   * o corte de 120 acontece lá, então buscar só no cliente nunca encontrava
   * quem estivesse fora dos 120 perfis com mais seguidores.
   */
  search?: string | null
): Promise<CampaignInfluencerSelectionData> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const url = new URL(getApiUrl(`/campaigns/${campaignId}/influencer-selection`));
  if (nicheId != null && String(nicheId).trim() !== "") {
    url.searchParams.set("niche", String(nicheId));
  }
  if (search != null && search.trim() !== "") {
    url.searchParams.set("search", search.trim());
  }

  const request = await fetch(
    url.toString(),
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
    let err: unknown;
    try {
      err = await request.json();
    } catch {
      err = { message: "Failed to get campaign influencer selection" };
    }
    throw err || "Failed to get campaign influencer selection";
  }

  const response = await request.json();
  const data = readRecord(response.data);
  if (!data) {
    return {
      campaign: { id: campaignId, title: "" },
      networks: [],
    };
  }

  const campaignRaw = readRecord(data.campaign);
  const networksRaw = data.networks;
  const rootRecommended = data.recommended;
  const rootCatalog = data.catalog;

  const campaign = {
    id: String(campaignRaw?.id ?? campaignId),
    title: String(campaignRaw?.title ?? ""),
  };

  let networks: InfluencerSelectionNetworkGroup[];

  if (Array.isArray(networksRaw) && networksRaw.length > 0) {
    networks = networksRaw
      .map((n) => normalizeNetworkGroup(n))
      .filter((x): x is InfluencerSelectionNetworkGroup => x != null);
  } else if (Array.isArray(rootRecommended) || Array.isArray(rootCatalog)) {
    networks = buildNetworksFromRootLists(rootRecommended, rootCatalog);
  } else {
    networks = [];
  }

  return { campaign, networks };
}

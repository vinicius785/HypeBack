import { getApiUrl } from "@/lib/utils/api";

/** Contrato HTTP completo: `docs/api-public-campaign-invite.md`. */

/**
 * Resumo público da campanha (convite compartilhável).
 * Esperado no servidor: `GET /public/campaigns/:publicId/invite` sem auth.
 * Resposta: `{ "data": { ... } }` (mesmo padrão das demais rotas).
 */
/** Formato de entrega por rede em uma fase (convite público). */
export interface PublicInvitePhaseFormat {
  network: string;
  content_type?: string;
  quantity?: number;
}

export interface PublicInvitePhase {
  order: number;
  objective: string;
  post_date?: string;
  publish_time?: string;
  formats: PublicInvitePhaseFormat[];
}

export interface PublicCampaignInviteData {
  title: string;
  description: string;
  objective?: string;
  /** Valor bruto ou `{ value, label }` — use `getCampaignStatusDisplayLabel` na UI */
  status?: unknown;
  banner?: string | null;
  max_influencers?: number;
  segment_min_followers?: number;
  /** Nomes dos nichos raízes (parent_id: null), prontos para exibição. */
  niches?: string[];
  /** Nomes dos subnichos (parent_id != null), prontos para exibição. */
  secondary_niche_names?: string[];
  /** @deprecated use niches */
  primary_niche?: { name?: string };
  payment_method?: string;
  payment_method_details?: {
    amount?: number;
    currency?: string;
    description?: string;
  };
  benefits?: string[];
  rules_does?: string[];
  rules_does_not?: string[];
  image_rights_period?: number;
  /** Redes em que a campanha aceita participação (ex.: instagram, tiktok). */
  allowed_social_networks?: string[];
  /** Fases com objetivos, datas e formatos por rede. */
  phases?: PublicInvitePhase[];
}

const NESTED_TEXT_KEYS = [
  "label",
  "title",
  "name",
  "value",
  "text",
  "description",
  "pt",
  "pt_BR",
  "pt-BR",
  "en",
  "default",
] as const;

const BANNER_REF_KEYS = [
  "url",
  "path",
  "key",
  "src",
  "banner_url",
  "file_url",
] as const;

/** Evita `String(obj)` → "[object Object]" quando a API envia objeto ou i18n. */
function coerceDisplayText(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value === "string") {
    const t = value.trim();
    return t || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value) && value.length > 0) {
    return coerceDisplayText(value[0], fallback);
  }
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    for (const key of NESTED_TEXT_KEYS) {
      const hit = o[key];
      if (typeof hit === "string" && hit.trim()) return hit.trim();
    }
    for (const v of Object.values(o)) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return fallback;
}

function coerceBannerRef(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t || null;
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    for (const key of BANNER_REF_KEYS) {
      const hit = o[key];
      if (typeof hit === "string" && hit.trim()) return hit.trim();
    }
  }
  return null;
}

function asStringArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) {
    const out = v
      .map((x) => coerceDisplayText(x, "").trim())
      .filter(Boolean);
    return out.length ? out : undefined;
  }
  if (typeof v === "string" && v.trim()) {
    const lines = v
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.length ? lines : undefined;
  }
  return undefined;
}

function normalizePhaseFormats(formatsRaw: unknown): PublicInvitePhaseFormat[] {
  if (!Array.isArray(formatsRaw)) return [];
  const out: PublicInvitePhaseFormat[] = [];
  for (const item of formatsRaw) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const network = coerceDisplayText(
      f.type ?? f.social_network ?? f.socialNetwork ?? f.network,
      "",
    ).toLowerCase();
    const options = f.options;
    if (network && Array.isArray(options)) {
      for (const opt of options) {
        if (!opt || typeof opt !== "object") continue;
        const o = opt as Record<string, unknown>;
        const qty = o.quantity != null ? Number(o.quantity) : undefined;
        out.push({
          network,
          content_type: coerceDisplayText(o.type, "") || undefined,
          quantity: Number.isFinite(qty) ? qty : undefined,
        });
      }
      continue;
    }
    const sn = coerceDisplayText(f.socialNetwork ?? f.social_network, "").toLowerCase();
    const ct = coerceDisplayText(f.contentType ?? f.content_type, "") || undefined;
    const qRaw = f.quantity;
    const q = qRaw != null ? Number(qRaw) : undefined;
    const net = sn || network;
    if (net || ct) {
      out.push({
        network: net || "—",
        content_type: ct,
        quantity: Number.isFinite(q) ? q : undefined,
      });
    }
  }
  return out;
}

function normalizePhasesList(raw: unknown): PublicInvitePhase[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const phases: PublicInvitePhase[] = [];
  raw.forEach((p, i) => {
    if (!p || typeof p !== "object") return;
    const o = p as Record<string, unknown>;
    const objective = coerceDisplayText(o.objective, "");
    const formats = normalizePhaseFormats(o.formats);
    if (!objective && formats.length === 0) return;
    phases.push({
      order: o.order != null ? Number(o.order) : i + 1,
      objective: objective || `Fase ${i + 1}`,
      post_date: coerceDisplayText(o.post_date ?? o.postDate, "") || undefined,
      publish_time:
        coerceDisplayText(o.publish_time ?? o.post_time ?? o.postTime, "") || undefined,
      formats,
    });
  });
  return phases.length ? phases : undefined;
}

function normalizeAllowedSocialNetworks(
  raw: Record<string, unknown>,
  phases?: PublicInvitePhase[],
): string[] | undefined {
  const direct = raw.allowed_social_networks ?? raw.social_networks;
  if (Array.isArray(direct) && direct.length > 0) {
    const list = direct
      .map((x) => coerceDisplayText(x, "").toLowerCase())
      .filter(Boolean);
    if (list.length) return [...new Set(list)];
  }
  const segments = raw.segments as Record<string, unknown> | undefined;
  const sn = segments?.social_network ?? segments?.social_networks;
  if (Array.isArray(sn) && sn.length > 0) {
    const list = sn
      .map((x) => coerceDisplayText(x, "").toLowerCase())
      .filter(Boolean);
    if (list.length) return [...new Set(list)];
  }
  if (phases?.length) {
    const set = new Set<string>();
    for (const ph of phases) {
      for (const fo of ph.formats) {
        if (fo.network && fo.network !== "—") set.add(fo.network.toLowerCase());
      }
    }
    if (set.size) return [...set];
  }
  return undefined;
}

function extractNamesFromArray(arr: unknown): string[] {
  const names: string[] = [];
  if (!Array.isArray(arr)) return names;
  for (const item of arr) {
    if (item && typeof item === "object") {
      const name = coerceDisplayText((item as Record<string, unknown>).name, "");
      if (name) names.push(name);
    } else if (typeof item === "string" && item.trim()) {
      names.push(item.trim());
    }
  }
  return names;
}

function extractNicheNames(raw: Record<string, unknown>): string[] | undefined {
  const rootNames = extractNamesFromArray(raw.niches);
  // Fallback para primary_niche legado
  if (rootNames.length === 0 && raw.primary_niche) {
    const pn = raw.primary_niche as Record<string, unknown>;
    const name = coerceDisplayText(pn.name, "");
    if (name) rootNames.push(name);
  }
  return rootNames.length ? rootNames : undefined;
}

function extractSecondaryNicheNames(raw: Record<string, unknown>): string[] | undefined {
  const names = extractNamesFromArray(raw.secondary_niches);
  return names.length ? names : undefined;
}

function normalizePublicInvite(raw: Record<string, unknown>): PublicCampaignInviteData {
  const primary = raw.primary_niche as Record<string, unknown> | undefined;
  const paymentDetails = raw.payment_method_details as Record<string, unknown> | undefined;
  const phases = normalizePhasesList(raw.phases);

  return {
    title: coerceDisplayText(raw.title ?? raw.name, "Campanha"),
    description: coerceDisplayText(raw.description, ""),
    objective: (() => {
      const t = coerceDisplayText(raw.objective, "");
      return t || undefined;
    })(),
    status: raw.status ?? undefined,
    banner:
      coerceBannerRef(raw.banner) ??
      coerceBannerRef(raw.banner_url) ??
      null,
    max_influencers:
      raw.max_influencers != null ? Number(raw.max_influencers) : undefined,
    segment_min_followers:
      raw.segment_min_followers != null
        ? Number(raw.segment_min_followers)
        : undefined,
    niches: extractNicheNames(raw),
    secondary_niche_names: extractSecondaryNicheNames(raw),
    primary_niche: (() => {
      if (!primary || typeof primary !== "object") return undefined;
      const name = coerceDisplayText(primary.name, "");
      return name ? { name } : undefined;
    })(),
    payment_method: (() => {
      const pm = coerceDisplayText(raw.payment_method, "");
      return pm || undefined;
    })(),
    payment_method_details: paymentDetails
      ? {
        amount:
          paymentDetails.amount != null
            ? Number(paymentDetails.amount)
            : undefined,
        currency:
          paymentDetails.currency != null
            ? String(paymentDetails.currency)
            : undefined,
        description: (() => {
          const d = coerceDisplayText(paymentDetails.description, "");
          return d || undefined;
        })(),
      }
      : undefined,
    benefits: asStringArray(raw.benefits),
    rules_does: asStringArray(raw.rules_does),
    rules_does_not: asStringArray(raw.rules_does_not),
    image_rights_period:
      raw.image_rights_period != null
        ? Number(raw.image_rights_period)
        : undefined,
    phases,
    allowed_social_networks: normalizeAllowedSocialNetworks(raw, phases),
  };
}

export async function getPublicCampaignInvite(
  campaignPublicId: string
): Promise<PublicCampaignInviteData> {
  const request = await fetch(
    getApiUrl(`/public/campaigns/${campaignPublicId}/invite`),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!request.ok) {
    if (request.status === 404) {
      const err = new Error("Campanha não encontrada ou indisponível.") as Error & {
        status?: number;
      };
      err.status = 404;
      throw err;
    }
    let message = "Não foi possível carregar o convite.";
    try {
      const j = await request.json();
      message = String(j?.message ?? j?.error ?? message);
    } catch {
      /* ignore */
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = request.status;
    throw err;
  }

  const response = await request.json();
  const raw = (response?.data ?? response) as Record<string, unknown>;
  if (!raw || typeof raw !== "object") {
    throw new Error("Resposta inválida do servidor.");
  }
  return normalizePublicInvite(raw);
}

export interface PublicInviteSocialProfile {
  network: string;
  profile_url: string;
}

export interface PublicInvitePreRegisterPayload {
  name: string;
  email: string;
  /** Apenas dígitos; opcional conforme contrato da API */
  phone?: string;
  /** @deprecated Links livres (não verificados). Use verification_tokens. */
  social_profiles?: PublicInviteSocialProfile[];
  /** JWTs de verificação (um por rede conectada), emitidos pelo social-connect. */
  verification_tokens?: string[];
}

/** Redes que suportam OAuth efêmero (Instagram usa bio-code). */
export type SocialConnectNetwork = "tiktok" | "youtube" | "instagram";

/**
 * Origem do backend (onde a página de callback do popup é servida). O
 * `postMessage` do popup chega com `event.origin` = esta origem; o listener do
 * front valida contra ela.
 */
export function getBackendOrigin(): string {
  const serverUrl = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (!serverUrl) return "";
  try {
    return new URL(serverUrl).origin;
  } catch {
    return "";
  }
}

/**
 * Pede a URL de autorização OAuth (TikTok/YouTube) para conectar a conta no
 * convite. O front abre `auth_url` num popup.
 */
export async function getSocialConnectRedirect(
  campaignPublicId: string,
  network: "tiktok" | "youtube",
): Promise<{ auth_url: string; state: string }> {
  const url = new URL(getApiUrl(`/public/social-connect/${network}/redirect`));
  url.searchParams.set("campaign_public_id", campaignPublicId);

  const request = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!request.ok) {
    throw new Error("Não foi possível iniciar a conexão. Tente novamente.");
  }
  const response = await request.json();
  const data = response?.data ?? response;
  if (!data?.auth_url) {
    throw new Error("Resposta inválida do servidor.");
  }
  return { auth_url: String(data.auth_url), state: String(data.state ?? "") };
}

async function postIgVerify(
  path: "start" | "confirm",
  campaignPublicId: string,
  username: string,
): Promise<Record<string, unknown>> {
  const request = await fetch(
    getApiUrl(`/public/social-connect/instagram/verify/${path}`),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ campaign_public_id: campaignPublicId, username }),
    },
  );
  const response = await request.json().catch(() => ({}));
  if (!request.ok) {
    const message = String(
      response?.message ?? response?.error ?? "Não foi possível verificar a conta.",
    );
    const err = new Error(message) as Error & { status?: number };
    err.status = request.status;
    throw err;
  }
  return (response?.data ?? response) as Record<string, unknown>;
}

/** Instagram: inicia o desafio de bio e retorna o código a colar. */
export async function startInstagramVerify(
  campaignPublicId: string,
  username: string,
): Promise<{ handle: string; code: string; instructions: string; expires_in_minutes: number }> {
  const data = await postIgVerify("start", campaignPublicId, username);
  return {
    handle: String(data.handle ?? username),
    code: String(data.code ?? ""),
    instructions: String(data.instructions ?? ""),
    expires_in_minutes: Number(data.expires_in_minutes ?? 30),
  };
}

/** Instagram: confere a bio e retorna o token de verificação. */
export async function confirmInstagramVerify(
  campaignPublicId: string,
  username: string,
): Promise<{ verification_token: string; username: string; followers: number | null }> {
  const data = await postIgVerify("confirm", campaignPublicId, username);
  return {
    verification_token: String(data.verification_token ?? ""),
    username: String(data.username ?? username),
    followers: data.followers == null ? null : Number(data.followers),
  };
}

/** Payload do `postMessage` da página de callback do popup (TikTok/YouTube). */
export interface SocialConnectMessage {
  type: "hypeapp:social-connect";
  ok: boolean;
  network?: string;
  username?: string;
  verification_token?: string;
  followers?: number | null;
  avatar?: string | null;
  error?: string;
}

/**
 * Pré-cadastro pelo link público: vincula o influenciador à campanha em **inscrições** (`applications`).
 * Esperado no servidor: `POST /public/campaigns/:publicId/invite/pre-register` (JSON, sem auth).
 * Corpo: `{ name, email, phone?, target_stage, social_profiles? }`.
 */
export async function postPublicCampaignInvitePreRegister(
  campaignPublicId: string,
  payload: PublicInvitePreRegisterPayload,
): Promise<void> {
  const phoneDigits = payload.phone?.replace(/\D/g, "") ?? "";
  const body: Record<string, unknown> = {
    name: payload.name.trim(),
    email: payload.email.trim(),
    target_stage: "applications",
  };
  if (phoneDigits.length >= 10) body.phone = phoneDigits;
  if (payload.verification_tokens?.length) {
    body.verification_tokens = payload.verification_tokens.filter(
      (t) => typeof t === "string" && t.trim().length > 0,
    );
  }
  if (payload.social_profiles?.length) {
    body.social_profiles = payload.social_profiles.map((p) => ({
      network: p.network.trim().toLowerCase(),
      profile_url: p.profile_url.trim(),
    }));
  }

  const request = await fetch(
    getApiUrl(`/public/campaigns/${campaignPublicId}/invite/pre-register`),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!request.ok) {
    let message = "Não foi possível concluir o pré-cadastro.";
    try {
      const j = (await request.json()) as { message?: string; error?: string };
      message = String(j?.message ?? j?.error ?? message);
    } catch {
      /* ignore */
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = request.status;
    throw err;
  }
}

export interface PublicInviteDeclinePayload {
  name: string;
  email: string;
  phone?: string;
  /** Motivo aberto informado pelo influenciador */
  decline_reason: string;
}

/**
 * Recusa o convite com pré-cadastro (identificação) e motivo da recusa.
 * `POST /public/campaigns/:publicId/invite/decline` — JSON, sem auth.
 */
export async function postPublicCampaignInviteDecline(
  campaignPublicId: string,
  payload: PublicInviteDeclinePayload,
): Promise<void> {
  const phoneDigits = payload.phone?.replace(/\D/g, "") ?? "";
  const body: Record<string, unknown> = {
    name: payload.name.trim(),
    email: payload.email.trim(),
    decline_reason: payload.decline_reason.trim(),
  };
  if (phoneDigits.length >= 10) body.phone = phoneDigits;

  const request = await fetch(
    getApiUrl(`/public/campaigns/${campaignPublicId}/invite/decline`),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!request.ok) {
    let message = "Não foi possível registrar sua resposta.";
    try {
      const j = (await request.json()) as { message?: string; error?: string };
      message = String(j?.message ?? j?.error ?? message);
    } catch {
      /* ignore */
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = request.status;
    throw err;
  }
}

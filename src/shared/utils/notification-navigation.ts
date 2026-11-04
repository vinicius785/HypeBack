import type { Notification } from "@/shared/services/notifications";

/** IDs válidos das abas em `campaigns.$campaignId` */
export const CAMPAIGN_TAB_IDS = [
  "dashboard",
  "selection",
  "management",
  "contracts",
  "metrics",
] as const;

export type CampaignTabId = (typeof CAMPAIGN_TAB_IDS)[number];

const TAB_SET = new Set<string>(CAMPAIGN_TAB_IDS);

/** Telas removidas: tudo é feito no quadro de Gerenciamento e no painel do card. */
const LEGACY_BOARD_TABS = new Set(["applications", "curation", "proposals", "script-approval", "shipment", "approval"]);

function normalizeTab(tab: string | undefined): CampaignTabId | null {
  if (!tab) return null;
  const t = tab.trim().toLowerCase();
  return TAB_SET.has(t) ? (t as CampaignTabId) : null;
}

export interface CampaignDeepLinkSearch {
  tab: CampaignTabId;
  openChat?: string;
  focusCampaignUser?: string;
  contentId?: string;
}

/** Tipo da notificação do chat da equipe (mensagem de alguém do mesmo workspace). */
export const TEAM_CHAT_NOTIFICATION_TYPE = "team_chat_message";

/**
 * Notificação do chat da equipe → conversa a abrir na gaveta (aba Equipe), com o workspace dela (`metadata.workspace_id`,
 * ausente em notificação antiga). `null` quando não é uma notificação do chat da equipe ou não traz a conversa.
 */
export function resolveNotificationTeamChat(n: Notification): { conversationId: string; workspaceId?: string } | null {
  if (n.type !== TEAM_CHAT_NOTIFICATION_TYPE) return null;
  const id = n.metadata.conversation_id;
  if (id == null || String(id).trim() === "") return null;
  const ws = n.metadata.workspace_id;
  const workspaceId = ws == null || String(ws).trim() === "" ? undefined : String(ws);
  return { conversationId: String(id), ...(workspaceId ? { workspaceId } : {}) };
}

function focusFromMetadata(m: Notification["metadata"]): string | undefined {
  if (m.campaign_user_id != null && String(m.campaign_user_id).trim() !== "") {
    return String(m.campaign_user_id);
  }
  if (m.influencer_id != null && String(m.influencer_id).trim() !== "") {
    return String(m.influencer_id);
  }
  return undefined;
}

/**
 * Define aba e query params para abrir o contexto da notificação na campanha.
 */
export function resolveNotificationCampaignDeepLink(
  n: Notification
): CampaignDeepLinkSearch | null {
  const m = n.metadata;
  const campaignId = m.campaign_id;
  if (!campaignId) return null;

  const fromMeta = normalizeTab(m.target_tab);
  const typeLower = String(n.type || "").toLowerCase();
  const titleLower = (n.title || "").toLowerCase();
  const messageLower = (n.message || "").toLowerCase();
  const haystack = `${typeLower} ${titleLower} ${messageLower}`;

  // Conteúdo pendente de aprovação — prioridade sobre target_tab genérico
  if (m.content_id) {
    const focus = focusFromMetadata(m);
    return {
      tab: "management",
      contentId: m.content_id,
      ...(focus ? { focusCampaignUser: focus } : {}),
    };
  }

  // Inscrições, Curadoria e Propostas não são mais telas: o criador abre no painel do quadro.
  const rawTab = (m.target_tab ?? "").trim().toLowerCase();
  if (rawTab === "applications" || rawTab === "curation" || rawTab === "proposals" ||
    rawTab === "script-approval" || rawTab === "shipment" || rawTab === "approval") {
    const focus = focusFromMetadata(m);
    return { tab: "management", ...(focus ? { focusCampaignUser: focus } : {}) };
  }

  // API manda a aba explicitamente
  if (fromMeta) {
    const focus = focusFromMetadata(m);
    if (fromMeta === "management" && m.influencer_id != null) {
      return {
        tab: "management",
        openChat: String(m.influencer_id),
      };
    }
    return {
      tab: fromMeta,
      ...(focus ? { focusCampaignUser: focus } : {}),
    };
  }

  switch (n.type) {
    case "new_message":
      if (m.influencer_id != null) {
        return { tab: "management", openChat: String(m.influencer_id) };
      }
      return { tab: "management" };
    case "influencer_approved":
      if (m.influencer_id != null) {
        return { tab: "management", openChat: String(m.influencer_id) };
      }
      return { tab: "management" };
    case "content_approved":
    case "content_adjustment_requested":
    case "content_submitted":
    case "new_content_submission": {
      const focus = focusFromMetadata(m);
      return { tab: "management", ...(focus ? { focusCampaignUser: focus } : {}) };
    }
    case "shipment_receipt_confirmed": {
      const focus = focusFromMetadata(m);
      return { tab: "management", ...(focus ? { focusCampaignUser: focus } : {}) };
    }
    case "campaign_price_countered": {
      const focus = focusFromMetadata(m);
      return { tab: "management", ...(focus ? { focusCampaignUser: focus } : {}) };
    }
    default:
      break;
  }

  // Heurística para tipos novos da API (sem target_tab)
  if (
    /\bcuradoria\b/.test(haystack) ||
    haystack.includes("curation") ||
    haystack.includes("curat")
  ) {
    const focus = focusFromMetadata(m);
    return { tab: "management", ...(focus ? { focusCampaignUser: focus } : {}) };
  }
  if (
    haystack.includes("contraproposta") ||
    haystack.includes("proposta") ||
    haystack.includes("negocia")
  ) {
    const focus = focusFromMetadata(m);
    return { tab: "management", ...(focus ? { focusCampaignUser: focus } : {}) };
  }
  if (
    /\binscri/.test(haystack) ||
    haystack.includes("application") ||
    haystack.includes("pre_selection") ||
    haystack.includes("pre-selection")
  ) {
    const focus = focusFromMetadata(m);
    return { tab: "management", ...(focus ? { focusCampaignUser: focus } : {}) };
  }
  if (haystack.includes("contrat")) {
    return { tab: "contracts" };
  }
  if (haystack.includes("roteiro") || haystack.includes("script")) {
    const focus = focusFromMetadata(m);
    return { tab: "management", ...(focus ? { focusCampaignUser: focus } : {}) };
  }
  if (haystack.includes("métrica") || haystack.includes("metric")) {
    return { tab: "metrics" };
  }
  if (haystack.includes("seleção") || haystack.includes("selection")) {
    return { tab: "selection" };
  }

  const focus = focusFromMetadata(m);
  if (focus) {
    return { tab: "management", openChat: focus };
  }
  return { tab: "management" };
}

/** Parâmetros de deep link lidos da URL da campanha, sem tratamento. */
export interface IncomingCampaignDeepLink {
  tab: string | null;
  openChat: string | null;
  focusCampaignUser: string | null;
  contentId: string | null;
}

export type IncomingCampaignDeepLinkDecision =
  /** Nada a aplicar: sem parâmetros, ou sem aba nem destino que sirva. */
  | { type: "ignore" }
  /** Abrir `tab` (se houver), guardar os pendentes e limpar a URL. */
  | { type: "apply"; tab: string | null };

/**
 * Decide o que a página da campanha faz com o deep link vindo da notificação.
 */
export function decideIncomingCampaignDeepLink({
  link,
  visibleTabIds,
}: {
  link: IncomingCampaignDeepLink;
  visibleTabIds: ReadonlySet<string>;
}): IncomingCampaignDeepLinkDecision {
  const { openChat, focusCampaignUser, contentId } = link;
  // Links antigos (home, e-mails) para telas que viraram o painel do quadro.
  const tab = link.tab && LEGACY_BOARD_TABS.has(link.tab) ? "management" : link.tab;

  let target: string | null = tab && visibleTabIds.has(tab) ? tab : null;

  if (!target) {
    if (openChat && visibleTabIds.has("management")) target = "management";
    else if ((contentId || focusCampaignUser) && visibleTabIds.has("management"))
      target = "management";
  }

  if (!target && !openChat && !focusCampaignUser && !contentId) {
    return { type: "ignore" };
  }
  return { type: "apply", tab: target };
}

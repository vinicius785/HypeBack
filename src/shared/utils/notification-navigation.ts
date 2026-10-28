import type { Notification } from "@/shared/services/notifications";

/** IDs válidos das abas em `campaigns.$campaignId` */
export const CAMPAIGN_TAB_IDS = [
  "dashboard",
  "selection",
  "proposals",
  "applications",
  "curation",
  "shipment",
  "management",
  "contracts",
  "script-approval",
  "approval",
  "metrics",
] as const;

export type CampaignTabId = (typeof CAMPAIGN_TAB_IDS)[number];

const TAB_SET = new Set<string>(CAMPAIGN_TAB_IDS);

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
    return { tab: "approval", contentId: m.content_id };
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
    case "new_content_submission":
      return { tab: "approval" };
    case "shipment_receipt_confirmed": {
      const focus = focusFromMetadata(m);
      return { tab: "shipment", ...(focus ? { focusCampaignUser: focus } : {}) };
    }
    case "campaign_price_countered": {
      const focus = focusFromMetadata(m);
      return { tab: "proposals", ...(focus ? { focusCampaignUser: focus } : {}) };
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
    return { tab: "curation", ...(focus ? { focusCampaignUser: focus } : {}) };
  }
  if (
    haystack.includes("contraproposta") ||
    haystack.includes("proposta") ||
    haystack.includes("negocia")
  ) {
    const focus = focusFromMetadata(m);
    return { tab: "proposals", ...(focus ? { focusCampaignUser: focus } : {}) };
  }
  if (
    /\binscri/.test(haystack) ||
    haystack.includes("application") ||
    haystack.includes("pre_selection") ||
    haystack.includes("pre-selection")
  ) {
    const focus = focusFromMetadata(m);
    return { tab: "applications", ...(focus ? { focusCampaignUser: focus } : {}) };
  }
  if (haystack.includes("contrat")) {
    return { tab: "contracts" };
  }
  if (haystack.includes("roteiro") || haystack.includes("script")) {
    return { tab: "script-approval" };
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

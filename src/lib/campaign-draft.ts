/**
 * Rascunho da "Nova campanha". Fica no localStorage deste navegador (a API só cria campanha completa), por isso
 * a lista de campanhas lê daqui para mostrá-lo na aba Rascunhos.
 */
export const CAMPAIGN_DRAFT_KEY = "hypeapp-campaign-draft-new";

export interface CampaignDraftSummary {
  title: string;
  savedAt: string | null;
  workspaceId: string | null;
}

/** Resumo do rascunho salvo, ou `null` se não há (ou se pertence a outro workspace). */
export function readCampaignDraftSummary(workspaceId?: string | number | null): CampaignDraftSummary | null {
  try {
    const raw = localStorage.getItem(CAMPAIGN_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt?: unknown;
      workspaceId?: unknown;
      data?: { title?: unknown } | null;
    } | null;
    if (!parsed || typeof parsed !== "object" || !parsed.data || typeof parsed.data !== "object") return null;
    const saved = parsed.workspaceId == null ? null : String(parsed.workspaceId);
    // Rascunho antigo não tem workspace: continua valendo para quem o salvou.
    if (saved && workspaceId != null && saved !== String(workspaceId)) return null;
    const title = typeof parsed.data.title === "string" ? parsed.data.title.trim() : "";
    return {
      title,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
      workspaceId: saved,
    };
  } catch {
    return null;
  }
}

export function discardCampaignDraft(): void {
  try {
    localStorage.removeItem(CAMPAIGN_DRAFT_KEY);
  } catch {
    // localStorage indisponível — sem efeito.
  }
}

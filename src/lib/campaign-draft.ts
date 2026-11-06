/**
 * Rascunhos da "Nova campanha". Ficam no localStorage deste navegador (a API só cria campanha completa), por isso a
 * lista de campanhas lê daqui para mostrá-los na aba Rascunhos. Pode haver VÁRIOS: abrir "Nova campanha" começa uma
 * em branco, e cada rascunho salvo tem o seu id (`/campaigns/new?draft=<id>` o retoma).
 *
 * O armazenamento antigo guardava um rascunho só, em `CAMPAIGN_DRAFT_KEY`; na primeira leitura ele vira um item da
 * lista nova e a chave antiga é apagada.
 */
export const CAMPAIGN_DRAFT_KEY = "hypeapp-campaign-draft-new";
export const CAMPAIGN_DRAFTS_KEY = "hypeapp-campaign-drafts";

export interface CampaignDraftSummary {
  id: string;
  title: string;
  savedAt: string | null;
  workspaceId: string | null;
}

export interface StoredCampaignDraft<T = unknown> extends CampaignDraftSummary {
  step: number;
  data: T;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function newDraftId(): string {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalize(raw: unknown, fallbackId?: string): StoredCampaignDraft | null {
  if (!isObject(raw) || !isObject(raw.data)) return null;
  const id = typeof raw.id === "string" && raw.id ? raw.id : fallbackId;
  if (!id) return null;
  const title = typeof raw.data.title === "string" ? raw.data.title.trim() : "";
  return {
    id,
    title,
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null,
    workspaceId: raw.workspaceId == null ? null : String(raw.workspaceId),
    step: typeof raw.step === "number" ? raw.step : 1,
    data: raw.data,
  };
}

/** Todos os rascunhos guardados (qualquer workspace), do mais recente para o mais antigo. */
function readAll(): StoredCampaignDraft[] {
  let list: StoredCampaignDraft[] = [];
  try {
    const raw = localStorage.getItem(CAMPAIGN_DRAFTS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed.map((item) => normalize(item)).filter((d): d is StoredCampaignDraft => !!d);
    }
  } catch {
    list = [];
  }
  // Migração: o rascunho único de antes entra na lista (uma vez) e a chave antiga some.
  try {
    const legacyRaw = localStorage.getItem(CAMPAIGN_DRAFT_KEY);
    if (legacyRaw) {
      const legacy = normalize(JSON.parse(legacyRaw), newDraftId());
      if (legacy) list = [legacy, ...list];
      localStorage.removeItem(CAMPAIGN_DRAFT_KEY);
      writeAll(list);
    }
  } catch {
    // JSON inválido na chave antiga: ignora.
  }
  return list.sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
}

function writeAll(list: StoredCampaignDraft[]): void {
  try {
    localStorage.setItem(
      CAMPAIGN_DRAFTS_KEY,
      JSON.stringify(list.map(({ id, savedAt, workspaceId, step, data }) => ({ id, savedAt, workspaceId, step, data }))),
    );
  } catch {
    // localStorage indisponível — sem efeito.
  }
}

/** Resumos dos rascunhos do workspace (o antigo, sem workspace, vale para quem o salvou). */
export function listCampaignDrafts(workspaceId?: string | number | null): CampaignDraftSummary[] {
  return readAll()
    .filter((d) => !(d.workspaceId && workspaceId != null && d.workspaceId !== String(workspaceId)))
    .map(({ id, title, savedAt, workspaceId: ws }) => ({ id, title, savedAt, workspaceId: ws }));
}

/** O rascunho inteiro (com os dados do formulário), ou `null` se não existe mais. */
export function readCampaignDraft<T = unknown>(id: string): StoredCampaignDraft<T> | null {
  return (readAll().find((d) => d.id === id) as StoredCampaignDraft<T> | undefined) ?? null;
}

/** Grava (cria ou atualiza pelo `id`) e devolve o id. Falha de armazenamento devolve `null`. */
export function saveCampaignDraft(input: {
  id?: string | null;
  workspaceId: string | number | null;
  step: number;
  data: unknown;
}): string | null {
  try {
    const id = input.id || newDraftId();
    const next = normalize(
      {
        id,
        savedAt: new Date().toISOString(),
        workspaceId: input.workspaceId,
        step: input.step,
        data: input.data,
      },
      id,
    );
    if (!next) return null;
    writeAll([next, ...readAll().filter((d) => d.id !== id)]);
    return localStorage.getItem(CAMPAIGN_DRAFTS_KEY) ? id : null;
  } catch {
    return null;
  }
}

/** Apaga SÓ o rascunho indicado; os outros ficam. */
export function discardCampaignDraft(id: string): void {
  writeAll(readAll().filter((d) => d.id !== id));
}

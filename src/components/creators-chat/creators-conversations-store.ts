import type { Conversation } from "./creators-conversations";

/**
 * A lista de conversas é derivada das notificações `new_message` (a API não tem lista global), e as notificações
 * antigas saem da resposta com o tempo: a conversa sumia junto. Aqui a lista é lembrada neste navegador, por workspace,
 * e somada ao que as notificações trazem agora. Só guarda identificação e prévia (nunca o texto inteiro da conversa).
 */
const KEY = (workspaceId: string) => `hype:chat-convs:v1:${workspaceId}`;
const MAX_STORED = 300;

type Stored = Pick<Conversation, "id" | "campaignId" | "influencerId" | "name" | "avatar" | "campaign" | "preview" | "at">;

export function loadStoredConversations(workspaceId: string | null | undefined): Conversation[] {
  if (!workspaceId) return [];
  try {
    const raw = localStorage.getItem(KEY(workspaceId));
    const list = raw ? (JSON.parse(raw) as Stored[]) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((c) => c && typeof c.id === "string" && typeof c.campaignId === "string" && c.influencerId != null)
      .map((c) => ({ ...c, influencerId: String(c.influencerId), campaign: c.campaign ?? "", preview: c.preview ?? "", unread: 0 }));
  } catch {
    return [];
  }
}

export function saveStoredConversations(workspaceId: string | null | undefined, list: Conversation[]): void {
  if (!workspaceId) return;
  try {
    const slim: Stored[] = [...list]
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .slice(0, MAX_STORED)
      .map(({ id, campaignId, influencerId, name, avatar, campaign, preview, at }) => ({
        id,
        campaignId,
        influencerId,
        name,
        avatar,
        campaign,
        preview,
        at,
      }));
    localStorage.setItem(KEY(workspaceId), JSON.stringify(slim));
  } catch {
    // Sem armazenamento (navegação privada, cota cheia): a lista segue só com as notificações.
  }
}

/**
 * Soma as conversas lembradas às atuais. Para a mesma conversa vale a mais recente (prévia e hora), o não lido vem só das
 * notificações de agora e nome, foto e campanha preenchem o que estiver faltando.
 */
export function mergeConversations(current: Conversation[], stored: Conversation[]): Conversation[] {
  const map = new Map<string, Conversation>();
  for (const c of stored) map.set(c.id, c);
  for (const c of current) {
    const old = map.get(c.id);
    if (!old) {
      map.set(c.id, c);
      continue;
    }
    const newer = +new Date(c.at) >= +new Date(old.at);
    map.set(c.id, {
      ...(newer ? c : old),
      unread: c.unread,
      name: c.name || old.name,
      avatar: c.avatar || old.avatar,
      campaign: c.campaign || old.campaign,
    });
  }
  return [...map.values()].sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

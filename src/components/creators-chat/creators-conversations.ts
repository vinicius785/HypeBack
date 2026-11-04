import type { Notification } from "@/shared/services/notifications";

/** Conversa com um criador, derivada das notificações de chat da campanha. */
export interface Conversation {
  id: string;
  campaignId: string;
  influencerId: string;
  name: string;
  avatar?: string;
  campaign: string;
  preview: string;
  unread: number;
  at: string;
}

export const OPEN_CHAT_EVENT = "hype:open-chat";

export interface OpenChatRequest {
  campaignId: string;
  /** ID do usuário da plataforma (mesmo `influencer_id` das notificações de chat). */
  influencerId: string;
  name: string;
  avatar?: string;
  campaign?: string;
}

/** Abre a gaveta de mensagens já na conversa do criador. */
export function openChatDrawer(req: OpenChatRequest) {
  window.dispatchEvent(new CustomEvent<OpenChatRequest>(OPEN_CHAT_EVENT, { detail: req }));
}

/** Conversas derivadas das notificações `new_message` (a API não tem lista global). */
export function buildConversations(list: Notification[]): Conversation[] {
  const map = new Map<string, Conversation>();
  for (const n of list) {
    if (n.type !== "new_message") continue;
    const campaignId = n.metadata.campaign_id;
    const inf = n.metadata.influencer_id;
    if (!campaignId || inf == null) continue;
    const id = `${campaignId}:${inf}`;
    const cur = map.get(id);
    const unread = n.read_at ? 0 : 1;
    if (!cur) {
      map.set(id, {
        id,
        campaignId,
        influencerId: String(inf),
        name: n.boldText || n.title || "Criador",
        campaign: n.metadata.campaign_title || "",
        preview: n.message,
        unread,
        at: n.created_at,
      });
    } else {
      cur.unread += unread;
      if (new Date(n.created_at) > new Date(cur.at)) {
        cur.at = n.created_at;
        cur.preview = n.message;
      }
      if (!cur.campaign && n.metadata.campaign_title) cur.campaign = n.metadata.campaign_title;
    }
  }
  return [...map.values()].sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

/** Não lidas dos criadores (soma das notificações de chat de campanha ainda não lidas). */
export function countCreatorsUnread(list: Notification[]): number {
  return buildConversations(list).reduce((a, c) => a + c.unread, 0);
}

export const OPEN_TEAM_CHAT_EVENT = "hype:open-team-chat";

export interface OpenTeamChatRequest {
  /** Abre a conversa (canal ou 1 a 1) com este id. */
  conversationId?: string;
  /** Abre (ou cria) a conversa 1 a 1 com esta pessoa. */
  userId?: number;
  /**
   * Workspace da conversa (sino de outro workspace). A gaveta só atende o pedido quando o workspace atual é este;
   * quem pede troca de workspace antes (ver `notifications-dropdown`).
   */
  workspaceId?: string;
}

/** Abre a gaveta de mensagens na aba Equipe, já na conversa pedida (clique no sino, atalhos). */
export function openTeamChat(req: OpenTeamChatRequest = {}) {
  window.dispatchEvent(new CustomEvent<OpenTeamChatRequest>(OPEN_TEAM_CHAT_EVENT, { detail: req }));
}

import { MessageFlow } from "@/components/chat/message-flow";
import type { ChatLine } from "@/components/chat/flow";
import { hasReadThrough, type TeamChatAttachment, type TeamChatConversation, type TeamChatMessage } from "@/shared/services/team-chat";

/** Envio que ainda não virou mensagem do histórico (enviando, falhou, ou confirmado e esperando entrar). */
export interface PendingMessage {
  localId: string;
  body: string;
  attachments: TeamChatAttachment[];
  status: "sending" | "failed" | "sent";
  error?: string;
  /** UUID do envio (`client_id`): o mesmo em cada tentativa; a mensagem do servidor com o mesmo `client_id` substitui este balão. */
  clientId: string;
  createdAt: string;
  /** Id gravado pelo servidor; some da fila quando a mensagem aparece no histórico. */
  confirmedId?: string | null;
}

interface MessageListProps {
  conversation: TeamChatConversation;
  messages: TeamChatMessage[];
  pending: PendingMessage[];
  me: number | null;
  onRetry: (localId: string) => void;
  onDiscard: (localId: string) => void;
  /** Imagem terminou de carregar (ou falhou): a altura mudou, quem rola a lista decide se acompanha. */
  onMediaLoad?: () => void;
  /** Primeira mensagem não lida quando a conversa abriu: recebe o divisor "Novas mensagens". */
  unreadFromId?: string | null;
}

/** Mensagens do canal/1 a 1 e envios locais como `ChatLine`: estados e "Visto" saem dos dados reais da conversa. */
export function MessageList({ conversation, messages, pending, me, onRetry, onDiscard, onMediaLoad, unreadFromId }: MessageListProps) {
  const isChannel = conversation.kind === "channel";
  let lastOwnId: string | null = null;
  for (const m of messages) if (me != null && m.sender_id === me) lastOwnId = m.id;
  const peerRead = conversation.peer_last_read_message_id;
  const seenLast =
    !isChannel && pending.length === 0 && lastOwnId !== null && peerRead !== null && hasReadThrough(messages, peerRead, lastOwnId);

  const lines: ChatLine[] = messages.map((m) => {
    const mine = me != null && m.sender_id === me;
    const read = !isChannel && mine && peerRead !== null && hasReadThrough(messages, peerRead, m.id);
    return {
      id: m.id,
      mine,
      senderKey: String(m.sender_id),
      senderName: m.sender_name,
      senderAvatar: m.sender_avatar,
      body: m.body,
      attachments: m.attachments,
      createdAt: m.created_at,
      status: mine ? (read ? "read" : "sent") : undefined,
      seen: seenLast && m.id === lastOwnId,
    };
  });
  for (const p of pending) {
    lines.push({
      id: p.localId,
      localId: p.localId,
      mine: true,
      senderKey: me != null ? String(me) : "me",
      senderName: "Você",
      body: p.body,
      attachments: p.attachments,
      createdAt: p.createdAt,
      status: p.status === "failed" ? "failed" : p.status === "sent" ? "sent" : "sending",
      error: p.error,
    });
  }

  return (
    <MessageFlow
      lines={lines}
      unreadFromId={unreadFromId}
      handlers={{
        onMediaLoad,
        onRetry: (l) => l.localId && onRetry(l.localId),
        onDiscard: (l) => l.localId && onDiscard(l.localId),
      }}
    />
  );
}

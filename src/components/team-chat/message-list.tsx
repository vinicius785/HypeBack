import { Av, I } from "@/components/prototype/ui";
import { hasReadThrough, type TeamChatAttachment, type TeamChatConversation, type TeamChatMessage } from "@/shared/services/team-chat";
import { clockTime, dayLabel } from "@/shared/utils/chat-time";

import { MessageAttachments } from "./message-attachments";

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
}

function Bubble({ body, attachments, onMediaLoad }: { body: string; attachments: TeamChatAttachment[]; onMediaLoad?: () => void }) {
  return (
    <>
      {body.trim() !== "" && <div className="cm-b tc-b">{body}</div>}
      <MessageAttachments attachments={attachments} onMediaLoad={onMediaLoad} />
    </>
  );
}

/** Mensagens agrupadas por dia, com "Visto" só abaixo da última mensagem própria no 1 a 1. */
export function MessageList({ conversation, messages, pending, me, onRetry, onDiscard, onMediaLoad }: MessageListProps) {
  const isChannel = conversation.kind === "channel";
  let lastOwnId: string | null = null;
  for (const m of messages) if (me != null && m.sender_id === me) lastOwnId = m.id;
  const hasOwnPending = pending.length > 0;
  const peerRead = conversation.peer_last_read_message_id;
  const seen =
    !isChannel && !hasOwnPending && lastOwnId !== null && peerRead !== null && hasReadThrough(messages, peerRead, lastOwnId);

  let lastDay = "";
  return (
    <>
      {messages.map((m) => {
        const day = dayLabel(m.created_at);
        const sep = day !== lastDay;
        lastDay = day;
        const mine = me != null && m.sender_id === me;
        return (
          <div key={m.id} style={{ display: "contents" }}>
            {sep && (
              <div className="cm-d">
                <span>{day}</span>
              </div>
            )}
            <div className={`cm ${mine ? "me" : "them"}`}>
              {!mine && <Av name={m.sender_name} src={m.sender_avatar ?? undefined} size={28} />}
              <div className="cm-w">
                {!mine && isChannel && <small>{m.sender_name}</small>}
                <Bubble body={m.body} attachments={m.attachments} onMediaLoad={onMediaLoad} />
                <small className="cm-t">{clockTime(m.created_at)}</small>
                {seen && m.id === lastOwnId && <small className="cm-t tc-seen">Visto</small>}
              </div>
            </div>
          </div>
        );
      })}
      {pending.map((p) => {
        const day = dayLabel(p.createdAt);
        const sep = day !== lastDay;
        lastDay = day;
        return (
          <div key={p.localId} style={{ display: "contents" }}>
            {sep && (
              <div className="cm-d">
                <span>{day}</span>
              </div>
            )}
            <div className={`cm me tc-pend${p.status === "failed" ? " fail" : ""}`}>
              <div className="cm-w">
                <Bubble body={p.body} attachments={p.attachments} onMediaLoad={onMediaLoad} />
                {p.status === "sending" && <small className="cm-t">Enviando...</small>}
                {p.status === "failed" && (
                  <small className="cm-t tc-err" role="alert">
                    {p.error || "Não foi possível enviar."}
                    <button type="button" onClick={() => onRetry(p.localId)}>
                      <I n="refresh" cls="sm" />
                      Tentar de novo
                    </button>
                    <button type="button" onClick={() => onDiscard(p.localId)}>
                      Descartar
                    </button>
                  </small>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

import { useEffect, useRef, useState } from "react";

import { Av, I } from "@/components/prototype/ui";
import type { LiveComment } from "@/shared/types";

/** Formata ISO → "18:32" (hora local). */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

interface LiveChatProps {
  comments: LiveComment[];
  /** Sala ainda não está no ar (não há chat). */
  idle?: boolean;
  /** Texto do estado ocioso (padrão: chat aparece quando a live começar). */
  idleText?: string;
  connected?: boolean;
  onSend?: (content: string) => boolean;
}

export function LiveChat({ comments, idle, idleText, connected = false, onSend }: LiveChatProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  // Auto-scroll para a mensagem mais recente.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  const send = () => {
    if (onSend?.(draft)) setDraft("");
  };

  return (
    <div className="lvs-c">
      <div className="lvs-ch" ref={listRef}>
        {idle ? (
          <div className="lvs-sy">{idleText ?? "O chat aparece aqui quando a live começar."}</div>
        ) : comments.length === 0 ? (
          <div className="lvs-sy">
            Ainda sem mensagens. Os comentários aparecem aqui em tempo real.
          </div>
        ) : (
          comments.map((c) => (
            <div className="lvs-ms" key={c.id}>
              <Av name={c.author.name} src={c.author.avatar_url ?? undefined} size={30} />
              <div title={`${formatTime(c.created_at)} · ${new Date(c.created_at).toLocaleString("pt-BR")}`}>
                <b>{c.author.name}</b>
                <p>{c.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
      {!idle && onSend && (
        <form
          className="lvs-in"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <input
            id="live-chat-message"
            aria-label="Mensagem no chat da live"
            maxLength={200}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={connected ? "Escreva no chat" : "Reconectando ao chat…"}
            disabled={!connected}
            autoComplete="off"
          />
          <button
            type="submit"
            className="ch-send"
            aria-label="Enviar mensagem"
            disabled={!connected || draft.trim().length === 0}
          >
            <I n="send" cls="sm" />
          </button>
        </form>
      )}
    </div>
  );
}

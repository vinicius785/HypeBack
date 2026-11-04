import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Av, I } from "@/components/prototype/ui";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useInfluencerMessages, useSendMessage } from "@/hooks/use-campaign-chat";
import { useMarkChatNotificationsAsRead } from "@/hooks/use-notifications";
import { dayLabel } from "@/shared/utils/chat-time";

import type { Conversation } from "./creators-conversations";

/** Conversa aberta com um criador (chat da campanha). */
export function CreatorThread({
  conv,
  onBack,
  onOpenCampaign,
}: {
  conv: Conversation;
  onBack: () => void;
  onOpenCampaign: () => void;
}) {
  const { user } = useCurrentUser();
  const me = user?.id != null ? String(user.id) : null;
  const { data: messages = [], isLoading } = useInfluencerMessages(conv.campaignId, conv.influencerId);
  const send = useSendMessage(conv.campaignId, conv.influencerId);
  const markRead = useMarkChatNotificationsAsRead();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    if (markedRef.current === conv.id) return;
    markedRef.current = conv.id;
    markRead.mutate(
      { campaignId: conv.campaignId, influencerId: conv.influencerId },
      { onError: () => (markedRef.current = null) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = (value: string) => {
    const message = value.trim();
    if (!message || send.isPending) return;
    send.mutate(
      { message },
      {
        onSuccess: () => setText(""),
        onError: () => toast.error("Não foi possível enviar a mensagem."),
      },
    );
  };

  let lastDay = "";
  return (
    <>
      <div className="ch-th">
        <button type="button" className="round ch-bk" onClick={onBack} aria-label="Voltar às conversas">
          <I n="back" cls="sm" />
        </button>
        <Av name={conv.name} src={conv.avatar} size={46} />
        <div>
          <b>{conv.name}</b>
          <small>{conv.campaign || "Conversa da campanha"}</small>
        </div>
        <span className="gap" />
        <button type="button" className="btn out" onClick={onOpenCampaign}>
          <I n="mega" cls="sm" />
          Abrir campanha
        </button>
      </div>
      <div className="ch-tb">
        {isLoading ? (
          <div className="ov-empty"><small>Carregando mensagens...</small></div>
        ) : messages.length === 0 ? (
          <div className="ov-empty big">
            <span><I n="msg" /></span>
            <b>Sem mensagens ainda</b>
            <small>Envie a primeira mensagem abaixo.</small>
          </div>
        ) : (
          messages.map((m) => {
            const day = dayLabel(m.created_at);
            const sep = day !== lastDay;
            lastDay = day;
            const mine = me != null && String(m.sender_id) === me;
            return (
              <div key={m.id} style={{ display: "contents" }}>
                {sep && (
                  <div className="cm-d"><span>{day}</span></div>
                )}
                <div className={`cm ${mine ? "me" : "them"}`}>
                  {!mine && <Av name={m.sender_name || conv.name} src={m.sender_avatar || conv.avatar || undefined} size={28} />}
                  <div className="cm-w">
                    <div className="cm-b">{m.message}</div>
                    <small className="cm-t">
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </small>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="ch-f">
        <div className="ch-in">
          <input
            placeholder="Escreva uma mensagem"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(text);
            }}
          />
          <button type="button" className="ch-send" onClick={() => submit(text)} aria-label="Enviar" disabled={send.isPending}>
            <I n="send" cls="sm" />
          </button>
        </div>
      </div>
    </>
  );
}

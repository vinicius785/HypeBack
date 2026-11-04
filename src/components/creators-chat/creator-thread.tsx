import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChatComposer } from "@/components/chat/composer";
import type { ChatLine } from "@/components/chat/flow";
import { MessageFlow } from "@/components/chat/message-flow";
import { useIncomingSound } from "@/components/chat/use-incoming-sound";
import { useSmartScroll } from "@/components/chat/use-smart-scroll";
import { Av, I } from "@/components/prototype/ui";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useInfluencerMessages, useSendMessage } from "@/hooks/use-campaign-chat";
import { useMarkChatNotificationsAsRead } from "@/hooks/use-notifications";
import { uploadChatAttachment } from "@/shared/services/chat";
import type { TeamChatAttachment } from "@/shared/services/team-chat";
import type { ChatMessage } from "@/shared/types";

import type { Conversation } from "./creators-conversations";

const MAX_BODY = 5000;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|heif)(\?|#|$)/i;

/** O chat das campanhas guarda só a URL do anexo: nome e tipo saem do endereço. */
function attachmentFromUrl(url: string): TeamChatAttachment {
  const name = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || "Arquivo");
  return { url, name, mime_type: IMAGE_EXT.test(url) ? "image/*" : "application/octet-stream", size: 0 };
}

interface Pending {
  localId: string;
  body: string;
  attachments: TeamChatAttachment[];
  status: "sending" | "failed" | "sent";
  error?: string;
  createdAt: string;
  confirmedId?: string;
}

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
  const { data = [], isLoading } = useInfluencerMessages(conv.campaignId, conv.influencerId);
  const messages: ChatMessage[] = useMemo(
    () => [...data].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [data],
  );
  const send = useSendMessage(conv.campaignId, conv.influencerId);
  const markRead = useMarkChatNotificationsAsRead();
  const [pending, setPending] = useState<Pending[]>([]);
  const [unreadFromId, setUnreadFromId] = useState<string | null>(null);
  const markedRef = useRef<string | null>(null);
  const unreadInit = useRef(false);

  useEffect(() => {
    if (markedRef.current === conv.id) return;
    markedRef.current = conv.id;
    markRead.mutate(
      { campaignId: conv.campaignId, influencerId: conv.influencerId },
      { onError: () => (markedRef.current = null) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.id]);

  // Onde começam as não lidas quando a conversa abriu (fica fixo: ler não apaga o divisor).
  useEffect(() => {
    if (unreadInit.current || isLoading || messages.length === 0) return;
    unreadInit.current = true;
    const first = messages.find((m) => String(m.sender_id) !== me && m.read_at == null);
    setUnreadFromId(first?.id ?? null);
  }, [isLoading, messages, me]);

  // A mensagem confirmada entra no histórico: o balão local sai.
  useEffect(() => {
    const ids = new Set(messages.map((m) => m.id));
    setPending((cur) => {
      const next = cur.filter((p) => !(p.status === "sent" && p.confirmedId && ids.has(p.confirmedId)));
      return next.length === cur.length ? cur : next;
    });
  }, [messages]);

  const dispatch = useCallback(
    async (item: Pending) => {
      setPending((cur) =>
        cur.map((p) => (p.localId === item.localId ? { ...p, status: "sending", error: undefined } : p)),
      );
      try {
        const sent = await send.mutateAsync({ message: item.body, attachments: item.attachments.map((a) => a.url) });
        setPending((cur) =>
          cur.map((p) => (p.localId === item.localId ? { ...p, status: "sent", confirmedId: sent?.id } : p)),
        );
      } catch (error) {
        const text =
          error instanceof Error && error.message
            ? error.message
            : typeof (error as { message?: unknown })?.message === "string"
              ? (error as { message: string }).message
              : "Não foi possível enviar a mensagem.";
        setPending((cur) => cur.map((p) => (p.localId === item.localId ? { ...p, status: "failed", error: text } : p)));
      }
    },
    [send],
  );

  const handleSend = ({ body, attachments }: { body: string; attachments: TeamChatAttachment[] }) => {
    const item: Pending = {
      localId: `p${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      body,
      attachments,
      status: "sending",
      createdAt: new Date().toISOString(),
    };
    setPending((cur) => [...cur, item]);
    void dispatch(item);
  };

  const lines: ChatLine[] = useMemo(() => {
    const own = (id: string | number) => me != null && String(id) === me;
    const out: ChatLine[] = messages.map((m) => ({
      id: m.id,
      mine: own(m.sender_id),
      senderKey: String(m.sender_id),
      senderName: m.sender_name || conv.name,
      senderAvatar: m.sender_avatar || conv.avatar || null,
      body: m.message,
      attachments: (m.attachments ?? []).map(attachmentFromUrl),
      createdAt: m.created_at,
      status: own(m.sender_id) ? (m.read_at ? "read" : "sent") : undefined,
    }));
    for (const p of pending) {
      if (p.status === "sent" && p.confirmedId && messages.some((m) => m.id === p.confirmedId)) continue;
      out.push({
        id: p.localId,
        localId: p.localId,
        mine: true,
        senderKey: me ?? "me",
        senderName: "Você",
        body: p.body,
        attachments: p.attachments,
        createdAt: p.createdAt,
        status: p.status === "failed" ? "failed" : p.status === "sent" ? "sent" : "sending",
        error: p.error,
      });
    }
    return out;
  }, [messages, pending, me, conv.name, conv.avatar]);

  const lastIncoming = [...messages].reverse().find((m) => String(m.sender_id) !== me);
  useIncomingSound(lastIncoming?.id ?? null, !isLoading);

  const scroll = useSmartScroll({
    count: lines.length,
    lastMine: lines.length > 0 && lines[lines.length - 1].mine,
    ready: !isLoading,
  });

  const sending = pending.some((p) => p.status === "sending");

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
      <div
        className="ch-tb cx-tb"
        ref={scroll.ref}
        onScroll={scroll.onScroll}
        role="log"
        aria-label={`Mensagens: ${conv.name}`}
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
      >
        {isLoading ? (
          <div className="ov-empty" role="status">
            <small>Carregando mensagens...</small>
          </div>
        ) : lines.length === 0 ? (
          <div className="ov-empty big">
            <span>
              <I n="msg" />
            </span>
            <b>Sem mensagens ainda</b>
            <small>Envie a primeira mensagem abaixo.</small>
          </div>
        ) : (
          <MessageFlow
            lines={lines}
            unreadFromId={unreadFromId}
            handlers={{
              onMediaLoad: scroll.onMediaLoad,
              onRetry: (l) => {
                const item = pending.find((p) => p.localId === l.localId);
                if (item) void dispatch(item);
              },
              onDiscard: (l) => setPending((cur) => cur.filter((p) => p.localId !== l.localId)),
            }}
          />
        )}
      </div>
      {scroll.missed > 0 && (
        <button type="button" className="tc-jump" onClick={scroll.jump}>
          <I n="arrdown" cls="sm" />
          {scroll.missed === 1 ? "1 nova mensagem" : `${scroll.missed} novas mensagens`}
        </button>
      )}
      <ChatComposer
        conversationId={conv.id}
        blockedReason={null}
        sending={sending}
        maxBody={MAX_BODY}
        upload={(file) => uploadChatAttachment(conv.campaignId, conv.influencerId, file)}
        onSend={handleSend}
      />
    </>
  );
}

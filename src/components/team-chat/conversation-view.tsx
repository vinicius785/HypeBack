import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Av, I } from "@/components/prototype/ui";
import { orderedMessages, useTeamChatMessages } from "@/hooks/use-team-chat-queries";
import type { TeamChatController } from "@/hooks/use-team-chat";
import { generateIdempotencyKey } from "@/shared/utils/idempotency-key";
import { isTeamChatUnavailable, type TeamChatAttachment, type TeamChatConversation } from "@/shared/services/team-chat";

import { Composer } from "./composer";
import { MessageList, type PendingMessage } from "./message-list";

interface ConversationViewProps {
  conversation: TeamChatConversation;
  chat: TeamChatController;
  /** `user_id` de quem está logado (para saber quais balões são meus). */
  me: number | null;
  onBack: () => void;
}

const NEAR_BOTTOM_PX = 120;
/** Depois de carregar o histórico (ou uma página anterior) o leitor de tela volta a anunciar só o que for chegando. */
const ANNOUNCE_DELAY_MS = 400;

function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

/** Conversa aberta: cabeçalho, histórico (carregar anteriores, rolagem, leitura) e campo de envio. */
export function ConversationView({ conversation, chat, me, onBack }: ConversationViewProps) {
  const query = useTeamChatMessages(conversation.id);
  const messages = useMemo(() => orderedMessages(query.data), [query.data]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [showJump, setShowJump] = useState(false);
  // Onde começam as não lidas quando a conversa abriu: recebe o divisor "Novas mensagens" (fixo enquanto está aberta).
  const [unreadFromId, setUnreadFromId] = useState<string | null>(null);
  const unreadInitRef = useRef(false);
  const initialScrollRef = useRef(false);
  // Anúncio do leitor de tela (`aria-live`): desligado enquanto o histórico entra (primeira carga e páginas anteriores),
  // ligado só para as mensagens que chegam depois.
  const [announce, setAnnounce] = useState(false);
  const [quietOlder, setQuietOlder] = useState(false);
  const visible = useDocumentVisible();
  const bodyRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const keepOffsetRef = useRef<number | null>(null);
  const { focusConversation, blurConversation, markRead, sendMessage } = chat;

  // A conversa aberta e visível é o que o servidor usa para não avisar no sino.
  useEffect(() => {
    if (visible) focusConversation(conversation.id);
    else blurConversation(conversation.id);
    return () => blurConversation(conversation.id);
  }, [visible, conversation.id, focusConversation, blurConversation]);

  // Leitura: ao abrir com não lidas, ou quando chega mensagem de outra pessoa com a conversa aberta.
  const newestSeenRef = useRef<string | null>(null);
  const markedRef = useRef<string | null>(null);
  const newest = messages.length > 0 ? messages[messages.length - 1] : null;
  const unread = conversation.unread;
  const blocked = chat.blocked !== null;
  useEffect(() => {
    if (!newest) return;
    const previous = newestSeenRef.current;
    newestSeenRef.current = newest.id;
    if (!visible || blocked) return;
    const arrivedWhileOpen = previous !== null && previous !== newest.id && newest.sender_id !== me;
    if (unread === 0 && !arrivedWhileOpen) return;
    // Ids são UUID (sem ordem): `newest` é sempre a última da lista, então basta não repetir a mesma.
    if (markedRef.current === newest.id) return;
    markedRef.current = newest.id;
    markRead(conversation.id, newest.id);
  }, [newest, unread, visible, blocked, me, conversation.id, markRead]);

  useEffect(() => {
    if (unreadInitRef.current || query.isLoading || messages.length === 0) return;
    unreadInitRef.current = true;
    const n = conversation.unread;
    if (n <= 0) return;
    const others = messages.filter((m) => m.sender_id !== me);
    setUnreadFromId(others[others.length - n]?.id ?? others[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isLoading, messages.length]);

  // Rolagem: abre na última mensagem; mensagem nova só puxa para baixo se a pessoa já estava lá embaixo.
  const lastId = newest?.id ?? null;
  const firstId = messages.length > 0 ? messages[0].id : null;
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (keepOffsetRef.current !== null) {
      // Chegaram mensagens mais antigas no topo: mantém o que a pessoa lia no mesmo lugar.
      el.scrollTop += el.scrollHeight - keepOffsetRef.current;
      keepOffsetRef.current = null;
      return;
    }
    const divider = !initialScrollRef.current ? el.querySelector<HTMLElement>("[data-new-divider]") : null;
    if (divider && el.scrollHeight > el.clientHeight) {
      // Abriu com não lidas: começa no divisor "Novas mensagens", sem puxar para o fim.
      initialScrollRef.current = true;
      el.scrollTop = Math.max(0, divider.offsetTop - 56);
      stickRef.current = false;
      return;
    }
    if (stickRef.current) {
      el.scrollTop = el.scrollHeight;
      setShowJump(false);
    } else if (lastId) {
      setShowJump(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId, firstId, pending.length, unreadFromId]);

  // A página anterior terminou de carregar (ou falhou): o ajuste de rolagem pendente não vale mais. Efeito passivo roda
  // depois do layout que o consome, então só limpa o que sobrou.
  useEffect(() => {
    if (!query.isFetchingNextPage) keepOffsetRef.current = null;
  }, [query.isFetchingNextPage]);

  const onScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    stickRef.current = near;
    if (near) setShowJump(false);
  };

  const loadOlder = () => {
    const el = bodyRef.current;
    if (el) keepOffsetRef.current = el.scrollHeight;
    setQuietOlder(true);
    void query.fetchNextPage().finally(() => setTimeout(() => setQuietOlder(false), ANNOUNCE_DELAY_MS));
  };

  // Imagem que carrega depois da rolagem aumenta a altura: quem estava no fim continua no fim.
  const onMediaLoad = useCallback(() => {
    const el = bodyRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, []);

  const jumpToEnd = () => {
    const el = bodyRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTop = el.scrollHeight;
    setShowJump(false);
  };

  // Envio: o balão aparece na hora ("Enviando..."); se falhar fica com "Tentar de novo" (mesmo `client_id`: o servidor
  // grava uma mensagem só, mesmo que a primeira tentativa tenha chegado e só a resposta tenha se perdido).
  const dispatch = useCallback(
    async (item: PendingMessage) => {
      setPending((cur) => cur.map((p) => (p.localId === item.localId ? { ...p, status: "sending", error: undefined } : p)));
      try {
        const sent = await sendMessage(conversation.id, {
          body: item.body,
          attachments: item.attachments,
          clientId: item.clientId,
        });
        setPending((cur) =>
          sent
            ? cur.map((p) => (p.localId === item.localId ? { ...p, status: "sent", confirmedId: sent.id } : p))
            : cur.filter((p) => p.localId !== item.localId),
        );
      } catch (error) {
        const text = error instanceof Error && error.message ? error.message : "Não foi possível enviar.";
        setPending((cur) => cur.map((p) => (p.localId === item.localId ? { ...p, status: "failed", error: text } : p)));
      }
    },
    [conversation.id, sendMessage],
  );

  const handleSend = (input: { body: string; attachments: TeamChatAttachment[] }) => {
    stickRef.current = true;
    const item: PendingMessage = {
      localId: `p${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      body: input.body,
      attachments: input.attachments,
      status: "sending",
      clientId: generateIdempotencyKey(),
      createdAt: new Date().toISOString(),
    };
    setPending((cur) => [...cur, item]);
    void dispatch(item);
  };

  // A mensagem do servidor substitui o balão otimista: pelo id confirmado ou, em qualquer estado (inclusive "falhou" quando
  // só a resposta se perdeu), pelo `client_id` que o servidor devolve. Assim nunca aparece duas vezes.
  const knownIds = useMemo(() => new Set(messages.map((m) => m.id)), [messages]);
  const knownClientIds = useMemo(
    () => new Set(messages.map((m) => m.client_id).filter((id): id is string => id !== null)),
    [messages],
  );
  const isDelivered = useCallback(
    (p: PendingMessage) => knownClientIds.has(p.clientId) || (p.status === "sent" && !!p.confirmedId && knownIds.has(p.confirmedId)),
    [knownClientIds, knownIds],
  );
  useEffect(() => {
    setPending((cur) => {
      const next = cur.filter((p) => !isDelivered(p));
      return next.length === cur.length ? cur : next;
    });
  }, [isDelivered]);
  const visiblePending = pending.filter((p) => !isDelivered(p));

  const retry = (localId: string) => {
    const item = pending.find((p) => p.localId === localId);
    if (item) void dispatch(item);
  };
  const discard = (localId: string) => setPending((cur) => cur.filter((p) => p.localId !== localId));

  const isChannel = conversation.kind === "channel";
  const peer = conversation.peer;
  const loading = query.isLoading;

  // Primeira carga: o log só passa a anunciar depois que o histórico já está na tela.
  useEffect(() => {
    if (loading) {
      setAnnounce(false);
      return;
    }
    const t = setTimeout(() => setAnnounce(true), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(t);
  }, [loading]);
  const failed = query.isError && messages.length === 0;
  const empty = !loading && !failed && messages.length === 0 && visiblePending.length === 0;

  return (
    <>
      <div className="ch-th">
        <button type="button" className="round ch-bk" onClick={onBack} aria-label="Voltar às conversas">
          <I n="back" cls="sm" />
        </button>
        {isChannel ? (
          <span className="ch-g tc-ch" style={{ width: 46, height: 46 }} aria-hidden="true">
            <I n="users" />
          </span>
        ) : (
          <Av name={peer?.name ?? conversation.title} src={peer?.avatar ?? undefined} size={46} />
        )}
        <div>
          <b>{isChannel ? "Equipe" : (peer?.name ?? conversation.title)}</b>
          <small>
            {isChannel ? "Canal geral · todos do workspace" : "Conversa direta"}
            {!chat.isConnected && !chat.blocked && <span className="tc-off"> · reconectando...</span>}
          </small>
        </div>
      </div>
      <div
        className="ch-tb tc-tb"
        ref={bodyRef}
        onScroll={onScroll}
        role="log"
        aria-label={`Mensagens: ${conversation.title}`}
        aria-live={announce && !quietOlder ? "polite" : "off"}
        aria-relevant="additions"
        tabIndex={0}
      >
        {query.hasNextPage && (
          <button type="button" className="tc-older" onClick={loadOlder} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? "Carregando..." : "Carregar mensagens anteriores"}
          </button>
        )}
        {loading ? (
          <div className="ov-empty" role="status">
            <small>Carregando mensagens...</small>
          </div>
        ) : failed ? (
          <div className="ov-empty big" role="alert">
            <span>
              <I n="alert" />
            </span>
            <b>{isTeamChatUnavailable(query.error) ? "Disponível em breve" : "Não foi possível carregar as mensagens"}</b>
            <button type="button" className="btn out" onClick={() => void query.refetch()}>
              <I n="refresh" cls="sm" />
              Tentar de novo
            </button>
          </div>
        ) : empty ? (
          <div className="ov-empty big">
            <span>
              <I n="msg" />
            </span>
            <b>Sem mensagens ainda</b>
            <small>{isChannel ? "Escreva a primeira mensagem para a equipe." : "Envie a primeira mensagem abaixo."}</small>
          </div>
        ) : (
          <MessageList conversation={conversation} messages={messages} pending={visiblePending} me={me} onRetry={retry} onDiscard={discard} onMediaLoad={onMediaLoad} unreadFromId={unreadFromId} />
        )}
      </div>
      {showJump && (
        <button type="button" className="tc-jump" onClick={jumpToEnd}>
          <I n="arrdown" cls="sm" />
          Novas mensagens
        </button>
      )}
      <Composer conversationId={conversation.id} blockedReason={chat.blocked?.message ?? null} onSend={handleSend} />
    </>
  );
}

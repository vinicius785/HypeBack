import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Av, I } from "@/components/prototype/ui";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useInfluencerMessages, useSendMessage } from "@/hooks/use-campaign-chat";
import { useMarkChatNotificationsAsRead, useNotifications } from "@/hooks/use-notifications";
import type { Notification } from "@/shared/services/notifications";

const CLOSE_MS = 300;

interface Conversation {
  id: string;
  campaignId: string;
  influencerId: string;
  name: string;
  campaign: string;
  preview: string;
  unread: number;
  at: string;
}

const OPEN_CHAT_EVENT = "hype:open-chat";

export interface OpenChatRequest {
  campaignId: string;
  /** ID do usuário da plataforma (mesmo `influencer_id` das notificações de chat). */
  influencerId: string;
  name: string;
  campaign?: string;
}

/** Abre a gaveta de mensagens já na conversa do criador. */
export function openChatDrawer(req: OpenChatRequest) {
  window.dispatchEvent(new CustomEvent<OpenChatRequest>(OPEN_CHAT_EVENT, { detail: req }));
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, now)) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (same(d, y)) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Hoje";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

/** Conversas derivadas das notificações `new_message` (a API não tem lista global). */
function buildConversations(list: Notification[]): Conversation[] {
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

function Thread({ conv, onBack, onOpenCampaign }: { conv: Conversation; onBack: () => void; onOpenCampaign: () => void }) {
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
        <Av name={conv.name} size={46} />
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
                  {!mine && <Av name={m.sender_name || conv.name} src={m.sender_avatar ?? undefined} size={28} />}
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

/**
 * Botão de chat do topo + gaveta de mensagens (protótipo `chHTML`).
 * Lista derivada das notificações `new_message`; mensagens e envio reais por
 * `useInfluencerMessages`/`useSendMessage` dentro da gaveta.
 */
export function ChatDrawerButton() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "un">("all");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications();

  const [extra, setExtra] = useState<Conversation | null>(null);

  const convs = useMemo(() => {
    const base = buildConversations(notifications);
    if (extra && !base.some((c) => c.id === extra.id)) return [extra, ...base];
    return base;
  }, [notifications, extra]);
  const totalUnread = convs.reduce((a, c) => a + c.unread, 0);

  const requestClose = useCallback(() => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setOpen(false);
      setClosing(false);
      setSel(null);
      setQ("");
      setFilter("all");
    }, CLOSE_MS);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const r = (e as CustomEvent<OpenChatRequest>).detail;
      if (!r) return;
      const id = `${r.campaignId}:${r.influencerId}`;
      setExtra({
        id,
        campaignId: r.campaignId,
        influencerId: r.influencerId,
        name: r.name,
        campaign: r.campaign ?? "",
        preview: "",
        unread: 0,
        at: new Date().toISOString(),
      });
      setClosing(false);
      setSel(id);
      setOpen(true);
    };
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const current = convs.find((c) => c.id === sel) ?? null;
  const needle = q.trim().toLowerCase();
  const list = convs.filter(
    (c) =>
      (filter === "all" || c.unread > 0) &&
      (!needle || c.name.toLowerCase().includes(needle) || c.campaign.toLowerCase().includes(needle)),
  );

  const openCampaign = (c: Conversation) => {
    navigate({
      to: "/campaigns/$campaignId",
      params: { campaignId: c.campaignId },
      search: { tab: "management", openChat: c.influencerId },
    });
    requestClose();
  };

  const cls = closing ? " out" : "";
  const emptyAll = convs.length === 0;

  const drawer = (
    <div className="pv">
      <div className={`ovb on${cls}`} onClick={requestClose} />
      <aside className={`ovp ch on${current ? " th" : ""}${cls}`} role="dialog" aria-label="Mensagens">
        <div className="ch-l">
          <div className="ov-h">
            <div>
              <h2>Mensagens</h2>
              <small>{totalUnread ? `${totalUnread} não lida${totalUnread > 1 ? "s" : ""}` : "Tudo em dia"}</small>
            </div>
          </div>
          <label className="find ch-s">
            <I n="search" cls="sm" />
            <input placeholder="Buscar conversa" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          </label>
          <div className="gtabs ch-f2">
            {([["all", "Todas"], ["un", "Não lidas"]] as const).map(([k, l]) => (
              <button key={k} type="button" className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
                {l}
              </button>
            ))}
          </div>
          <div className="ch-ls">
            {emptyAll ? (
              <div className="ov-empty">
                <span><I n="msg" /></span>
                <b>Nenhuma conversa recente</b>
                <small>As conversas começam em Gerenciamento da campanha, ao abrir o chat de um criador.</small>
              </div>
            ) : list.length === 0 ? (
              <div className="ov-empty">
                <span><I n="search" /></span>
                <b>Nada encontrado</b>
                <small>Tente outro nome ou filtro.</small>
              </div>
            ) : (
              list.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`ch-c${sel === c.id ? " on" : ""}${c.unread ? " un" : ""}`}
                  onClick={() => setSel(c.id)}
                >
                  <Av name={c.name} size={44} />
                  <div>
                    <div className="ch-nr">
                      <b>{c.name}</b>
                      {c.campaign && (
                        <span className="ch-tg" style={{ ["--c" as string]: "#9e2cfa" }}>
                          <i />
                          {c.campaign}
                        </span>
                      )}
                    </div>
                    <small>{c.preview}</small>
                  </div>
                  <span className="ch-m">
                    <em>{fmtTime(c.at)}</em>
                    {c.unread > 0 && <i>{c.unread}</i>}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="ch-r">
          {current ? (
            <Thread key={current.id} conv={current} onBack={() => setSel(null)} onOpenCampaign={() => openCampaign(current)} />
          ) : (
            <div className="ov-empty big">
              <span><I n="msg" /></span>
              <b>Selecione uma conversa</b>
              <small>Converse com os criadores das suas campanhas.</small>
            </div>
          )}
        </div>
        <button type="button" className="round ch-x" onClick={requestClose} aria-label="Fechar">
          <I n="x" cls="sm" />
        </button>
      </aside>
    </div>
  );

  return (
    <>
      <button type="button" className="round" aria-label="Chat" onClick={() => setOpen(true)}>
        <I n="msg" />
        {totalUnread > 0 && <i className="dot" />}
      </button>
      {open && createPortal(drawer, document.body)}
    </>
  );
}

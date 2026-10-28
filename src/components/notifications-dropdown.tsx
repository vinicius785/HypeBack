import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { I } from "@/components/prototype/ui";
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useUnreadNotificationsCount,
} from "@/hooks/use-notifications";
import { useNotificationsSocket } from "@/hooks/use-notifications-socket";
import type { Notification } from "@/shared/services/notifications";
import { resolveNotificationCampaignDeepLink } from "@/shared/utils/notification-navigation";

const CLOSE_MS = 300;

/** Tipo real da notificação -> ícone do protótipo (`NT_IC`). */
const ICONS: Record<string, string> = {
  content_approved: "check",
  content_adjustment_requested: "video",
  content_submitted: "video",
  new_content_submission: "video",
  new_message: "msg",
  influencer_approved: "users",
  shipment_receipt_confirmed: "box",
  campaign_application: "users",
  new_script_submission: "notepad",
};

/** Rótulo do botão de ação (`nt-a`) por tipo. */
const ACTIONS: Record<string, string> = {
  content_approved: "Ver conteúdo",
  content_adjustment_requested: "Ver conteúdo",
  content_submitted: "Revisar conteúdo",
  new_content_submission: "Revisar conteúdo",
  new_message: "Abrir chat",
  influencer_approved: "Ver campanha",
  shipment_receipt_confirmed: "Ver campanha",
  campaign_application: "Ver perfil",
  new_script_submission: "Revisar roteiro",
};

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const hhmm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function groupOf(iso: string): string {
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86400000);
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return "Esta semana";
  return "Anteriores";
}

function whenOf(iso: string): string {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  const g = groupOf(iso);
  if (g === "Hoje") return `há ${Math.floor(diff / 3600)} h`;
  if (g === "Ontem") return `ontem, ${hhmm(d)}`;
  if (g === "Esta semana") return `${WEEKDAYS[d.getDay()]}, ${hhmm(d)}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const GROUPS = ["Hoje", "Ontem", "Esta semana", "Anteriores"];

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<"all" | "un">("all");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications();
  const { mutate: markAsRead } = useMarkNotificationAsRead();
  const { mutate: markAllAsRead, isPending: isMarkingAllAsRead } =
    useMarkAllNotificationsAsRead();
  const unreadCount = useUnreadNotificationsCount();

  // Tempo real: revalida o sininho ao receber `notification:new` via socket.
  useNotificationsSocket();

  const requestClose = useCallback(() => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setIsOpen(false);
      setClosing(false);
    }, CLOSE_MS);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, requestClose]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }

    const campaignId = notification.metadata.campaign_id;
    const deep = resolveNotificationCampaignDeepLink(notification);

    if (!campaignId || !deep) {
      requestClose();
      return;
    }

    const search: Record<string, string> = { tab: deep.tab };
    if (deep.openChat) search.openChat = deep.openChat;
    if (deep.focusCampaignUser) search.focusCampaignUser = deep.focusCampaignUser;
    if (deep.contentId) search.contentId = deep.contentId;

    navigate({
      to: "/campaigns/$campaignId",
      params: { campaignId },
      search,
    });
    requestClose();
  };

  const list = notifications.filter((n) => tab === "all" || !n.read_at);
  const cls = closing ? " out" : "";
  let k = 0;

  const body = isLoading ? (
    <div className="ov-empty">
      <small>Carregando notificações...</small>
    </div>
  ) : list.length === 0 ? (
    <div className="ov-empty">
      <span>
        <I n="check" />
      </span>
      <b>Tudo em dia</b>
      <small>Você não tem notificações pendentes.</small>
    </div>
  ) : (
    GROUPS.map((g) => {
      const items = list.filter((n) => groupOf(n.created_at) === g);
      if (!items.length) return null;
      return (
        <div key={g} style={{ display: "contents" }}>
          <h6>{g}</h6>
          {items.map((n) => {
            const unread = !n.read_at;
            return (
              <button
                key={n.id}
                type="button"
                className={`nt-i${unread ? " un" : ""}`}
                style={{ "--k": k++ } as React.CSSProperties}
                onClick={() => handleNotificationClick(n)}
                aria-label={`Ver notificação: ${n.boldText || n.title}`}
              >
                <span className="nt-av sys">
                  <span className="nt-sy">
                    <I n={ICONS[n.type] ?? "bell"} />
                  </span>
                </span>
                <div className="nt-b">
                  <p>
                    <b>{n.boldText || n.title}</b>
                    {n.message ? ` ${n.message}` : ""}
                  </p>
                  <small className="nt-mt">
                    {n.metadata.campaign_title && <em>{n.metadata.campaign_title}</em>}
                    {n.metadata.campaign_title && <span className="nt-sp" />}
                    <span>{whenOf(n.created_at)}</span>
                  </small>
                  {ACTIONS[n.type] && (
                    <span className="nt-a">
                      {ACTIONS[n.type]}
                      <I n="chev" cls="sm" />
                    </span>
                  )}
                </div>
                {unread && <i className="nt-dot" />}
              </button>
            );
          })}
        </div>
      );
    })
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="round"
        aria-label="Notificações"
      >
        <I n="bell" />
        {unreadCount > 0 && <i className="dot" />}
      </button>

      {isOpen &&
        createPortal(
          <div className="pv">
            <div className={`ovb on${cls}`} onClick={requestClose} />
            <aside className={`ovp nt on${cls}`} role="dialog" aria-label="Notificações">
              <div className="ov-h">
                <div>
                  <h2>Notificações</h2>
                  <small>
                    {unreadCount
                      ? `${unreadCount} ${unreadCount > 1 ? "não lidas" : "não lida"}`
                      : "Tudo em dia"}
                  </small>
                </div>
                <button type="button" className="round" onClick={requestClose} aria-label="Fechar">
                  <I n="x" cls="sm" />
                </button>
              </div>
              <div className="ov-t">
                <div className="gtabs">
                  <button type="button" className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>
                    Todas
                  </button>
                  <button type="button" className={tab === "un" ? "on" : ""} onClick={() => setTab("un")}>
                    Não lidas<em>{unreadCount}</em>
                  </button>
                </div>
                <button
                  type="button"
                  className="lnk"
                  onClick={() => markAllAsRead()}
                  disabled={isMarkingAllAsRead || unreadCount === 0}
                >
                  Marcar todas como lidas
                </button>
              </div>
              <div className="ov-s nt-l">{body}</div>
            </aside>
          </div>,
          document.body,
        )}
    </div>
  );
}

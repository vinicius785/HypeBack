import { useState } from "react";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import { useCancelAdminNotification } from "@/hooks/use-admin-notifications";
import { useNiches } from "@/hooks/use-niches";
import type {
  AdminAudienceFilter,
  AdminNotificationChannel,
  AdminNotificationListItem,
  AdminNotificationStatus,
} from "@/shared/types";

const STATUS_LABEL: Record<AdminNotificationStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sending: "Enviando",
  sent: "Enviada",
  partially_failed: "Entrega parcial",
  failed: "Falhou",
  cancelled: "Cancelada",
};

const STATUS_CHIP: Record<AdminNotificationStatus, string> = {
  draft: "reserved",
  scheduled: "awaiting",
  sending: "awaiting",
  sent: "available",
  partially_failed: "awaiting",
  failed: "fail",
  cancelled: "cancelled",
};

const STATUS_ICON_CLS: Record<AdminNotificationStatus, string> = {
  draft: "",
  scheduled: "scheduled",
  sending: "scheduled",
  sent: "sent",
  partially_failed: "partial",
  failed: "failed",
  cancelled: "",
};

const STATUS_ICON: Record<AdminNotificationStatus, string> = {
  draft: "notepad",
  scheduled: "clock",
  sending: "clock",
  sent: "bell",
  partially_failed: "bell",
  failed: "x",
  cancelled: "x",
};

const CHANNEL_SHORT: Record<AdminNotificationChannel, string> = {
  push: "Push",
  email: "E-mail",
  whatsapp: "WhatsApp",
};

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** "43 leram no app (36%)": só aparece quando o comunicado gerou itens no sino dos criadores. */
export function inAppSummary(stats: AdminNotificationListItem["stats"]): string {
  const inApp = stats?.in_app;
  if (!inApp || inApp.total <= 0) return "";
  const pct = Math.round((inApp.read / inApp.total) * 100);
  return `${fmt(inApp.read)} ${inApp.read === 1 ? "leu" : "leram"} no app (${pct}%)`;
}

function dateLabel(iso: string | null, withTime = true): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d
    .toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
    .replace(".", "");
  const time = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return withTime ? `${day}, ${time}` : day;
}

function relativeDays(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso);
  const a = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const n = new Date();
  const b = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const diff = Math.round((a - b) / 86400000);
  if (diff <= 0) return "hoje";
  if (diff === 1) return "amanhã";
  return `em ${diff} dias`;
}

function whenOf(n: AdminNotificationListItem): { main: string; sub: string } {
  switch (n.status) {
    case "scheduled":
      return {
        main: dateLabel(n.scheduled_at),
        sub: relativeDays(n.scheduled_at),
      };
    case "draft":
      return { main: "Ainda não enviada", sub: "" };
    case "cancelled":
      return { main: dateLabel(n.scheduled_at ?? n.created_at, false), sub: "" };
    case "sending":
      return { main: dateLabel(n.sent_at ?? n.created_at), sub: "em andamento" };
    default:
      return {
        main: dateLabel(n.sent_at ?? n.created_at),
        sub: n.stats
          ? `${fmt(n.stats.delivered)} de ${fmt(n.stats.total_recipients)} entregues`
          : "",
      };
  }
}

function describeAudience(
  a: AdminAudienceFilter,
  nicheName: (id: number) => string,
): string {
  switch (a.type) {
    case "all":
      return "Todos os criadores";
    case "campaign":
      return "Criadores de uma campanha";
    case "niche":
      return `Nicho: ${a.niche_ids.map(nicheName).join(", ") || "—"}`;
    case "followers":
      return `Faixa: ${fmt(a.min_followers)} a ${fmt(a.max_followers)} seguidores`;
    case "location": {
      const parts: string[] = [];
      if (a.states?.length) parts.push(a.states.join(", "));
      if (a.cities?.length) parts.push(a.cities.join(", "));
      return `Estado: ${parts.join(" · ") || "—"}`;
    }
  }
}

interface AdminNotificationListProps {
  items: AdminNotificationListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onNew: () => void;
  onDuplicate: (item: AdminNotificationListItem) => void;
}

export function AdminNotificationList({
  items,
  isLoading,
  isError,
  onRetry,
  onNew,
  onDuplicate,
}: AdminNotificationListProps) {
  const cancelMutation = useCancelAdminNotification();
  const { data: niches = [] } = useNiches();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const nicheName = (id: number) =>
    niches.find((n) => Number(n.id) === id)?.name ?? `#${id}`;

  const cancel = async (item: AdminNotificationListItem) => {
    try {
      await cancelMutation.mutateAsync(item.id);
      toast.success("Envio cancelado");
      setConfirmId(null);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível cancelar. Tente novamente.",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="ov-empty big lvx-em">
        <small>Carregando…</small>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="ov-empty big lvx-em">
        <span>
          <I n="x" />
        </span>
        <b>Não foi possível carregar as notificações</b>
        <small>Tente novamente em instantes.</small>
        <button type="button" className="btn out" onClick={onRetry}>
          <I n="refresh" cls="sm" />
          Atualizar
        </button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="ov-empty big lvx-em">
        <span>
          <I n="bell" />
        </span>
        <b>Nenhuma notificação aqui</b>
        <small>Crie uma nova para avisar os criadores.</small>
        <button type="button" className="btn" onClick={onNew}>
          <I n="plus" cls="sm" />
          Nova notificação
        </button>
      </div>
    );
  }

  return (
    <div className="ntx-ls">
      {items.map((n, k) => {
        const w = whenOf(n);
        const read = inAppSummary(n.stats);
        const total = n.stats?.total_recipients;
        const chans = n.channels.map((c) => CHANNEL_SHORT[c]).join(", ");
        return (
          <div
            key={n.id}
            className={`ntx-r ${confirmId === n.id ? "cf" : ""}`}
            style={{ ["--k" as string]: k }}
          >
            <span className={`ntx-ic ${STATUS_ICON_CLS[n.status]}`}>
              <I n={STATUS_ICON[n.status]} cls="sm" />
            </span>
            <div className="ntx-t">
              <b>{n.title}</b>
              <small>{n.body}</small>
            </div>
            <div className="ntx-a">
              <b>{describeAudience(n.audience, nicheName)}</b>
              <small>
                {total != null ? `${fmt(total)} criadores · ` : ""}
                {chans}
              </small>
            </div>
            <div className="ntx-w">
              <b>{w.main}</b>
              <small>{w.sub}</small>
              {read && <small>{read}</small>}
            </div>
            <span className={`hdx-s ${STATUS_CHIP[n.status]}`}>
              <i />
              {STATUS_LABEL[n.status]}
            </span>
            <div className="hdx-ac">
              {confirmId === n.id ? (
                <div className="hdx-cf">
                  <b>Cancelar este envio?</b>
                  <div>
                    <button
                      type="button"
                      className="btn out"
                      onClick={() => setConfirmId(null)}
                      disabled={cancelMutation.isPending}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      className="btn dng"
                      onClick={() => cancel(n)}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? "Cancelando…" : "Cancelar envio"}
                    </button>
                  </div>
                </div>
              ) : n.status === "scheduled" ? (
                <button
                  type="button"
                  className="btn ghost red"
                  onClick={() => setConfirmId(n.id)}
                >
                  Cancelar envio
                </button>
              ) : n.status === "cancelled" ? (
                <span className="hdx-nd">—</span>
              ) : (
                <button type="button" className="btn out" onClick={() => onDuplicate(n)}>
                  <I n="copy" cls="sm" />
                  Duplicar
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

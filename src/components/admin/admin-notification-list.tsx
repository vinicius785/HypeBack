import { useState, type ReactNode } from "react";

import {
  AdminActionMenu,
  AdminConfirmDialog,
  AdminKeyValueList,
  AdminStatusBadge,
  AdminTable,
  adminErrorMessage,
  adminToast,
  type AdminActionMenuItem,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useCancelAdminNotification } from "@/hooks/use-admin-notifications";
import { useNiches } from "@/hooks/use-niches";
import { formatDate, formatDateTime, formatInt, formatRelativeTime } from "@/lib/admin/format";
import type {
  AdminAudienceFilter,
  AdminNotificationChannel,
  AdminNotificationListItem,
} from "@/shared/types";

import "@/styles/admin-notifications.css";

const CHANNEL_SHORT: Record<AdminNotificationChannel, string> = {
  push: "Push",
  email: "E-mail",
  whatsapp: "WhatsApp",
};

/** "43 leram no app (36%)": só aparece quando o comunicado gerou itens no sino dos criadores. */
export function inAppSummary(stats: AdminNotificationListItem["stats"]): string {
  const inApp = stats?.in_app;
  if (!inApp || inApp.total <= 0) return "";
  const pct = Math.round((inApp.read / inApp.total) * 100);
  return `${formatInt(inApp.read)} ${inApp.read === 1 ? "leu" : "leram"} no app (${pct}%)`;
}

/** Quando saiu / sai: a data principal e uma linha de apoio (relativo, andamento ou entrega). */
function whenOf(n: AdminNotificationListItem): { main: string; sub: string } {
  switch (n.status) {
    case "scheduled":
      return { main: formatDateTime(n.scheduled_at), sub: formatRelativeTime(n.scheduled_at) };
    case "draft":
      return { main: "Ainda não enviada", sub: "" };
    case "cancelled":
      return { main: formatDate(n.scheduled_at ?? n.created_at), sub: "" };
    case "sending":
      return { main: formatDateTime(n.sent_at ?? n.created_at), sub: "em andamento" };
    default:
      return {
        main: formatDateTime(n.sent_at ?? n.created_at),
        sub: n.stats ? `${formatInt(n.stats.delivered)} de ${formatInt(n.stats.total_recipients)} entregues` : "",
      };
  }
}

function describeAudience(a: AdminAudienceFilter, nicheName: (id: number) => string): string {
  switch (a.type) {
    case "all":
      return "Todos os criadores";
    case "campaign":
      return "Criadores de uma campanha";
    case "niche":
      return `Nicho: ${a.niche_ids.map(nicheName).join(", ") || "—"}`;
    case "followers":
      return `Faixa: ${formatInt(a.min_followers)} a ${formatInt(a.max_followers)} seguidores`;
    case "location": {
      const parts: string[] = [];
      if (a.states?.length) parts.push(a.states.join(", "));
      if (a.cities?.length) parts.push(a.cities.join(", "));
      return `Estado: ${parts.join(" · ") || "—"}`;
    }
  }
}

interface AdminNotificationListProps {
  /** `undefined` enquanto a primeira carga não chegou. */
  items: readonly AdminNotificationListItem[] | undefined;
  isLoading: boolean;
  /** Recarregando com a lista na tela (a lista fica, só esmaece). */
  refreshing?: boolean;
  error?: unknown;
  onRetry: () => void;
  retrying?: boolean;
  /** Lista vazia: o texto e a saída (a aba filtrada oferece "Ver todas"; "Nova notificação" é do cabeçalho). */
  empty: { title: string; description?: ReactNode; action?: ReactNode };
  onDuplicate: (item: AdminNotificationListItem) => void;
}

/**
 * Lista de notificações em `AdminTable`: o que foi dito, para quem, quando e a situação. Cada linha abre (seta) os
 * detalhes que a linha corta: a mensagem inteira, o link, o público, os canais e a entrega. As ações de linha
 * ficam no menu "⋯": Duplicar (menos em agendada e cancelada) e Cancelar envio (só em agendada), este com
 * confirmação em diálogo.
 */
export function AdminNotificationList({
  items,
  isLoading,
  refreshing,
  error,
  onRetry,
  retrying,
  empty,
  onDuplicate,
}: AdminNotificationListProps) {
  const cancelMutation = useCancelAdminNotification();
  const { data: niches = [] } = useNiches();
  const [cancelling, setCancelling] = useState<AdminNotificationListItem | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const nicheName = (id: number) => niches.find((n) => Number(n.id) === id)?.name ?? `#${id}`;
  const channelsOf = (n: AdminNotificationListItem) => n.channels.map((c) => CHANNEL_SHORT[c]).join(", ");

  const closeCancel = () => {
    if (cancelMutation.isPending) return;
    setCancelling(null);
    setCancelError(null);
  };

  const confirmCancel = async () => {
    if (!cancelling) return;
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync(cancelling.id);
      adminToast.success("Envio cancelado");
      setCancelling(null);
    } catch (err) {
      setCancelError(adminErrorMessage(err, "Não foi possível cancelar. Tente novamente."));
    }
  };

  const actionsOf = (n: AdminNotificationListItem): AdminActionMenuItem[] => {
    const menu: AdminActionMenuItem[] = [];
    // Mesmo gate de sempre: agendada só cancela; cancelada não tem ação; as demais duplicam.
    if (n.status !== "scheduled" && n.status !== "cancelled") {
      menu.push({ id: "duplicate", label: "Duplicar", icon: "copy", onSelect: () => onDuplicate(n) });
    }
    if (n.status === "scheduled") {
      menu.push({ id: "cancel", label: "Cancelar envio", icon: "x", tone: "danger", onSelect: () => setCancelling(n) });
    }
    return menu;
  };

  const columns: AdminTableColumn<AdminNotificationListItem>[] = [
    {
      key: "message",
      header: "Notificação",
      width: "minmax(0, 2.2fr)",
      primary: true,
      cell: (n) => (
        <div className="adm-ntf-msg">
          <b>{n.title}</b>
          <small>{n.body}</small>
        </div>
      ),
    },
    {
      key: "audience",
      header: "Público",
      width: "minmax(0, 1.6fr)",
      // Cortada em tablet: o público inteiro continua na linha expandida.
      hideBelow: "md",
      cell: (n) => (
        <div className="adm-ntf-two">
          <span>{describeAudience(n.audience, nicheName)}</span>
          <small>
            {n.stats?.total_recipients != null ? `${formatInt(n.stats.total_recipients)} criadores · ` : ""}
            {channelsOf(n)}
          </small>
        </div>
      ),
    },
    {
      key: "when",
      header: "Envio",
      width: "minmax(0, 1.3fr)",
      cell: (n) => {
        const when = whenOf(n);
        const read = inAppSummary(n.stats);
        return (
          <div className="adm-ntf-two">
            <span>{when.main}</span>
            {when.sub ? <small>{when.sub}</small> : null}
            {read ? <small>{read}</small> : null}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: "136px",
      cell: (n) => <AdminStatusBadge kind="notification" value={n.status} />,
    },
  ];

  const expanded = (n: AdminNotificationListItem) => {
    const stats = n.stats;
    const delivery = stats
      ? `${formatInt(stats.delivered)} de ${formatInt(stats.total_recipients)} entregues` +
        (stats.failed > 0 ? ` · ${formatInt(stats.failed)} ${stats.failed === 1 ? "falhou" : "falharam"}` : "")
      : null;
    return (
      <AdminKeyValueList
        columns={2}
        items={[
          { label: "Mensagem", value: <span className="adm-ntf-full">{n.body}</span> },
          { label: "Link ao tocar", value: n.cta_url },
          { label: "Público", value: describeAudience(n.audience, nicheName) },
          { label: "Canais", value: channelsOf(n) },
          { label: "Entrega", value: delivery, hint: inAppSummary(stats) || undefined },
          { label: "Criada por", value: n.created_by.name, hint: formatDateTime(n.created_at) },
        ]}
      />
    );
  };

  return (
    <>
      <AdminTable
        caption="Notificações"
        columns={columns}
        rows={isLoading ? undefined : items}
        rowKey={(n) => n.id}
        loading={isLoading}
        refreshing={refreshing}
        error={error}
        onRetry={onRetry}
        retrying={retrying}
        empty={empty}
        renderExpanded={expanded}
        expandLabel={(n) => `Detalhes de “${n.title}”`}
        rowActions={(n) => {
          const menu = actionsOf(n);
          return menu.length > 0 ? (
            <AdminActionMenu items={menu} iconOnly ariaLabel={`Ações de “${n.title}”`} variant="ghost" />
          ) : null;
        }}
        rowActionsLabel="Ações"
      />

      <AdminConfirmDialog
        open={cancelling !== null}
        tone="danger"
        eyebrow={cancelling ? `Notificação · ${cancelling.title}` : undefined}
        title="Cancelar este envio?"
        description="A notificação não será enviada na data agendada. Esta ação não pode ser desfeita."
        reason={false}
        cancelLabel="Voltar"
        confirmLabel="Cancelar envio"
        pending={cancelMutation.isPending}
        pendingLabel="Cancelando…"
        error={cancelError}
        onConfirm={() => void confirmCancel()}
        onClose={closeCancel}
      />
    </>
  );
}

import { useMemo, useState } from "react";

import { AdminNotificationForm, type AdminNotificationInitial } from "@/components/admin/admin-notification-form";
import { AdminNotificationList } from "@/components/admin/admin-notification-list";
import { AdminNotificationsIsland, type NotificationIslandSegment } from "@/components/admin/admin-notifications-island";
import { AdminPage, AdminPageHeader } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useAdminNotificationsList } from "@/hooks/use-admin-notifications";
import type { AdminNotificationListItem, AdminNotificationStatus } from "@/shared/types";

type Tab = "all" | "scheduled" | "sent" | "failed" | "draft";

/** "Todas" não filtra (inclui as canceladas); cada aba junta os estados que ela conta. */
const TAB_STATUSES: Record<Exclude<Tab, "all">, readonly AdminNotificationStatus[]> = {
  scheduled: ["scheduled"],
  /** Já saiu ou está saindo. */
  sent: ["sent", "sending"],
  /** Falhou por inteiro ou em parte (entrega parcial). */
  failed: ["failed", "partially_failed"],
  draft: ["draft"],
};

const TAB_LABEL: Record<Tab, string> = {
  all: "Todas",
  scheduled: "Agendadas",
  sent: "Enviadas",
  failed: "Com falha",
  draft: "Rascunhos",
};

const TAB_ORDER: readonly Tab[] = ["all", "scheduled", "sent", "failed", "draft"];

const EMPTY_BY_TAB: Record<Tab, { title: string; description: string }> = {
  all: { title: "Nenhuma notificação ainda", description: "Use “Nova notificação” para avisar os criadores." },
  scheduled: { title: "Nenhuma notificação agendada", description: "As que você agendar aparecem aqui até serem enviadas." },
  sent: { title: "Nenhuma notificação enviada", description: "O que já saiu para os criadores aparece aqui." },
  failed: { title: "Nenhuma notificação com falha", description: "Envios que falharam, no todo ou em parte, aparecem aqui." },
  draft: { title: "Nenhum rascunho", description: "Os rascunhos aparecem aqui." },
};


function inTab(n: AdminNotificationListItem, tab: Tab): boolean {
  return tab === "all" || TAB_STATUSES[tab].includes(n.status);
}

/**
 * Notificações (`/admin/notifications`): avisos para os criadores por push, e-mail e WhatsApp. Uma consulta só
 * traz tudo e as abas agrupam no cliente (Todas, Agendadas, Enviadas, Com falha, Rascunhos), cada uma com a sua
 * contagem, nas pílulas da "ilha" (padrão Dynamic Island) no topo, que também abre um resumo dos envios. A ação primária é "Nova notificação" (diálogo em passos); Duplicar parte de uma notificação existente.
 */
export function AdminNotificationsPage() {
  const query = useAdminNotificationsList();
  const [tab, setTab] = useState<Tab>("all");
  const [form, setForm] = useState<{ initial?: AdminNotificationInitial } | null>(null);

  const all = useMemo(() => query.data ?? [], [query.data]);
  const items = useMemo(() => all.filter((n) => inTab(n, tab)), [all, tab]);

  const segments: readonly NotificationIslandSegment[] = TAB_ORDER.map((id) => ({
    id,
    label: TAB_LABEL[id],
    count: query.data ? all.filter((n) => inTab(n, id)).length : null,
    tone: id === "failed" ? "bad" : id === "sent" ? "ok" : undefined,
  }));

  const duplicate = (n: AdminNotificationListItem) =>
    setForm({
      initial: {
        title: n.title,
        body: n.body,
        ctaUrl: n.cta_url ?? "",
        channels: n.channels,
        audience: n.audience,
      },
    });

  // Aba filtrada vazia: a saída é "Ver todas" (o "Nova notificação" é do cabeçalho). Sem nada em "Todas", só o texto.
  const empty = {
    ...EMPTY_BY_TAB[tab],
    action:
      tab !== "all" && all.length > 0 ? (
        <button type="button" className="btn out adm-btn-sm" onClick={() => setTab("all")}>
          Ver todas
        </button>
      ) : undefined,
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Notificações"
        subtitle="Envie avisos para os criadores e acompanhe o que já foi enviado."
        actions={
          <button type="button" className="btn" onClick={() => setForm({})}>
            <I n="plus" cls="sm" />
            Nova notificação
          </button>
        }
      />

      <AdminNotificationsIsland segments={segments} value={tab} onChange={(id) => setTab(id as Tab)} items={all} />

      <AdminNotificationList
        items={query.data ? items : undefined}
        isLoading={query.isLoading}
        refreshing={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        empty={empty}
        onDuplicate={duplicate}
      />

      {form ? <AdminNotificationForm initial={form.initial} onClose={() => setForm(null)} /> : null}
    </AdminPage>
  );
}

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import {
  AdminNotificationForm,
  type AdminNotificationInitial,
} from "@/components/admin/admin-notification-form";
import { AdminNotificationList } from "@/components/admin/admin-notification-list";
import { useAdminNotificationsList } from "@/hooks/use-admin-notifications";
import type {
  AdminNotificationListItem,
  AdminNotificationStatus,
} from "@/shared/types";

export const Route = createFileRoute(
  "/(private)/(admin)/admin/notifications" as "/(private)/(admin)/admin/notifications",
)({
  component: SuperAdminNotifications,
});

type Tab = "all" | "scheduled" | "sent" | "draft";

const TABS: Array<[Tab, string]> = [
  ["all", "Todas"],
  ["scheduled", "Agendadas"],
  ["sent", "Enviadas"],
  ["draft", "Rascunhos"],
];

/** Aba "Enviadas" agrupa tudo que já saiu (inclui parcial, falha e em andamento). */
const SENT_GROUP: AdminNotificationStatus[] = [
  "sent",
  "sending",
  "partially_failed",
  "failed",
];

function inTab(n: AdminNotificationListItem, tab: Tab): boolean {
  if (tab === "all") return true;
  if (tab === "sent") return SENT_GROUP.includes(n.status);
  return n.status === tab;
}

function SuperAdminNotifications() {
  const { data, isLoading, isError, refetch } = useAdminNotificationsList();
  const [tab, setTab] = useState<Tab>("all");
  const [form, setForm] = useState<{ initial?: AdminNotificationInitial } | null>(
    null,
  );

  const all = useMemo(() => data ?? [], [data]);
  const items = useMemo(() => all.filter((n) => inTab(n, tab)), [all, tab]);
  const count = (t: Tab) => all.filter((n) => inTab(n, t)).length;

  const segRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLElement>(null);
  const moveInd = useCallback(() => {
    const on = segRef.current?.querySelector<HTMLElement>("button.on");
    const ind = indRef.current;
    if (!on || !ind) return;
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.transform = `translateX(${on.offsetLeft}px)`;
  }, []);
  useLayoutEffect(() => {
    moveInd();
    window.addEventListener("resize", moveInd);
    return () => window.removeEventListener("resize", moveInd);
  }, [moveInd, tab, data]);

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

  return (
    <div className="pv">
      <div className="wrap" style={{ maxWidth: "none" }}>
        <div className="head fade">
          <div>
            <h1>Notificações</h1>
            <p>Envie avisos para os criadores e acompanhe o que já foi enviado.</p>
          </div>
          <div className="btns">
            <button type="button" className="btn" onClick={() => setForm({})}>
              <I n="plus" cls="sm" />
              Nova notificação
            </button>
          </div>
        </div>
        <div className="tools fade ntx-tl">
          <div className="seg" id="ntseg" ref={segRef}>
            <i className="ind" ref={indRef} />
            {TABS.map(([k, l]) => (
              <button
                key={k}
                type="button"
                className={tab === k ? "on" : ""}
                onClick={() => setTab(k)}
              >
                {l}
                <em>{count(k)}</em>
              </button>
            ))}
          </div>
        </div>
        <div className="fade ntx-rs">
          <AdminNotificationList
            items={items}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            onNew={() => setForm({})}
            onDuplicate={duplicate}
          />
        </div>
      </div>
      {form ? (
        <AdminNotificationForm initial={form.initial} onClose={() => setForm(null)} />
      ) : null}
    </div>
  );
}

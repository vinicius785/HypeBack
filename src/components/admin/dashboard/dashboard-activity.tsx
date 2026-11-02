import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminLink,
  AdminSection,
  AdminSkeleton,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { RECENT_ACTIVITY_LIMIT } from "@/hooks/admin/use-admin-overview";
import type { AdminFeedResult } from "@/lib/admin/admin-client";
import { formatDateTime, formatRelativeTime } from "@/lib/admin/format";
import { ACTIVITY_KIND_LABEL } from "@/lib/admin/labels";
import type { AdminActivityEvent } from "@/shared/admin-platform.types";

import { activityLink } from "./dashboard-model";

import "@/styles/admin-dashboard.css";

/**
 * Um evento da linha do tempo: a frase pronta do servidor (com link quando há para onde ir), há quanto tempo (o
 * instante exato no `title`), o tipo e, nas ações do time, quem fez e o motivo informado. O ponto roxo marca as
 * ações administrativas (registradas em log); os demais são fatos que o sistema já guardava.
 */
function ActivityItem({ event }: { event: AdminActivityEvent }) {
  const target = activityLink(event);
  const isAdminAction = event.kind === "admin_action";
  return (
    <li className="adm-dash-ev" data-source={event.source === "platform_admin_action_log" ? "log" : "derived"}>
      <p className="adm-dash-ev-title">{target ? <AdminLink to={target}>{event.title}</AdminLink> : event.title}</p>
      <div className="adm-dash-ev-meta">
        <time dateTime={event.occurred_at} title={formatDateTime(event.occurred_at)}>
          {formatRelativeTime(event.occurred_at)}
        </time>
        {isAdminAction && event.actor ? <span>{event.actor.name}</span> : null}
        <span>{ACTIVITY_KIND_LABEL[event.kind] ?? event.kind}</span>
      </div>
      {isAdminAction && event.reason ? (
        <p className="adm-dash-ev-reason">
          <span className="adm-dash-ev-reason-k">Motivo</span> {event.reason}
        </p>
      ) : null}
    </li>
  );
}

function ActivitySkeleton() {
  return (
    <div aria-busy="true">
      <span className="adm-sr" role="status">
        Carregando atividade…
      </span>
      {[0, 1, 2, 3, 4].map((row) => (
        <div className="adm-dash-sk-row adm-dash-sk-ev" key={row}>
          <AdminSkeleton width={`${72 - row * 6}%`} height={15} />
          <AdminSkeleton width={150} height={12} />
        </div>
      ))}
    </div>
  );
}

/**
 * "Atividade recente": os 8 eventos mais novos de `GET /admin/activity` numa linha do tempo compacta, com "Ver tudo"
 * para a tela de atividade. Carregando, falhando (com "Tentar de novo") e vazia têm o seu próprio estado.
 */
export function DashboardActivity({ query }: { query: UseQueryResult<AdminFeedResult<AdminActivityEvent>, unknown> }) {
  const { data, isError, error, refetch, isFetching } = query;

  let body: ReactNode;
  if (!data) {
    body = isError ? (
      <AdminErrorState compact error={error} onRetry={() => void refetch()} retrying={isFetching} />
    ) : (
      <ActivitySkeleton />
    );
  } else if (data.data.length === 0) {
    body = (
      <AdminEmptyState
        compact
        title="Nenhuma atividade ainda"
        description="Ações do time e fatos da plataforma aparecem aqui assim que acontecerem."
      />
    );
  } else {
    body = (
      <ol className="adm-dash-tl">
        {data.data.slice(0, RECENT_ACTIVITY_LIMIT).map((event) => (
          <ActivityItem key={event.id} event={event} />
        ))}
      </ol>
    );
  }

  return (
    <AdminSection
      title="Atividade recente"
      description="Ações do time e fatos que o sistema registra; não é um log completo."
      actions={
        <AdminLink to="/admin/activity" className="btn out adm-btn-sm">
          Ver tudo
          <I n="chev" cls="sm" />
        </AdminLink>
      }
    >
      {body}
    </AdminSection>
  );
}

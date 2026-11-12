import type { CSSProperties, ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminLink,
  AdminListSkeleton,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { RECENT_ACTIVITY_LIMIT } from "@/hooks/admin/use-admin-overview";
import type { AdminFeedResult } from "@/lib/admin/admin-client";
import { formatDateTime, formatRelativeTime } from "@/lib/admin/format";
import { ACTIVITY_KIND_LABEL } from "@/lib/admin/labels";
import type { AdminActivityEvent } from "@/shared/admin-platform.types";

import { activityLink } from "./dashboard-model";

import "@/styles/admin-dashboard.css";

/** Ícone de cada tipo de evento (o mesmo vocabulário da tela de Atividades). */
const EVENT_ICON: Record<string, string> = {
  admin_action: "shield",
  workspace_created: "box",
  campaign_created: "mega",
  charge_paid: "banknote",
  member_joined: "user",
  withdrawal_paid: "wallet",
};

/**
 * Um evento como CARTÃO: ícone, a frase pronta do servidor (com link quando há para onde ir), o tipo e, nas ações do time,
 * quem fez; a hora à direita (o instante exato no `title`). O motivo de uma ação do time vem numa linha própria. Os cartões
 * se sobrepõem uns aos outros (o seguinte cobre a borda de baixo do anterior); `--i` dá a ordem da pilha e da entrada.
 */
function ActivityCard({ event, index, last }: { event: AdminActivityEvent; index: number; last: boolean }) {
  const target = activityLink(event);
  const isAdminAction = event.kind === "admin_action";
  const meta = [isAdminAction ? event.actor?.name : null, ACTIVITY_KIND_LABEL[event.kind] ?? event.kind].filter(Boolean).join(" · ");
  return (
    <li
      className="adm-dash-deck-card"
      data-tone={event.source === "platform_admin_action_log" ? "brand" : "neutral"}
      data-last={last ? "true" : undefined}
      style={{ "--i": index, "--z": index + 1 } as CSSProperties}
    >
      <span className="adm-dash-deck-ico" aria-hidden="true">
        <I n={EVENT_ICON[event.kind] ?? "clock"} cls="sm" />
      </span>
      <div className="adm-dash-deck-main">
        <p className="adm-dash-deck-title">{target ? <AdminLink to={target}>{event.title}</AdminLink> : event.title}</p>
        <small>{meta}</small>
        {isAdminAction && event.reason ? (
          <small className="adm-dash-deck-reason">
            <strong>Motivo:</strong> {event.reason}
          </small>
        ) : null}
      </div>
      <time dateTime={event.occurred_at} title={formatDateTime(event.occurred_at)}>
        {formatRelativeTime(event.occurred_at)}
      </time>
    </li>
  );
}

/** A atividade recente mostra só as últimas (o resto está em "Ver tudo"): cartões, cada um cobrindo a borda do anterior. Cinco enchem a mesma altura do cartão "Precisa de atenção". */
const LATEST_CARDS = 5;

/**
 * "Atividade recente": só as últimas 5 de `GET /admin/activity`, cada uma um cartão, empilhados com sobreposição (o mais
 * novo no topo; o segundo cobre um pedaço do primeiro) e entrando em cascata. O resto fica em "Ver tudo". Fica na mesma altura de "Precisa de atenção" (a linha da grade estica os dois). "Ver tudo" leva à tela de atividade.
 * Carregando, falhando (com "Tentar de novo") e vazia têm o seu próprio estado.
 */
export function DashboardActivity({ query }: { query: UseQueryResult<AdminFeedResult<AdminActivityEvent>, unknown> }) {
  const { data, isError, error, refetch, isFetching } = query;

  let body: ReactNode;
  if (!data) {
    body = isError ? (
      <AdminErrorState compact error={error} onRetry={() => void refetch()} retrying={isFetching} />
    ) : (
      <AdminListSkeleton variant="timeline" rows={5} ariaLabel="Carregando atividade…" />
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
    const latest = data.data.slice(0, Math.min(LATEST_CARDS, RECENT_ACTIVITY_LIMIT));
    body = (
      <ul className="adm-dash-deck" aria-label="Atividade recente">
        {latest.map((event, index) => (
          <ActivityCard key={event.id} event={event} index={index} last={index === latest.length - 1} />
        ))}
      </ul>
    );
  }

  return (
    <section className="adm-dash-feed" aria-labelledby="adm-dash-feed-h">
      <div className="adm-dash-feed-h">
        <div>
          <h2 id="adm-dash-feed-h">Atividade recente</h2>
          <p>Ações do time e fatos que o sistema registra; não é um log completo.</p>
        </div>
        <AdminLink to="/admin/activity" className="btn out adm-btn-sm">
          Ver tudo
          <I n="chev" cls="sm" />
        </AdminLink>
      </div>
      {body}
    </section>
  );
}

import { Fragment, type ReactNode } from "react";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminInfoPopover,
  AdminLink,
  AdminListSkeleton,
  AdminLoadMore,
  AdminSection,
  AdminTimeline,
  AdminTimelineItem,
  groupTimelineByDay,
  type AdminLinkTarget,
} from "@/components/admin/platform";
import { useAdminActivityFeed } from "@/hooks/admin/use-admin-activity";
import { ADMIN_TIME_ZONE, formatDateTime } from "@/lib/admin/format";
import { ACTIVITY_KIND_LABEL } from "@/lib/admin/labels";
import type { AdminActivityEvent, AdminActivityKind, AdminDateRange } from "@/shared/admin-platform.types";

import { civilDayOf, formatTimeOfDay } from "./activity-format";
import { ACTIVITY_KINDS, isAuditTargetType, TARGET_ID_MAX_LENGTH, type ActivityFilters } from "./activity-search";

import "@/styles/admin-activity.css";

/** Ícones do mapa `I` (os mesmos do menu do Admin onde existem): um por tipo, todos neutros e decorativos. */
const KIND_ICON: Record<AdminActivityKind, string> = {
  admin_action: "gear",
  workspace_created: "box",
  campaign_created: "mega",
  charge_paid: "banknote",
  member_joined: "user",
  withdrawal_paid: "wallet",
};

/** Para onde leva o alvo de um evento, quando a tela dele existe. */
function targetLink(target: AdminActivityEvent["target"]): AdminLinkTarget | undefined {
  if (!target) return undefined;
  if (target.type === "campaign") return { to: "/admin/campaigns/$campaignId", params: { campaignId: target.id } };
  return undefined;
}

/**
 * De uma ação administrativa da linha do tempo para a lista de alterações, já filtrada pelo alvo e pelo dia do
 * evento (a lista de alterações tem o antes/depois e o impacto que a linha do tempo não mostra).
 */
function changeLink(event: AdminActivityEvent): AdminLinkTarget | undefined {
  const { target } = event;
  const day = civilDayOf(event.occurred_at);
  if (event.kind !== "admin_action" || !target || !day) return undefined;
  if (!isAuditTargetType(target.type) || !target.id || target.id.length > TARGET_ID_MAX_LENGTH) return undefined;
  return { to: "/admin/activity", search: { tab: "changes", target_type: target.type, target_id: target.id, from: day, to: day } };
}

/** O que o "i" do título explica: os tipos que existem e de onde vem cada fato (o texto visível é uma frase só). */
const TIMELINE_HELP = (
  <>
    <AdminInfoPopover.Paragraph>Tipos de evento: {ACTIVITY_KINDS.map((kind) => ACTIVITY_KIND_LABEL[kind]).join(" · ")}.</AdminInfoPopover.Paragraph>
    <AdminInfoPopover.Paragraph>
      As ações administrativas vêm do registro de auditoria; os outros eventos são fatos que o sistema já guarda (datas de criação e de
      pagamento).
    </AdminInfoPopover.Paragraph>
  </>
);

/** Um evento: o tipo dito uma vez (rótulo visível; o ícone é decorativo), quem fez, onde, e o motivo recolhido. */
function ActivityItem({ event }: { event: AdminActivityEvent }) {
  const { actor, workspace, reason } = event;
  const campaign = targetLink(event.target);
  const change = changeLink(event);

  const meta: ReactNode[] = [ACTIVITY_KIND_LABEL[event.kind] ?? event.kind];
  if (actor) {
    meta.push(
      <Fragment key="actor">
        por <AdminLink to={{ to: "/admin/users/$userId", params: { userId: actor.user_id } }}>{actor.name}</AdminLink>
      </Fragment>,
    );
  }
  if (workspace) {
    meta.push(
      <AdminLink key="workspace" to={{ to: "/admin/workspaces/$workspaceId", params: { workspaceId: workspace.id } }}>
        {workspace.name}
      </AdminLink>,
    );
  }
  if (campaign && event.target) {
    meta.push(
      <AdminLink key="campaign" to={campaign}>
        {event.target.label ?? "Campanha"}
      </AdminLink>,
    );
  }
  if (change) {
    meta.push(
      <AdminLink key="change" to={change}>
        Ver o que mudou
      </AdminLink>,
    );
  }

  return (
    <AdminTimelineItem
      icon={KIND_ICON[event.kind] ?? "clock"}
      title={event.title}
      meta={meta}
      time={formatTimeOfDay(event.occurred_at)}
      dateTime={event.occurred_at}
      timeTitle={`${formatDateTime(event.occurred_at)}, horário de São Paulo`}
      detail={
        reason ? (
          <p className="adm-act-reason">
            <b>Motivo:</b> {reason}
          </p>
        ) : undefined
      }
    />
  );
}

interface ActivityFeedProps {
  filters: ActivityFilters;
  period: AdminDateRange;
  /** Há algum filtro além do período (muda o texto do estado vazio). */
  filtered: boolean;
  onClearFilters: () => void;
}

/**
 * Linha do tempo da plataforma: ações administrativas e fatos que o sistema já guarda (workspace criado,
 * campanha criada, aporte pago, membro adicionado, saque pago), do mais recente para o mais antigo, agrupados
 * por dia de São Paulo. Não é um registro completo de tudo que acontece, e a tela diz isso.
 */
export function ActivityFeed({ filters, period, filtered, onClearFilters }: ActivityFeedProps) {
  const { query, rows } = useAdminActivityFeed({ kind: filters.kind, workspaceId: filters.workspaceId, period });
  const groups = groupTimelineByDay(rows, (event) => event.occurred_at, { timeZone: ADMIN_TIME_ZONE });
  const failedToLoadMore = query.isFetchNextPageError;

  return (
    <div className="adm-act-stack">
      <AdminSection
        title="Linha do tempo"
        description={
          <>
            Não é um registro completo: mostra só alguns tipos de evento.{" "}
            <AdminInfoPopover prefix="Como ler" label="Linha do tempo">{TIMELINE_HELP}</AdminInfoPopover>
          </>
        }
      >
        {query.isLoading ? (
          <AdminListSkeleton variant="timeline" rows={6} ariaLabel="Carregando atividades…" />
        ) : query.error && rows.length === 0 ? (
          <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : rows.length === 0 ? (
          <AdminEmptyState
            compact
            title={filtered ? "Nenhuma atividade com estes filtros" : "Nenhuma atividade no período"}
            description={filtered ? "Tente outro tipo, outro workspace ou um período maior." : "Tente um período maior."}
            action={
              filtered ? (
                <button type="button" className="btn out adm-btn-sm" onClick={onClearFilters}>
                  Limpar filtros
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            {query.error ? (
              <div className="adm-act-alert">
                <AdminErrorState
                  compact
                  error={query.error}
                  onRetry={() => void (failedToLoadMore ? query.fetchNextPage() : query.refetch())}
                  retrying={query.isFetching}
                />
              </div>
            ) : null}
            <AdminTimeline
              ariaLabel="Atividade da plataforma"
              busy={query.isFetching && !query.isFetchingNextPage}
              groups={groups.map((group) => ({
                key: group.key || "unknown",
                label: group.label,
                items: group.items.map((event) => <ActivityItem key={event.id} event={event} />),
              }))}
            />
            <AdminLoadMore
              loaded={rows.length}
              hasMore={!!query.hasNextPage}
              loading={query.isFetchingNextPage}
              onLoadMore={() => void query.fetchNextPage()}
              noun={{ singular: "evento", plural: "eventos" }}
            />
          </>
        )}
      </AdminSection>
    </div>
  );
}

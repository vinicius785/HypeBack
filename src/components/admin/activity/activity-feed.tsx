import type { ReactNode } from "react";

import { I } from "@/components/prototype/ui";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLink,
  AdminSection,
  AdminSkeleton,
  type AdminLinkTarget,
} from "@/components/admin/platform";
import { useAdminActivityFeed } from "@/hooks/admin/use-admin-activity";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import { ACTIVITY_KIND_LABEL } from "@/lib/admin/labels";
import type { AdminActivityEvent, AdminActivityKind, AdminDateRange } from "@/shared/admin-platform.types";

import { civilDayOf, dayHeading, formatTimeOfDay, groupByDay } from "./activity-format";
import { ACTIVITY_KINDS, isAuditTargetType, TARGET_ID_MAX_LENGTH, type ActivityFilters } from "./activity-search";

import "@/styles/admin-activity.css";

/** Ícones do mapa `I` (os mesmos do menu do Admin onde existem): um por tipo, todos neutros. */
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

function ActivityItem({ event }: { event: AdminActivityEvent }) {
  const { actor, workspace, reason } = event;
  const campaign = targetLink(event.target);
  const change = changeLink(event);
  return (
    <li className="adm-act-item" data-kind={event.kind}>
      <span className="adm-act-ico" aria-hidden="true">
        <I n={KIND_ICON[event.kind] ?? "clock"} />
      </span>
      <div className="adm-act-body">
        <p className="adm-act-title">{event.title}</p>
        <p className="adm-act-meta">
          <span>{ACTIVITY_KIND_LABEL[event.kind] ?? event.kind}</span>
          {actor ? (
            <span>
              por{" "}
              <AdminLink to={{ to: "/admin/users/$userId", params: { userId: actor.user_id } }} className="adm-act-link">
                {actor.name}
              </AdminLink>
            </span>
          ) : null}
          {workspace ? (
            <span>
              <AdminLink to={{ to: "/admin/workspaces/$workspaceId", params: { workspaceId: workspace.id } }} className="adm-act-link">
                {workspace.name}
              </AdminLink>
            </span>
          ) : null}
          {campaign && event.target ? (
            <span>
              <AdminLink to={campaign} className="adm-act-link">
                {event.target.label ?? "Campanha"}
              </AdminLink>
            </span>
          ) : null}
        </p>
        {reason ? (
          <p className="adm-act-reason" title={reason}>
            <b>Motivo:</b> {reason}
          </p>
        ) : null}
        {change ? (
          <AdminLink to={change} className="adm-act-link adm-act-detail">
            Ver o que mudou
          </AdminLink>
        ) : null}
      </div>
      <time className="adm-act-time" dateTime={event.occurred_at} title={`${formatDateTime(event.occurred_at)}, horário de São Paulo`}>
        {formatTimeOfDay(event.occurred_at)}
      </time>
    </li>
  );
}

function ActivitySkeleton() {
  return (
    <div className="adm-act-skeleton" role="status">
      <span className="adm-sr">Carregando…</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div className="adm-act-item" key={index} aria-hidden="true">
          <AdminSkeleton width={36} height={36} radius="50%" />
          <div className="adm-act-body">
            <AdminSkeleton height={16} width={`${72 - (index % 3) * 14}%`} />
            <AdminSkeleton height={12} width="38%" style={{ marginTop: 8 }} />
          </div>
          <AdminSkeleton width={38} height={14} />
        </div>
      ))}
    </div>
  );
}

interface ActivityFeedProps {
  filters: ActivityFilters;
  period: AdminDateRange;
  today: string;
  /** Barra de filtros desta visão (o tipo e o workspace). */
  filterBar: ReactNode;
  /** Há algum filtro além do período (muda o texto do estado vazio). */
  filtered: boolean;
  onClearFilters: () => void;
}

/**
 * Linha do tempo da plataforma: ações administrativas e fatos que o sistema já guarda (workspace criado,
 * campanha criada, aporte pago, membro adicionado, saque pago), do mais recente para o mais antigo, agrupados
 * por dia de São Paulo. Não é um registro completo de tudo que acontece, e a tela diz isso.
 */
export function ActivityFeed({ filters, period, today, filterBar, filtered, onClearFilters }: ActivityFeedProps) {
  const { query, rows } = useAdminActivityFeed({ kind: filters.kind, workspaceId: filters.workspaceId, period });
  const groups = groupByDay(rows);
  const failedToLoadMore = query.isFetchNextPageError;

  return (
    <div className="adm-act-stack">
      {filterBar}

      <AdminSection
        title="Linha do tempo"
        description={
          <>
            <b>Não é um registro completo: só estes tipos de evento.</b>{" "}
            {ACTIVITY_KINDS.map((kind) => ACTIVITY_KIND_LABEL[kind]).join(" · ")}. As ações administrativas vêm do registro de auditoria; os
            outros eventos são fatos que o sistema já guarda (datas de criação e de pagamento).
          </>
        }
        className="adm-act-card"
      >
        {query.isLoading ? (
          <ActivitySkeleton />
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
            <ol className="adm-act-days" aria-busy={query.isFetching && !query.isFetchingNextPage ? true : undefined}>
              {groups.map((group) => (
                <li key={group.day || "unknown"} className="adm-act-day">
                  <h3>{group.day ? dayHeading(group.day, today) : "Sem data"}</h3>
                  <ol className="adm-act-list">
                    {group.items.map((event) => (
                      <ActivityItem key={event.id} event={event} />
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
            <div className="adm-act-more">
              <span role="status">
                {formatInt(rows.length)} {rows.length === 1 ? "evento carregado" : "eventos carregados"}
                {query.hasNextPage ? "" : " · fim da lista"}
              </span>
              {query.hasNextPage ? (
                <button type="button" className="btn out adm-btn-sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                  {query.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
                </button>
              ) : null}
            </div>
          </>
        )}
      </AdminSection>
    </div>
  );
}

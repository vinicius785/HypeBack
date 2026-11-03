import { useState } from "react";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminFilterBar,
  AdminListSkeleton,
  AdminLoadMore,
  AdminRefreshButton,
  AdminSection,
  AdminTimeline,
  AdminTimelineItem,
  groupTimelineByDay,
} from "@/components/admin/platform";
import { useAdminWorkspaceActivity, useAdminWorkspaceAuditDay } from "@/hooks/admin/use-admin-workspaces";
import { ADMIN_TIME_ZONE, civilDateInSaoPaulo, formatDateTime } from "@/lib/admin/format";
import { ACTIVITY_KIND_LABEL } from "@/lib/admin/labels";
import type { AdminActivityEvent, AdminWorkspaceDetail } from "@/shared/admin-platform.types";

import { findAuditEntry, WorkspaceAuditDiff } from "./workspace-audit-diff";
import { timeOfDay } from "./workspace-format";

import "@/styles/admin-workspaces.css";

const FILTER_OPTIONS = [
  { value: "all", label: "Tudo" },
  { value: "admin", label: "Ações do Admin" },
] as const;

const EVENT_NOUN = { singular: "evento", plural: "eventos" } as const;

/**
 * "Antes e depois" de uma ação administrativa, no detalhe recolhido do evento. Só consulta a auditoria depois que
 * a pessoa abre (uma consulta por dia de São Paulo serve a todas as ações daquele dia) e procura o registro pelo
 * id do evento.
 */
function AuditDetails({ workspaceId, event, open }: { workspaceId: string; event: AdminActivityEvent; open: boolean }) {
  const time = Date.parse(event.occurred_at);
  const day = Number.isNaN(time) ? "" : civilDateInSaoPaulo(time);
  const audit = useAdminWorkspaceAuditDay(workspaceId, day, open && day !== "");
  const entry = audit.data ? findAuditEntry(audit.data.data, event) : undefined;

  // Recolhido e ainda sem ter consultado: nada para mostrar (o detalhe só existe no DOM, escondido).
  if (!open && !audit.data && !audit.isError) return null;
  if (audit.isLoading) return <AdminListSkeleton rows={2} ariaLabel="Carregando o registro da ação…" />;
  if (audit.isError) {
    return <AdminErrorState compact error={audit.error} onRetry={() => void audit.refetch()} retrying={audit.isRefetching} />;
  }
  if (entry) return <WorkspaceAuditDiff entry={entry} />;
  return <p className="adm-workspaces-quiet">Não encontramos o registro desta ação na auditoria.</p>;
}

/** Um evento da linha do tempo. A ação do Admin traz o "antes e depois" em "Ver detalhes"; o motivo fica à vista. */
function ActivityItem({ workspaceId, event }: { workspaceId: string; event: AdminActivityEvent }) {
  const [open, setOpen] = useState(false);
  const isAdminAction = event.kind === "admin_action";
  return (
    <AdminTimelineItem
      tone={isAdminAction ? "brand" : "neutral"}
      title={
        <>
          {event.title}
          {event.reason ? <span className="adm-workspaces-reason">Motivo: {event.reason}</span> : null}
        </>
      }
      meta={[ACTIVITY_KIND_LABEL[event.kind] ?? event.kind, event.actor ? `por ${event.actor.name}` : null]}
      time={timeOfDay(event.occurred_at)}
      dateTime={event.occurred_at}
      timeTitle={`${formatDateTime(event.occurred_at)}, horário de São Paulo`}
      detail={isAdminAction ? <AuditDetails workspaceId={workspaceId} event={event} open={open} /> : undefined}
      onToggle={setOpen}
    />
  );
}

/**
 * Aba "Atividade": a linha do tempo do workspace (ações do Admin e fatos que o sistema guarda), por cursor, agrupada
 * por dia de São Paulo (o cabeçalho do dia diz a data; cada evento mostra só a hora).
 */
export function WorkspaceActivityTab({ workspace }: { workspace: AdminWorkspaceDetail }) {
  const [filter, setFilter] = useState<"all" | "admin">("all");
  const feed = useAdminWorkspaceActivity(workspace.id, filter === "admin");
  const events = feed.data?.pages.flatMap((page) => page.data);

  return (
    <>
      <AdminFilterBar
        segment={{
          options: FILTER_OPTIONS,
          value: filter,
          onChange: (value) => setFilter(value as "all" | "admin"),
          ariaLabel: "O que mostrar na atividade",
        }}
        trailing={
          <AdminRefreshButton iconOnly onClick={() => void feed.refetch()} loading={feed.isFetching && !feed.isFetchingNextPage} />
        }
      />

      <AdminSection>
        {feed.isLoading ? (
          <AdminListSkeleton rows={4} variant="timeline" ariaLabel="Carregando a atividade…" />
        ) : feed.isError && !events?.length ? (
          <AdminErrorState compact error={feed.error} onRetry={() => void feed.refetch()} retrying={feed.isRefetching} />
        ) : events && events.length > 0 ? (
          <>
            <AdminTimeline
              ariaLabel="Atividade do workspace"
              groups={groupTimelineByDay(events, (event) => event.occurred_at, { timeZone: ADMIN_TIME_ZONE }).map((day) => ({
                key: day.key,
                label: day.label,
                items: day.items.map((event) => <ActivityItem key={event.id} workspaceId={workspace.id} event={event} />),
              }))}
            />
            {feed.isError ? (
              <AdminErrorState compact error={feed.error} onRetry={() => void feed.fetchNextPage()} retrying={feed.isFetchingNextPage} />
            ) : null}
            <AdminLoadMore
              loaded={events.length}
              hasMore={!!feed.hasNextPage}
              loading={feed.isFetchingNextPage}
              onLoadMore={() => void feed.fetchNextPage()}
              noun={EVENT_NOUN}
            />
          </>
        ) : (
          <AdminEmptyState
            compact
            title={filter === "admin" ? "Nenhuma ação do Admin neste workspace" : "Nenhuma atividade registrada"}
            description={
              filter === "admin"
                ? "Quando alguém da plataforma alterar este workspace, a ação aparece aqui, com o motivo."
                : "Ainda não há eventos deste workspace."
            }
            action={
              filter === "admin" ? (
                <button type="button" className="btn out adm-btn-sm" onClick={() => setFilter("all")}>
                  Mostrar tudo
                </button>
              ) : undefined
            }
          />
        )}
      </AdminSection>
    </>
  );
}

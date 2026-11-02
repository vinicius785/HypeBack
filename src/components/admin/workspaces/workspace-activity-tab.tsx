import { useId, useState } from "react";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminSection,
  AdminSegmentedControl,
  AdminSkeleton,
  AdminSkeletonLines,
} from "@/components/admin/platform";
import { useAdminWorkspaceActivity, useAdminWorkspaceAuditDay } from "@/hooks/admin/use-admin-workspaces";
import { civilDateInSaoPaulo, formatDateTime, formatRelativeTime } from "@/lib/admin/format";
import { ACTIVITY_KIND_LABEL } from "@/lib/admin/labels";
import type { AdminActivityEvent, AdminWorkspaceDetail } from "@/shared/admin-platform.types";

import { findAuditEntry, WorkspaceAuditDiff } from "./workspace-audit-diff";

import "@/styles/admin-workspaces.css";

const FILTER_OPTIONS = [
  { value: "all", label: "Tudo" },
  { value: "admin", label: "Ações do Admin" },
] as const;

/**
 * "Ver antes e depois" de uma ação administrativa. Só consulta a auditoria depois que a pessoa expande (uma
 * consulta por dia de São Paulo serve a todas as ações daquele dia) e procura o registro pelo id do evento.
 */
function AuditDetails({ workspaceId, event }: { workspaceId: string; event: AdminActivityEvent }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const time = Date.parse(event.occurred_at);
  const day = Number.isNaN(time) ? "" : civilDateInSaoPaulo(time);
  const audit = useAdminWorkspaceAuditDay(workspaceId, day, open && day !== "");
  const entry = audit.data ? findAuditEntry(audit.data.data, event) : undefined;

  return (
    <>
      <button
        type="button"
        className="adm-textbtn adm-workspaces-expand"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Ocultar antes e depois" : "Ver antes e depois"}
      </button>
      <div id={panelId} hidden={!open}>
        {open ? (
          audit.isLoading ? (
            <div role="status">
              <span className="adm-sr">Carregando o registro da ação…</span>
              <AdminSkeletonLines lines={3} />
            </div>
          ) : audit.isError ? (
            <AdminErrorState compact error={audit.error} onRetry={() => void audit.refetch()} retrying={audit.isRefetching} />
          ) : entry ? (
            <WorkspaceAuditDiff entry={entry} />
          ) : (
            <p className="adm-workspaces-quiet">Não encontramos o registro desta ação na auditoria.</p>
          )
        ) : null}
      </div>
    </>
  );
}

/** Aba "Atividade": a linha do tempo do workspace (ações do Admin e fatos que o sistema guarda), por cursor. */
export function WorkspaceActivityTab({ workspace }: { workspace: AdminWorkspaceDetail }) {
  const [filter, setFilter] = useState<"all" | "admin">("all");
  const feed = useAdminWorkspaceActivity(workspace.id, filter === "admin");
  const events = feed.data?.pages.flatMap((page) => page.data);

  return (
    <div className="adm-workspaces-panel">
      <div className="adm-workspaces-toolbar">
        <AdminSegmentedControl
          ariaLabel="O que mostrar na atividade"
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(value) => setFilter(value as "all" | "admin")}
        />
      </div>

      <AdminSection>
        {feed.isLoading ? (
          <div className="adm-workspaces-timeline" role="status">
            <span className="adm-sr">Carregando a atividade…</span>
            {Array.from({ length: 4 }, (_, index) => (
              <div className="adm-workspaces-event" key={index} aria-hidden="true">
                <AdminSkeleton width={112} height={14} />
                <AdminSkeletonLines lines={2} lastWidth="40%" />
              </div>
            ))}
          </div>
        ) : feed.isError && !events?.length ? (
          <AdminErrorState compact error={feed.error} onRetry={() => void feed.refetch()} retrying={feed.isRefetching} />
        ) : events && events.length > 0 ? (
          <>
            <ol className="adm-workspaces-timeline">
              {events.map((event) => (
                <li className="adm-workspaces-event" key={event.id}>
                  <time dateTime={event.occurred_at} title={formatRelativeTime(event.occurred_at)}>
                    {formatDateTime(event.occurred_at)}
                  </time>
                  <div className="adm-workspaces-event-main">
                    <span className="adm-workspaces-event-kind">{ACTIVITY_KIND_LABEL[event.kind] ?? event.kind}</span>
                    <p className="adm-workspaces-event-title">{event.title}</p>
                    {event.actor ? <small>por {event.actor.name}</small> : null}
                    {event.reason ? <p className="adm-workspaces-event-reason">Motivo: {event.reason}</p> : null}
                    {event.kind === "admin_action" ? <AuditDetails workspaceId={workspace.id} event={event} /> : null}
                  </div>
                </li>
              ))}
            </ol>
            {feed.isError ? (
              <AdminErrorState compact error={feed.error} onRetry={() => void feed.fetchNextPage()} retrying={feed.isFetchingNextPage} />
            ) : null}
            {feed.hasNextPage ? (
              <div className="adm-workspaces-loadmore">
                <button type="button" className="btn out adm-btn-sm" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
                  {feed.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
                </button>
              </div>
            ) : null}
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
          />
        )}
      </AdminSection>
    </div>
  );
}

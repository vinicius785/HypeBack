import { useId, useState } from "react";

import {
  adminToast,
  AdminBadge,
  AdminConfirmDialog,
  AdminDialog,
  AdminEmptyState,
  AdminErrorState,
  AdminListSkeleton,
  AdminLink,
  AdminLoadMore,
  AdminSection,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useMarkAlertSeen, useMarkAllAlertsSeen, useSecurityAlerts } from "@/hooks/admin/use-admin-security";
import { describeAdminError } from "@/lib/admin/admin-errors";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import {
  isAdminActionAlert,
  isWatchedLoginAlert,
  type AdminActionDetails,
  type SecurityAlert,
  type SecurityAlertStatus,
} from "@/shared/admin-platform.types";

import { userDetailLink } from "../users/admin-users-links";
import { actorRoleLabel, channelLabel, kindLabel, matchesKind, NOTE_MAX, SEVERITY_LABEL, SEVERITY_TONE, targetTypeLabel, type KindFilter } from "./security-labels";

import "@/styles/admin-security.css";

/** Diálogo "Marcar como visto": a anotação é opcional (até 500 caracteres). */
function SeenDialog({ alert, onClose }: { alert: SecurityAlert; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMarkAlertSeen();
  const id = useId();

  const submit = async () => {
    if (mutation.isPending) return;
    setError(null);
    try {
      await mutation.mutateAsync({ alertId: alert.id, note });
      adminToast.success("Alerta marcado como visto.");
      onClose();
    } catch (failure) {
      setError(describeAdminError(failure));
    }
  };

  return (
    <AdminDialog
      open
      title="Marcar como visto"
      description={alert.title}
      busy={mutation.isPending}
      dirty={note.trim() !== ""}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn out" disabled={mutation.isPending} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" disabled={mutation.isPending} onClick={() => void submit()}>
            {mutation.isPending ? "Salvando…" : "Marcar como visto"}
          </button>
        </>
      }
    >
      <div className="adm-field">
        <label htmlFor={id}>
          Anotação <span>(opcional)</span>
        </label>
        <textarea
          id={id}
          className="adm-input"
          value={note}
          maxLength={NOTE_MAX}
          readOnly={mutation.isPending}
          placeholder="Ex.: conferi com o time, foi a própria pessoa."
          data-adm-autofocus
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="adm-field-foot">
          <span data-error={error ? "true" : undefined} role={error ? "alert" : undefined}>
            {error ?? ""}
          </span>
          <span className="adm-field-count">
            {note.length}/{NOTE_MAX}
          </span>
        </div>
      </div>
    </AdminDialog>
  );
}

/** Quem aparece na linha: a conta vigiada (watched_login) ou quem fez a ação (admin_action). Texto simples, nunca HTML. */
function AlertPerson({ alert }: { alert: SecurityAlert }) {
  const user = alert.user;
  const name = user?.name?.trim();
  if (!user) return <span>{isAdminActionAlert(alert) ? "Autor não identificado" : "Conta não identificada"}</span>;
  if (isAdminActionAlert(alert)) {
    const who = name || alert.details?.actor_name?.trim() || `Conta #${user.id}`;
    return (
      <span>
        Feito por {who}
        {user.email ? <span className="adm-sec-mail"> ({user.email})</span> : null}
      </span>
    );
  }
  return (
    <>
      {name ? <span>{name}</span> : null}
      {user.email ? <span className="adm-sec-mail">{user.email}</span> : null}
      {!name && !user.email ? <span>Conta #{user.id}</span> : null}
    </>
  );
}

/** Detalhes de uma ação de risco no Admin: motivo, alvo, quem fez (papel) e IP. Os textos vêm de digitação humana: só texto. */
function AdminActionDetailsList({ details, id }: { details: AdminActionDetails; id: string }) {
  const target = [details.target_label?.trim(), targetTypeLabel(details.target_type)].filter(Boolean);
  return (
    <dl className="adm-sec-details" id={id}>
      {details.action_label ? (
        <div>
          <dt>Ação</dt>
          <dd>{details.action_label}</dd>
        </div>
      ) : null}
      <div>
        <dt>Motivo informado</dt>
        <dd className="adm-sec-details-reason">{details.reason || "—"}</dd>
      </div>
      <div>
        <dt>Alvo</dt>
        <dd>{target.length === 2 ? `${target[0]} · ${target[1]}` : (target[0] ?? "—")}</dd>
      </div>
      <div>
        <dt>Feito por</dt>
        <dd>{details.actor_role ? actorRoleLabel(details.actor_role) : "—"}</dd>
      </div>
      {details.ip ? (
        <div>
          <dt>IP</dt>
          <dd className="adm-sec-details-ip">{details.ip}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function AlertRow({ alert, onMarkSeen }: { alert: SecurityAlert; onMarkSeen: (alert: SecurityAlert) => void }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const seen = alert.seen_at !== null;
  const watched = isWatchedLoginAlert(alert);
  const adminAction = isAdminActionAlert(alert);
  const channel = watched ? channelLabel(alert.details?.channel) : null;
  const kind = kindLabel(alert.kind);
  const name = alert.user?.name?.trim();
  return (
    <li className="adm-sec-row" data-seen={seen ? "true" : undefined} data-kind={alert.kind}>
      <div className="adm-sec-main">
        <div className="adm-sec-head">
          {/* vermelho e âmbar só para o que ainda não foi visto: alerta já visto vira cinza */}
          <AdminBadge tone={seen ? "muted" : (SEVERITY_TONE[alert.severity] ?? "neutral")} size="sm">
            {SEVERITY_LABEL[alert.severity] ?? alert.severity}
          </AdminBadge>
          {kind ? (
            <AdminBadge tone="outline" size="sm">
              {kind}
            </AdminBadge>
          ) : null}
          <b>{alert.title}</b>
        </div>
        <p className="adm-sec-who">
          <AlertPerson alert={alert} />
        </p>
        <p className="adm-sec-meta">
          {channel ? <span>{channel}</span> : null}
          <time dateTime={alert.created_at}>{formatDateTime(alert.created_at)}</time>
          {seen ? <span>Visto em {formatDateTime(alert.seen_at)}</span> : null}
        </p>
        {alert.note ? <p className="adm-sec-note">“{alert.note}”</p> : null}
        {adminAction && open ? <AdminActionDetailsList details={alert.details} id={detailsId} /> : null}
      </div>
      <div className="adm-sec-actions">
        {adminAction ? (
          <button type="button" className="adm-sec-toggle" aria-expanded={open} aria-controls={open ? detailsId : undefined} onClick={() => setOpen((value) => !value)}>
            {open ? "Ocultar detalhes" : "Ver detalhes"}
            <I n={open ? "chevup" : "chevdown"} cls="sm" />
          </button>
        ) : null}
        {alert.user ? (
          <AdminLink to={userDetailLink(alert.user.id)} textLink aria-label={`Ver conta de ${name || `#${alert.user.id}`}`}>
            Ver conta
          </AdminLink>
        ) : null}
        {!seen ? (
          <button type="button" className="btn out adm-btn-sm" onClick={() => onMarkSeen(alert)}>
            <I n="check" cls="sm" />
            Marcar como visto
          </button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Aba "Alertas": a caixa de entrada da sentinela, com "Carregar mais". O filtro Novos/Todos e o "Marcar todos como vistos" ficam
 * na ilha da tela (`SecurityPage`): ela diz quando abrir a confirmação (`confirmAll`) e aqui ela é feita.
 */
export function SecurityAlertsTab({
  status,
  kind,
  confirmAll,
  onConfirmAllChange,
}: {
  status: SecurityAlertStatus;
  /** Filtro por tipo, só no cliente, sobre os alertas já carregados. */
  kind: KindFilter;
  confirmAll: boolean;
  onConfirmAllChange: (open: boolean) => void;
}) {
  const query = useSecurityAlerts(status);
  const markAll = useMarkAllAlertsSeen();
  const [target, setTarget] = useState<SecurityAlert | null>(null);
  const [allError, setAllError] = useState<string | null>(null);

  const pages = query.data?.pages ?? [];
  const loadedAlerts = pages.flatMap((page) => page.data);
  const alerts = loadedAlerts.filter((alert) => matchesKind(alert.kind, kind));
  const unseen = pages[0]?.meta?.unseen ?? 0;
  const total = pages[pages.length - 1]?.meta?.total ?? alerts.length;

  const closeAll = () => {
    if (markAll.isPending) return;
    onConfirmAllChange(false);
    setAllError(null);
  };
  const runAll = async () => {
    setAllError(null);
    try {
      const result = await markAll.mutateAsync();
      adminToast.success(result.marked === 1 ? "1 alerta marcado como visto." : `${formatInt(result.marked)} alertas marcados como vistos.`);
      onConfirmAllChange(false);
    } catch (failure) {
      setAllError(describeAdminError(failure));
    }
  };

  let body;
  if (query.isLoading) body = <AdminListSkeleton variant="alerts" rows={4} ariaLabel="Carregando alertas…" />;
  else if (query.error && alerts.length === 0) body = <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />;
  else if (alerts.length === 0 && loadedAlerts.length > 0) {
    body = (
      <>
        <AdminEmptyState compact icon="shield" title="Nenhum alerta deste tipo entre os carregados." description="O filtro vale só para os alertas já carregados; use “Carregar mais” para ver outros." />
        <AdminLoadMore
          loaded={loadedAlerts.length}
          total={total}
          hasMore={!!query.hasNextPage}
          loading={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          noun={{ singular: "alerta", plural: "alertas" }}
        />
      </>
    );
  } else if (alerts.length === 0) {
    body = (
      <AdminEmptyState
        compact
        icon="shield"
        title={status === "unseen" ? "Nenhum alerta novo. A sentinela está de olho." : "Nenhum alerta até agora. A sentinela está de olho."}
      />
    );
  } else {
    body = (
      <>
        <ul className="adm-sec-list" aria-label="Alertas de segurança">
          {alerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} onMarkSeen={setTarget} />
          ))}
        </ul>
        <AdminLoadMore
          loaded={loadedAlerts.length}
          total={total}
          hasMore={!!query.hasNextPage}
          loading={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          noun={{ singular: "alerta", plural: "alertas" }}
        />
      </>
    );
  }

  return (
    <>
      <AdminSection flush title="Alertas" description="Contas vigiadas que abriram sessão. A sentinela só avisa: não bloqueia nem suspende ninguém.">
        {body}
      </AdminSection>
      {target ? <SeenDialog alert={target} onClose={() => setTarget(null)} /> : null}
      <AdminConfirmDialog
        open={confirmAll}
        title="Marcar todos como vistos"
        description={unseen === 1 ? "O alerta novo será marcado como visto." : `Os ${formatInt(unseen)} alertas novos serão marcados como vistos.`}
        confirmLabel="Marcar todos"
        pendingLabel="Marcando…"
        tone="neutral"
        reason={false}
        pending={markAll.isPending}
        error={allError}
        onConfirm={() => void runAll()}
        onClose={closeAll}
      />
    </>
  );
}

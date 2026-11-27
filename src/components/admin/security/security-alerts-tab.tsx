import { Fragment, useId, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import {
  adminToast,
  AdminActionMenu,
  AdminAvatar,
  type AdminActionMenuItem,
  AdminConfirmDialog,
  AdminDialog,
  AdminEmptyState,
  AdminErrorState,
  AdminListSkeleton,
  AdminSection,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useMarkAlertSeen, useMarkAllAlertsSeen, useSecurityAlerts, useSecuritySummary } from "@/hooks/admin/use-admin-security";
import { describeAdminError } from "@/lib/admin/admin-errors";
import { civilDateInSaoPaulo, formatDate, formatDateTime, formatInt, formatRelativeTime, parseInstant } from "@/lib/admin/format";
import { isWatchedLoginAlert, type SecurityAlert, type SecurityAlertStatus, type SecurityWatch } from "@/shared/admin-platform.types";

import { AlertIcon, describeAlert, type AlertDetailRow } from "./security-alert-view";
import { WatchActivityDrawer } from "./security-watch-activity";
import { IncidentRow } from "./security-incident-row";
import { BulkStatusDialog, IncidentBlocks, incidentRoutes, isClosedIncident, repeatText, StatusDialog } from "./security-incident";
import { channelLabel, INCIDENT_STATUS_LABEL, kindLabel, matchesKind, NOTE_MAX, SEVERITY_LABEL, type KindFilter, type SeverityFilter } from "./security-labels";

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

/** Fim da lista: só aparece quando há mais alertas no servidor ("Carregar mais", com quantos faltam); no fim da lista não mostra nada. */
function MoreAlerts({ loaded, total, hasMore, loading, onLoadMore }: { loaded: number; total: number; hasMore: boolean; loading: boolean; onLoadMore: () => void }) {
  if (!hasMore) return null;
  const left = Math.max(0, total - loaded);
  return (
    <div className="adm-sec-more">
      <button type="button" className="btn out adm-btn-sm" aria-disabled={loading ? true : undefined} onClick={() => (loading ? undefined : onLoadMore())}>
        {loading ? "Carregando…" : left > 0 ? `Carregar mais (${formatInt(left)})` : "Carregar mais"}
      </button>
    </div>
  );
}

/** "Hoje", "Ontem" ou a data: o título de cada dia na lista (dia no fuso de São Paulo). */
function dayLabel(iso: string, now: number): string {
  const day = civilDateInSaoPaulo(parseInstant(iso) ?? new Date(iso));
  if (day === civilDateInSaoPaulo(now)) return "Hoje";
  if (day === civilDateInSaoPaulo(now - 86_400_000)) return "Ontem";
  return formatDate(iso);
}

/** O detalhe expandido do alerta: as linhas do descritor do tipo. Só texto (o React escapa), IP e rota em monoespaçada. */
function AlertDetails({ rows, id }: { rows: AlertDetailRow[]; id: string }) {
  return (
    <dl className="adm-sec-details" id={id}>
      {rows.map((row) => (
        <div key={row.label} data-wide={row.wide ? "true" : undefined}>
          <dt>{row.label}</dt>
          <dd className={`${row.mono ? "adm-sec-mono" : ""}${row.pre ? " adm-sec-details-reason" : ""}`.trim() || undefined}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Cor da bolinha da etiqueta, pela gravidade (alerta já visto fica cinza). */
const SEVERITY_DOT: Record<string, string> = { high: "#ff5a5f", medium: "#fbbf24", low: "rgba(255,255,255,0.7)" };

/**
 * O cartão do alerta, no mesmo desenho do cartão de vigiado: foto (ou ícone), pessoa; abaixo a etiqueta preta que alterna a
 * gravidade e o tipo; abaixo o que aconteceu (título e resumo do tipo, com etiquetas); e o menu "⋯" (Ver detalhes, Ver conta).
 * "Marcar como visto" fica à vista no rodapé. O que muda por tipo (rótulo da pessoa, resumo, detalhe) vem de `describeAlert`.
 */
function AlertRow({
  alert,
  onMarkSeen,
  selected,
  onToggleSelect,
}: {
  alert: SecurityAlert;
  onMarkSeen: (alert: SecurityAlert) => void;
  /** `undefined` = o incidente não pode ser selecionado (alerta antigo ou já tratado). */
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<{ id: number; email: string } | null>(null);
  const [changing, setChanging] = useState(false);
  const detailsId = useId();
  const seen = alert.seen_at !== null;
  const view = describeAlert(alert);
  const channel = isWatchedLoginAlert(alert) ? channelLabel(alert.details?.channel) : null;
  const kind = kindLabel(alert.kind);
  const user = alert.user;
  const adminActor = alert.kind === "admin_action" ? (alert.details as { actor_name?: string | null } | undefined)?.actor_name?.trim() : "";
  const name = user?.name?.trim() || adminActor || "";
  const severity = SEVERITY_LABEL[alert.severity] ?? alert.severity;
  const second = kind ?? (seen ? "Visto" : "Novo");
  const critical = Boolean(view?.critical) && !seen;
  const dotColor = seen ? "rgba(255,255,255,0.7)" : critical ? SEVERITY_DOT.high : (SEVERITY_DOT[alert.severity] ?? SEVERITY_DOT.low);

  const items: AdminActionMenuItem[] = [];
  if (view?.details && view.details.length > 0) {
    items.push({ id: "details", label: open ? "Ocultar detalhes" : "Ver detalhes", icon: "eye", onSelect: () => setOpen((value) => !value) });
  }
  if (alert.watchlist_id) {
    items.push({
      id: "activity",
      label: "Ver atividade",
      icon: "clock",
      onSelect: () => setActivity({ id: alert.watchlist_id as number, email: user?.email ?? "Conta vigiada" }),
    });
  }
  if (user) {
    items.push({
      id: "account",
      label: "Ver conta",
      icon: "user",
      onSelect: () => void navigate({ to: "/admin/users/$userId", params: { userId: String(user.id) } } as never),
    });
  }

  const person = view?.person;
  return (
    <li
      className="adm-sec-card adm-sec-alert"
      data-seen={seen ? "true" : undefined}
      data-kind={alert.kind}
      data-severity={alert.severity}
      data-critical={critical ? "true" : undefined}
    >
      <header className="adm-sec-card-top">
        {selected !== undefined && onToggleSelect ? (
          <input
            type="checkbox"
            className="adm-sec-pick"
            checked={selected}
            aria-label={`Selecionar ${alert.title}`}
            onChange={() => onToggleSelect(alert.id)}
          />
        ) : null}
        {view?.icon ? <AlertIcon name={view.icon} /> : <AdminAvatar name={name || user?.email || "?"} size={48} />}
        <div className="adm-sec-card-id">
          {person ? (
            <>
              <b className={`adm-sec-mail${!user && person.fallbackMono ? " adm-sec-mono" : ""}`}>
                {person.label} {user ? name || user.email || `Conta #${user.id}` : person.fallback}
              </b>
              {user && name && user.email ? <span className="adm-sec-name">{user.email}</span> : null}
            </>
          ) : view?.head ? (
            <>
              <b className={`adm-sec-mail${view.head.mono ? " adm-sec-mono" : ""}`}>{view.head.primary}</b>
              <span className="adm-sec-name">{view.head.secondary}</span>
            </>
          ) : user ? (
            <>
              <b className="adm-sec-mail">{user.email || name || `Conta #${user.id}`}</b>
              {name && user.email ? <span className="adm-sec-name">{name}</span> : null}
            </>
          ) : (
            <b className="adm-sec-mail">Conta não identificada</b>
          )}
        </div>
        {items.length > 0 ? <AdminActionMenu iconOnly variant="ghost" label="Ações" ariaLabel={`Ações do alerta ${alert.id}`} items={items} /> : null}
      </header>

      {/* a etiqueta preta alterna a gravidade e o tipo (passa o mouse e ela para) */}
      <div className="adm-sec-card-status">
        <span
          className="adm-sec-tag"
          data-active={seen ? "false" : "true"}
          role="img"
          aria-label={`Gravidade ${severity}, ${second}`}
          style={{ ["--dot-color" as string]: dotColor }}
        >
          <span className="adm-sec-tag-item" data-slot="a">
            <i aria-hidden="true" />
            {severity}
          </span>
          <span className="adm-sec-tag-item" data-slot="b">
            <I n={view?.tagIcon ?? "eye"} cls="sm" />
            {second}
          </span>
        </span>
      </div>

      <p className="adm-sec-reason adm-sec-alert-title">{alert.title}</p>
      {view?.summary && !alert.explanation?.what ? <p className="adm-sec-summary">{view.summary}</p> : null}
      <IncidentBlocks alert={alert} routes={incidentRoutes(alert, view?.routes)} />
      {view?.chips && view.chips.length > 0 ? (
        <p className="adm-sec-chips">
          {view.chips.map((chip) => (
            <span key={chip.text} className="adm-sec-pillchip" data-tone={chip.tone}>
              {chip.text}
            </span>
          ))}
        </p>
      ) : null}

      <p className="adm-sec-meta">
        {channel ? <span className="adm-sec-chan">{channel}</span> : null}
        {alert.status && alert.status !== "new" ? <span className="adm-sec-chan">{INCIDENT_STATUS_LABEL[alert.status]}</span> : null}
        {repeatText(alert) ? <span>{repeatText(alert)}</span> : null}
        <span className="adm-sec-when" title={formatDateTime(alert.created_at)}>
          <time dateTime={alert.created_at}>{formatDateTime(alert.created_at)}</time>
          <span className="adm-sec-rel">{formatRelativeTime(alert.created_at)}</span>
        </span>
        {seen ? <span>Visto em {formatDateTime(alert.seen_at)}</span> : null}
      </p>
      {alert.note ? <p className="adm-sec-note">“{alert.note}”</p> : null}
      {open && view?.details ? <AlertDetails rows={view.details} id={detailsId} /> : null}
      {activity ? <WatchActivityDrawer watch={{ id: activity.id, email: activity.email } as SecurityWatch} onClose={() => setActivity(null)} /> : null}

      {changing ? <StatusDialog alert={alert} onClose={() => setChanging(false)} /> : null}

      {!seen || view?.action || alert.status ? (
        <footer className="adm-sec-alert-foot">
          {!seen ? (
            <button type="button" className="adm-sec-seen" onClick={() => onMarkSeen(alert)}>
              <I n="check" cls="sm" />
              Marcar como visto
            </button>
          ) : null}
          {alert.status ? (
            <button type="button" className="adm-sec-secondary" onClick={() => setChanging(true)}>
              <I n="check" cls="sm" />
              Mudar status
            </button>
          ) : null}
          {view?.action ? (
            <button
              type="button"
              className="adm-sec-secondary"
              onClick={() => void navigate({ to: view.action!.to, search: view.action!.search } as never)}
            >
              <I n="users" cls="sm" />
              {view.action.label}
            </button>
          ) : null}
        </footer>
      ) : null}
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
  severity,
  onFocusUrgent,
  onWatchIp,
  confirmAll,
  onConfirmAllChange,
}: {
  status: SecurityAlertStatus;
  severity: SeverityFilter;
  /** "Ver agora" na faixa de urgência: o pai troca os filtros para Abertos + Alta. */
  onFocusUrgent: () => void;
  /** Link "Vigiar este IP" do incidente: o pai abre o formulário já com o IP. */
  onWatchIp?: (ip: string) => void;
  /** Filtro por tipo, só no cliente, sobre os alertas já carregados. */
  kind: KindFilter;
  confirmAll: boolean;
  onConfirmAllChange: (open: boolean) => void;
}) {
  const query = useSecurityAlerts(status, severity === "all" ? undefined : severity);
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const [bulk, setBulk] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const summary = useSecuritySummary();
  const needsAction = summary.data?.needs_action ?? 0;
  const markAll = useMarkAllAlertsSeen();
  const [target, setTarget] = useState<SecurityAlert | null>(null);
  const [allError, setAllError] = useState<string | null>(null);

  const now = useMemo(() => Date.now(), [query.dataUpdatedAt]);
  const pages = query.data?.pages ?? [];
  const loadedAlerts = pages.flatMap((page) => page.data);
  const alerts = loadedAlerts.filter((alert) => matchesKind(alert.kind, kind));
  // Só incidente aberto (novo ou investigando) pode ser selecionado; o resto não tem o que mudar em massa.
  const selectable = (alert: SecurityAlert) => alert.status !== undefined && !isClosedIncident(alert);
  const selectableIds = alerts.filter(selectable).map((alert) => alert.id);
  const pickedIds = selectableIds.filter((id) => picked.has(id));
  const toggle = (id: number) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        <MoreAlerts loaded={loadedAlerts.length} total={total} hasMore={!!query.hasNextPage} loading={query.isFetchingNextPage} onLoadMore={() => void query.fetchNextPage()} />
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
        <ul className="adm-sec-cards adm-sec-alerts" aria-label="Alertas de segurança">
          {alerts.map((alert, index) => {
            const label = dayLabel(alert.created_at, now);
            const header = index === 0 || label !== dayLabel(alerts[index - 1].created_at, now);
            return (
              <Fragment key={alert.id}>
                {header ? (
                  <li role="presentation" className="adm-sec-day">
                    {label}
                  </li>
                ) : null}
                {alert.explanation?.what ? (
                  <IncidentRow alert={alert} onWatchIp={onWatchIp} onMarkSeen={setTarget} selected={selecting && selectable(alert) ? picked.has(alert.id) : undefined} onToggleSelect={toggle} />
                ) : (
                  <AlertRow alert={alert} onMarkSeen={setTarget} selected={selecting && selectable(alert) ? picked.has(alert.id) : undefined} onToggleSelect={toggle} />
                )}
              </Fragment>
            );
          })}
        </ul>
        <MoreAlerts loaded={loadedAlerts.length} total={total} hasMore={!!query.hasNextPage} loading={query.isFetchingNextPage} onLoadMore={() => void query.fetchNextPage()} />
      </>
    );
  }

  return (
    <>
      {needsAction > 0 ? (
        <p className="adm-sec-needs" role="status">
          <span>
            <b>Precisa de ação agora:</b> {needsAction === 1 ? "1 incidente de gravidade alta aberto" : `${formatInt(needsAction)} incidentes de gravidade alta abertos`}
          </span>
          {status === "open" && severity === "high" ? null : (
            <button type="button" className="adm-sec-secondary" onClick={onFocusUrgent}>
              Ver agora
            </button>
          )}
        </p>
      ) : null}
      <AdminSection
        flush
        title="Alertas"
        description="Contas vigiadas que abriram sessão. A sentinela só avisa: não bloqueia nem suspende ninguém."
        actions={
          selectableIds.length > 0 || selecting ? (
            <button
              type="button"
              className="adm-sec-secondary"
              aria-pressed={selecting}
              onClick={() => {
                setSelecting((value) => !value);
                setPicked(new Set());
              }}
            >
              {selecting ? "Cancelar seleção" : "Selecionar"}
            </button>
          ) : null
        }
      >
        {body}
      </AdminSection>
      {pickedIds.length > 0 ? (
        <div className="adm-sec-bulk" role="region" aria-label="Seleção de incidentes">
          <span>{pickedIds.length === 1 ? "1 selecionado" : `${formatInt(pickedIds.length)} selecionados`}</span>
          {pickedIds.length < selectableIds.length ? (
            <button type="button" className="adm-sec-secondary" onClick={() => setPicked(new Set(selectableIds))}>
              Selecionar os {formatInt(selectableIds.length)} visíveis
            </button>
          ) : null}
          <button type="button" className="adm-sec-secondary" onClick={() => setPicked(new Set())}>
            Limpar
          </button>
          <button type="button" className="adm-sec-seen" onClick={() => setBulk(true)}>
            <I n="check" cls="sm" />
            Mudar status
          </button>
        </div>
      ) : null}
      {bulk ? <BulkStatusDialog ids={pickedIds} onClose={() => setBulk(false)} onDone={(failed) => setPicked(new Set(failed))} /> : null}
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

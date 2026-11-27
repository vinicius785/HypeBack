import { useId, useMemo, useState } from "react";

import {
  adminToast,
  AdminActionMenu,
  type AdminActionMenuItem,
  AdminConfirmDialog,
  AdminDialog,
  AdminEmptyState,
  AdminErrorState,
  AdminListSkeleton,
  AdminSection,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useSecurityWatchIps, useStopWatchingIp, useWatchIp } from "@/hooks/admin/use-admin-security";
import { describeAdminError } from "@/lib/admin/admin-errors";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/admin/format";
import type { SecurityWatchIp } from "@/shared/admin-platform.types";

import { AlertIcon } from "./security-alert-view";
import {
  DEFAULT_WATCH_DAYS,
  DEFAULT_WATCH_FILTER,
  expiryDaysText,
  normalizeIp,
  REASON_MAX,
  REASON_MIN,
  WATCH_DURATIONS,
  WATCH_IP_NOTE,
  watchExpiry,
  type WatchFilter,
} from "./security-labels";
import { WatchActivityDrawer } from "./security-watch-activity";

import "@/styles/admin-security.css";

/** Ativos primeiro; dentro de cada grupo, o mais recente no topo. */
export function sortWatchIps(list: readonly SecurityWatchIp[]): SecurityWatchIp[] {
  return [...list].sort((a, b) => Number(b.active) - Number(a.active) || Date.parse(b.created_at) - Date.parse(a.created_at));
}

/** Diálogo "Vigiar IP": IP exato (IPv4 ou IPv6, sem faixa), motivo (5 a 500) e prazo. Aceita o IP já preenchido (vindo do alerta). */
export function WatchIpDialog({ onClose, initialIp, initialReason }: { onClose: () => void; initialIp?: string; initialReason?: string }) {
  const reactivating = Boolean(initialReason);
  const [ip, setIp] = useState(initialIp ?? "");
  const [reason, setReason] = useState(initialReason ?? "");
  const [days, setDays] = useState<number | null>(DEFAULT_WATCH_DAYS);
  const [touched, setTouched] = useState({ ip: false, reason: false });
  const [error, setError] = useState<string | null>(null);
  const mutation = useWatchIp();
  const ids = { ip: useId(), reason: useId() };

  const normalized = normalizeIp(ip);
  const ipError = normalized ? null : "Informe um IP exato (IPv4 ou IPv6), sem faixa.";
  const reasonError = reason.trim().length < REASON_MIN ? `Descreva o motivo com pelo menos ${REASON_MIN} caracteres.` : null;

  const submit = async () => {
    setTouched({ ip: true, reason: true });
    if (!normalized || reasonError || mutation.isPending) return;
    setError(null);
    try {
      const result = await mutation.mutateAsync({ ip: normalized, reason, ...(days ? { days } : {}) });
      adminToast.success(result.reactivated ? "Vigilância do IP reativada." : "IP adicionado aos vigiados.");
      onClose();
    } catch (failure) {
      setError(describeAdminError(failure));
    }
  };

  return (
    <AdminDialog
      open
      title={reactivating ? "Reativar vigilância do IP" : "Vigiar IP"}
      description={WATCH_IP_NOTE}
      busy={mutation.isPending}
      dirty={!reactivating && (ip.trim() !== "" || reason.trim() !== "")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn out" disabled={mutation.isPending} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" disabled={mutation.isPending} onClick={() => void submit()}>
            {mutation.isPending ? "Salvando…" : reactivating ? "Reativar" : "Vigiar"}
          </button>
        </>
      }
    >
      <div className="adm-field">
        <label htmlFor={ids.ip}>IP</label>
        <input
          id={ids.ip}
          className="adm-input adm-sec-mono"
          value={ip}
          readOnly={mutation.isPending || reactivating}
          autoComplete="off"
          spellCheck={false}
          placeholder="203.0.113.7"
          aria-invalid={touched.ip && ipError ? true : undefined}
          data-adm-autofocus
          onChange={(event) => setIp(event.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, ip: true }))}
        />
        <div className="adm-field-foot">
          <span data-error={touched.ip && ipError ? "true" : undefined}>{touched.ip ? (ipError ?? "") : ""}</span>
        </div>
      </div>
      <div className="adm-field">
        <label htmlFor={ids.reason}>Motivo</label>
        <textarea
          id={ids.reason}
          className="adm-input"
          value={reason}
          maxLength={REASON_MAX}
          readOnly={mutation.isPending}
          placeholder="Por que este IP precisa ser vigiado?"
          aria-invalid={touched.reason && reasonError ? true : undefined}
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, reason: true }))}
        />
        <div className="adm-field-foot">
          <span data-error={touched.reason && reasonError ? "true" : undefined}>{touched.reason ? (reasonError ?? "") : ""}</span>
          <span className="adm-field-count">
            {reason.length}/{REASON_MAX}
          </span>
        </div>
      </div>
      <fieldset className="adm-field adm-sec-durs" disabled={mutation.isPending}>
        <legend>Por quanto tempo vigiar?</legend>
        <div className="adm-sec-durs-g" role="radiogroup" aria-label="Prazo da vigilância">
          {WATCH_DURATIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={days === option.days}
              className="adm-sec-dur"
              data-on={days === option.days ? "true" : undefined}
              onClick={() => setDays(option.days)}
            >
              <b>{option.label}</b>
              {option.hint ? <small>{option.hint}</small> : null}
            </button>
          ))}
        </div>
        <small className="adm-sec-durs-note">{days ? "Depois do prazo, a vigilância termina sozinha." : "A vigilância fica ativa até alguém parar."}</small>
      </fieldset>
      {error ? (
        <div className="adm-dialog-error" role="alert">
          {error}
        </div>
      ) : null}
    </AdminDialog>
  );
}

function WatchIpCard({
  watch,
  index,
  onStop,
  onActivity,
  onReactivate,
}: {
  watch: SecurityWatchIp;
  index: number;
  onStop: (watch: SecurityWatchIp) => void;
  onActivity: (watch: SecurityWatchIp) => void;
  onReactivate: (watch: SecurityWatchIp) => void;
}) {
  const expiry = watchExpiry(watch);
  const items: AdminActionMenuItem[] = [{ id: "activity", label: "Ver atividade", icon: "clock", onSelect: () => onActivity(watch) }];
  if (watch.active) items.push({ id: "stop", label: "Parar de vigiar", icon: "eye", tone: "danger", onSelect: () => onStop(watch) });
  else items.push({ id: "reactivate", label: "Reativar vigilância", icon: "refresh", onSelect: () => onReactivate(watch) });

  return (
    <li className="adm-sec-card" data-active={watch.active ? "true" : "false"} style={{ ["--i" as string]: Math.min(index, 8) }}>
      <header className="adm-sec-card-top">
        <AlertIcon name="eye" />
        <div className="adm-sec-card-id">
          <b className="adm-sec-mail adm-sec-mono">{watch.ip}</b>
          <span className="adm-sec-name">
            Vigiado desde {formatDate(watch.created_at)} ({formatRelativeTime(watch.created_at)})
            {!watch.active && watch.deactivated_at ? ` · parou em ${formatDate(watch.deactivated_at)}` : ""}
          </span>
        </div>
        <AdminActionMenu iconOnly variant="ghost" label="Ações" ariaLabel={`Ações do IP ${watch.ip}`} items={items} />
      </header>

      <div className="adm-sec-card-status">
        <span className="adm-sec-tag" data-active={watch.active ? "true" : "false"} role="img" aria-label={watch.active ? "Ativo" : "Inativo"}>
          <span className="adm-sec-tag-item" data-slot="a">
            <i aria-hidden="true" />
            {watch.active ? "Ativo" : "Inativo"}
          </span>
          <span className="adm-sec-tag-item" data-slot="b">
            <I n="eye" cls="sm" />
            IP vigiado
          </span>
        </span>
      </div>

      <p className="adm-sec-reason">{watch.reason}</p>

      <p className="adm-sec-expiry" data-state={expiry.state}>
        <I n="clock" cls="sm" />
        {expiry.state === "none" ? (
          watch.active ? "Sem prazo" : "Vigilância encerrada"
        ) : expiry.state === "ended" ? (
          <>Prazo encerrado em {formatDate(expiry.iso)}</>
        ) : (
          <>
            Vigiado até {formatDate(expiry.iso)}
            {expiry.state === "soon" ? <b>{expiryDaysText(expiry.daysLeft)}</b> : null}
          </>
        )}
      </p>

      <div className="adm-sec-lastact">
        <span className="adm-sec-lastact-text">
          {watch.last_activity_at ? (
            <>
              Última atividade{" "}
              <time dateTime={watch.last_activity_at} title={formatDateTime(watch.last_activity_at)}>
                {formatDateTime(watch.last_activity_at)} · {formatRelativeTime(watch.last_activity_at)}
              </time>
            </>
          ) : (
            "Nenhuma atividade ainda"
          )}
        </span>
        <button type="button" className="adm-sec-link" onClick={() => onActivity(watch)}>
          Ver atividade
        </button>
      </div>
    </li>
  );
}

/** Aba "IPs vigiados": os IPs sob vigilância (ativos primeiro). O filtro e o "Vigiar IP" ficam na ilha da tela. */
export function SecurityWatchIpsTab({
  filter,
  onShowAll,
  reactivating,
  onReactivatingChange,
}: {
  filter: WatchFilter;
  onShowAll: () => void;
  reactivating: SecurityWatchIp | null;
  onReactivatingChange: (watch: SecurityWatchIp | null) => void;
}) {
  const query = useSecurityWatchIps();
  const stop = useStopWatchingIp();
  const [target, setTarget] = useState<SecurityWatchIp | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const [activityFor, setActivityFor] = useState<SecurityWatchIp | null>(null);

  const all = useMemo(() => (query.data ? sortWatchIps(query.data) : []), [query.data]);
  const list = useMemo(() => all.filter((watch) => filter === "all" || (filter === "active" ? watch.active : !watch.active)), [all, filter]);

  const closeStop = () => {
    if (stop.isPending) return;
    setTarget(null);
    setStopError(null);
  };
  const runStop = async () => {
    if (!target) return;
    setStopError(null);
    try {
      await stop.mutateAsync(target.id);
      adminToast.success("Pronto: o IP deixou de ser vigiado.");
      setTarget(null);
    } catch (failure) {
      setStopError(describeAdminError(failure));
    }
  };

  let body;
  if (query.isLoading) body = <AdminListSkeleton variant="rows" rows={3} ariaLabel="Carregando IPs vigiados…" />;
  else if (query.error) body = <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />;
  else if (all.length === 0) {
    body = <AdminEmptyState compact icon="eye" title="Nenhum IP vigiado" description="Use “Vigiar IP”, na ilha, ou o link “Vigiar este IP” de um alerta." />;
  } else if (list.length === 0 && filter === DEFAULT_WATCH_FILTER) {
    body = (
      <AdminEmptyState
        compact
        icon="eye"
        title="Nenhum IP vigiado ativo"
        description="Todos os IPs da lista já foram encerrados. O histórico está em “Todos”."
        action={
          <button type="button" className="btn out adm-btn-sm" onClick={onShowAll}>
            Ver todos
          </button>
        }
      />
    );
  } else if (list.length === 0) {
    body = <AdminEmptyState compact icon="search" title="Nada encontrado" description="Nenhum IP combina com o filtro." />;
  } else {
    body = (
      <ul className="adm-sec-cards" aria-label="IPs vigiados">
        {list.map((watch, index) => (
          <WatchIpCard key={watch.id} watch={watch} index={index} onStop={setTarget} onActivity={setActivityFor} onReactivate={onReactivatingChange} />
        ))}
      </ul>
    );
  }

  return (
    <>
      <AdminSection flush title="IPs que estamos vigiando" description={WATCH_IP_NOTE}>
        {body}
      </AdminSection>
      {reactivating ? <WatchIpDialog initialIp={reactivating.ip} initialReason={reactivating.reason} onClose={() => onReactivatingChange(null)} /> : null}
      {activityFor ? <WatchActivityDrawer kind="ip" watch={{ id: activityFor.id, email: activityFor.ip }} onClose={() => setActivityFor(null)} /> : null}
      <AdminConfirmDialog
        open={target !== null}
        title="Parar de vigiar"
        description="O IP deixa de gerar alertas. O histórico fica guardado."
        confirmLabel="Parar de vigiar"
        pendingLabel="Parando…"
        tone="neutral"
        reason={false}
        pending={stop.isPending}
        error={stopError}
        onConfirm={() => void runStop()}
        onClose={closeStop}
      />
    </>
  );
}

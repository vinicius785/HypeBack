import { useId, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";

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
import { useStopWatching, useSecurityWatchlist, useWatchEmail } from "@/hooks/admin/use-admin-security";
import { isAdminApiError } from "@/lib/admin/admin-client";
import { describeAdminError } from "@/lib/admin/admin-errors";
import { formatDate, formatRelativeTime } from "@/lib/admin/format";
import type { SecurityWatch } from "@/shared/admin-platform.types";

import { DEFAULT_WATCH_FILTER, filterWatchlist, REASON_MAX, REASON_MIN, WATCH_ALREADY_TEXT, type WatchFilter } from "./security-labels";

import "@/styles/admin-security.css";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ativos primeiro; dentro de cada grupo, o mais recente no topo. */
export function sortWatchlist(list: readonly SecurityWatch[]): SecurityWatch[] {
  return [...list].sort((a, b) => Number(b.active) - Number(a.active) || Date.parse(b.created_at) - Date.parse(a.created_at));
}

/** Diálogo "Vigiar e-mail": e-mail e motivo (5 a 500). 409 vira o texto fixo; 400 mostra as mensagens da API. */
function WatchDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState({ email: false, reason: false });
  const [error, setError] = useState<string | null>(null);
  const mutation = useWatchEmail();
  const ids = { email: useId(), reason: useId() };

  const emailError = !EMAIL_SHAPE.test(email.trim()) ? "Informe um e-mail válido." : null;
  const reasonError = reason.trim().length < REASON_MIN ? `Descreva o motivo com pelo menos ${REASON_MIN} caracteres.` : null;
  const valid = !emailError && !reasonError;

  const submit = async () => {
    setTouched({ email: true, reason: true });
    if (!valid || mutation.isPending) return;
    setError(null);
    try {
      const result = await mutation.mutateAsync({ email, reason });
      adminToast.success(result.reactivated ? "Vigilância reativada." : "E-mail adicionado aos vigiados.");
      onClose();
    } catch (failure) {
      setError(isAdminApiError(failure, "WATCH_ALREADY_ACTIVE") ? WATCH_ALREADY_TEXT : describeAdminError(failure));
    }
  };

  return (
    <AdminDialog
      open
      title="Vigiar e-mail"
      description="Quando uma conta com este e-mail abrir sessão, a sentinela cria um alerta. Nada é bloqueado."
      busy={mutation.isPending}
      dirty={email.trim() !== "" || reason.trim() !== ""}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn out" disabled={mutation.isPending} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" disabled={mutation.isPending} onClick={() => void submit()}>
            {mutation.isPending ? "Salvando…" : "Vigiar"}
          </button>
        </>
      }
    >
      <div className="adm-field">
        <label htmlFor={ids.email}>E-mail</label>
        <input
          id={ids.email}
          type="email"
          className="adm-input"
          value={email}
          readOnly={mutation.isPending}
          autoComplete="off"
          spellCheck={false}
          placeholder="nome@empresa.com.br"
          aria-invalid={touched.email && emailError ? true : undefined}
          data-adm-autofocus
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        />
        <div className="adm-field-foot">
          <span data-error={touched.email && emailError ? "true" : undefined}>{touched.email ? (emailError ?? "") : ""}</span>
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
          placeholder="Por que esta conta precisa ser vigiada?"
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
      {error ? (
        <div className="adm-dialog-error" role="alert">
          {error}
        </div>
      ) : null}
    </AdminDialog>
  );
}

/** O cartão de quem é vigiado: foto, e-mail e nome; abaixo o estado e se já tem conta; abaixo o motivo; e o menu "⋯" (Ver conta, Parar de vigiar). */
function WatchCard({ watch, index, onStop }: { watch: SecurityWatch; index: number; onStop: (watch: SecurityWatch) => void }) {
  const navigate = useNavigate();
  const account = watch.registered_user;
  const accountName = account ? account.name?.trim() || `Conta #${account.id}` : null;
  const since = `Vigiado desde ${formatDate(watch.created_at)} (${formatRelativeTime(watch.created_at)})${
    !watch.active && watch.deactivated_at ? ` · parou em ${formatDate(watch.deactivated_at)}` : ""
  }`;

  const items: AdminActionMenuItem[] = [];
  if (account) {
    items.push({
      id: "account",
      label: "Ver conta",
      icon: "user",
      onSelect: () => void navigate({ to: "/admin/users/$userId", params: { userId: String(account.id) } } as never),
    });
  }
  if (watch.active) items.push({ id: "stop", label: "Parar de vigiar", icon: "eye", tone: "danger", onSelect: () => onStop(watch) });

  return (
    <li className="adm-sec-card" data-active={watch.active ? "true" : "false"} style={{ ["--i" as string]: Math.min(index, 8) }}>
      <header className="adm-sec-card-top">
        <AdminAvatar name={accountName ?? watch.email} photo={account?.photo} size={48} />
        <div className="adm-sec-card-id">
          <b className="adm-sec-mail">{watch.email}</b>
          {accountName ? <span className="adm-sec-name">{accountName}</span> : <span className="adm-sec-name adm-sec-name-empty">Sem nome ainda</span>}
        </div>
        {items.length > 0 ? <AdminActionMenu iconOnly variant="ghost" label="Ações" ariaLabel={`Ações de ${watch.email}`} items={items} /> : null}
      </header>

      {/* uma etiqueta só, preta, que alterna as duas informações: o estado e se já tem conta (passa o mouse e ela para) */}
      <div className="adm-sec-card-status">
        <span
          className="adm-sec-tag"
          data-active={watch.active ? "true" : "false"}
          role="img"
          aria-label={`${watch.active ? "Ativo" : "Inativo"}, ${account ? "Já tem conta" : "Ainda sem conta"}`}
          title={since}
        >
          <span className="adm-sec-tag-item" data-slot="a">
            <i aria-hidden="true" />
            {watch.active ? "Ativo" : "Inativo"}
          </span>
          <span className="adm-sec-tag-item" data-slot="b">
            <I n={account ? "check" : "clock"} cls="sm" />
            {account ? "Já tem conta" : "Ainda sem conta"}
          </span>
        </span>
      </div>

      <p className="adm-sec-reason">{watch.reason}</p>
    </li>
  );
}

/**
 * Aba "Vigiados": os cartões de quem está sob vigilância (ativos primeiro). O filtro, a busca e o "Vigiar e-mail" ficam na ilha
 * da tela (`SecurityPage`), que passa o estado pronto: aqui só se mostra a lista e se cuida do cadastro e do "Parar de vigiar".
 */
export function SecurityWatchlistTab({
  filter,
  term,
  adding,
  onAddingChange,
  onClearFilters,
  onShowAll,
}: {
  filter: WatchFilter;
  term: string;
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
  onClearFilters: () => void;
  /** Passa o filtro para "Todos" (quando não há nenhum vigiado ativo e só restam os encerrados). */
  onShowAll: () => void;
}) {
  const query = useSecurityWatchlist();
  const stop = useStopWatching();
  const [target, setTarget] = useState<SecurityWatch | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);

  const all = useMemo(() => (query.data ? sortWatchlist(query.data) : []), [query.data]);
  const list = useMemo(() => filterWatchlist(all, filter, term), [all, filter, term]);

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
      adminToast.success("Pronto: a conta deixou de ser vigiada.");
      setTarget(null);
    } catch (failure) {
      setStopError(describeAdminError(failure));
    }
  };

  let body;
  if (query.isLoading) body = <AdminListSkeleton variant="rows" rows={3} ariaLabel="Carregando vigiados…" />;
  else if (query.error) body = <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />;
  else if (all.length === 0) {
    body = <AdminEmptyState compact icon="eye" title="Nenhum e-mail vigiado" description="Use “Vigiar e-mail”, na ilha, e a sentinela avisa quando essa conta abrir sessão." />;
  } else if (list.length === 0 && filter === DEFAULT_WATCH_FILTER && !term.trim()) {
    body = (
      <AdminEmptyState
        compact
        icon="eye"
        title="Nenhum vigiado ativo"
        description="Todos os e-mails da lista já foram encerrados. O histórico está em “Todos”."
        action={
          <button type="button" className="btn out adm-btn-sm" onClick={onShowAll}>
            Ver todos
          </button>
        }
      />
    );
  } else if (list.length === 0) {
    body = (
      <AdminEmptyState
        compact
        icon="search"
        title="Nada encontrado"
        description="Nenhum vigiado combina com o filtro ou a busca."
        action={
          <button type="button" className="btn out adm-btn-sm" onClick={onClearFilters}>
            Limpar filtros
          </button>
        }
      />
    );
  } else {
    body = (
      <ul className="adm-sec-cards" aria-label="E-mails vigiados">
        {list.map((watch, index) => (
          <WatchCard key={watch.id} watch={watch} index={index} onStop={setTarget} />
        ))}
      </ul>
    );
  }

  return (
    <>
      <AdminSection flush title="Quem estamos vigiando" description="Quando uma destas contas abre sessão, a API cria um alerta.">
        {body}
      </AdminSection>
      {adding ? <WatchDialog onClose={() => onAddingChange(false)} /> : null}
      <AdminConfirmDialog
        open={target !== null}
        title="Parar de vigiar"
        description="A conta deixa de gerar alertas. O histórico fica guardado."
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

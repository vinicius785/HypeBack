import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { AdminDialog, AdminErrorState, AdminLink, AdminSection, adminToast } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useReleaseShield, useShieldHeld } from "@/hooks/admin/use-admin-shield";
import { formatBRLFromCents, formatInt, formatRelativeTime } from "@/lib/admin/format";
import { isShieldCodeComplete } from "@/lib/admin/shield";
import type { ShieldHeld, ShieldReleaseWhat } from "@/shared/admin-platform.types";

import { userDetailLink } from "../../users/admin-users-links";
import { ShieldCodeField } from "./shield-code-field";
import { describeShieldError, isShieldLocked } from "./shield-format";

import "@/styles/admin-security.css";
import "@/styles/admin-users.css";

export function releasedText(accounts: number, withdrawals: number): string {
  const a = `${formatInt(accounts)} ${accounts === 1 ? "conta" : "contas"}`;
  const w = `${formatInt(withdrawals)} ${withdrawals === 1 ? "saque" : "saques"}`;
  const verb = accounts + withdrawals === 1 ? "liberado" : "liberados";
  return `${a} e ${w} ${verb}.`;
}

const TITLE: Record<ShieldReleaseWhat, string> = { accounts: "Liberar contas", withdrawals: "Liberar saques", all: "Liberar tudo" };

/**
 * Confirmação de "Liberar": diz o que sai, avisa que liberar saque dispara o PIX na hora e pede o código do Authenticator.
 * `userIds` / `withdrawalIds` liberam só os escolhidos; sem eles, libera tudo o que está retido naquele grupo.
 */
export function ReleaseDialog({
  what,
  userIds,
  withdrawalIds,
  held,
  onClose,
  onReleased,
}: {
  what: ShieldReleaseWhat;
  userIds?: number[];
  withdrawalIds?: number[];
  /** Contagens retidas (para dizer "todas as N"). Opcional quando se libera uma seleção. */
  held?: Pick<ShieldHeld, "accounts" | "withdrawals">;
  onClose: () => void;
  onReleased?: (result: { accounts_released: number; withdrawals_released: number }) => void;
}) {
  const mutation = useReleaseShield();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const picksAccounts = userIds && userIds.length > 0;
  const picksWithdrawals = withdrawalIds && withdrawalIds.length > 0;
  const includesWithdrawals = what !== "accounts";
  const includesAccounts = what !== "withdrawals";

  const accountsLine = includesAccounts
    ? picksAccounts
      ? `${formatInt(userIds.length)} ${userIds.length === 1 ? "conta escolhida volta" : "contas escolhidas voltam"} a ficar ativa${userIds.length === 1 ? "" : "s"}.`
      : `${held ? `Todas as ${formatInt(held.accounts)} contas em análise` : "Todas as contas em análise"} voltam a ficar ativas.`
    : null;
  const withdrawalsLine = includesWithdrawals
    ? picksWithdrawals
      ? `${formatInt(withdrawalIds.length)} ${withdrawalIds.length === 1 ? "saque escolhido é liberado" : "saques escolhidos são liberados"}.`
      : `${held ? `Todos os ${formatInt(held.withdrawals)} saques em espera` : "Todos os saques em espera"} são liberados.`
    : null;

  const submit = async () => {
    if (!isShieldCodeComplete(code) || mutation.isPending || locked) return;
    setError(null);
    try {
      const result = await mutation.mutateAsync({
        what,
        ...(picksAccounts ? { user_ids: userIds } : {}),
        ...(picksWithdrawals ? { withdrawal_ids: withdrawalIds } : {}),
        code,
      });
      adminToast.success(releasedText(result.accounts_released, result.withdrawals_released));
      onReleased?.(result);
      onClose();
    } catch (failure) {
      setError(describeShieldError(failure));
      setLocked(isShieldLocked(failure));
      setCode("");
    }
  };

  return (
    <AdminDialog
      open
      title={TITLE[what]}
      description="Confirme com o código do Authenticator."
      busy={mutation.isPending}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn out" disabled={mutation.isPending} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" disabled={mutation.isPending || locked || !isShieldCodeComplete(code)} onClick={() => void submit()}>
            {mutation.isPending ? "Liberando…" : TITLE[what]}
          </button>
        </>
      }
    >
      <ul className="adm-shield-effects adm-shield-release">
        {accountsLine ? <li>{accountsLine}</li> : null}
        {withdrawalsLine ? <li>{withdrawalsLine}</li> : null}
      </ul>
      {includesWithdrawals ? (
        <p className="adm-conseq-note" role="note">
          <I n="alert" cls="sm" />
          <span>Liberar um saque dispara o PIX na hora. Não dá para desfazer.</span>
        </p>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <ShieldCodeField value={code} onChange={setCode} disabled={mutation.isPending || locked} autoFocus />
      </form>
      {error ? (
        <div className="adm-dialog-error" role="alert">
          {error}
        </div>
      ) : null}
    </AdminDialog>
  );
}

/**
 * "Retido pelo Escudo": só existe quando há conta em análise ou saque em espera (mesmo com o Escudo desligado). Mostra as
 * contagens (a de contas leva à lista de Pessoas filtrada), a tabela de saques e os botões de liberar, cada um com confirmação
 * e código. Para liberar só algumas CONTAS, use a lista de Pessoas (marque e libere por lá); aqui, só os saques marcados.
 */
export function ShieldHeldSection() {
  const held = useShieldHeld();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [release, setRelease] = useState<ShieldReleaseWhat | null>(null);
  const data = held.data;

  const list = useMemo(() => data?.withdrawals_list ?? [], [data]);
  const total = (data?.accounts ?? 0) + (data?.withdrawals ?? 0);

  if (held.isLoading || (!held.error && total === 0)) return null;
  if (held.error) {
    return (
      <AdminSection title="Retido pelo Escudo" flush>
        <AdminErrorState compact error={held.error} onRetry={() => void held.refetch()} retrying={held.isRefetching} />
      </AdminSection>
    );
  }

  const toggle = (id: number) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allPicked = list.length > 0 && picked.size === list.length;
  const chosen = [...picked];

  return (
    <AdminSection title="Retido pelo Escudo" description="Contas e saques que o Escudo segurou até alguém liberar." flush>
      <div className="adm-shield-held">
        <div className="adm-shield-counts">
          <button
            type="button"
            className="adm-shield-count"
            disabled={!data?.accounts}
            onClick={() => void navigate({ to: "/admin/creators", search: { account_status: "under_review" } } as never)}
          >
            <b>{formatInt(data?.accounts ?? 0)}</b>
            <span>{data?.accounts === 1 ? "conta em análise" : "contas em análise"}</span>
            <I n="chev" cls="sm" />
          </button>
          <div className="adm-shield-count" data-static="true">
            <b>{formatInt(data?.withdrawals ?? 0)}</b>
            <span>{data?.withdrawals === 1 ? "saque em espera" : "saques em espera"}</span>
          </div>
        </div>

        {list.length > 0 ? (
          <table className="adm-shield-table">
            <caption className="adm-sr">Saques em espera</caption>
            <thead>
              <tr>
                <th scope="col">
                  <input
                    type="checkbox"
                    aria-label="Marcar todos os saques"
                    checked={allPicked}
                    onChange={() => setPicked(allPicked ? new Set() : new Set(list.map((w) => w.withdrawal_id)))}
                  />
                </th>
                <th scope="col">Saque</th>
                <th scope="col">Conta</th>
                <th scope="col" className="adm-shield-num">
                  Valor
                </th>
                <th scope="col">Em espera</th>
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.withdrawal_id} data-picked={picked.has(w.withdrawal_id) ? "true" : undefined}>
                  <td>
                    <input type="checkbox" aria-label={`Marcar o saque ${w.withdrawal_id}`} checked={picked.has(w.withdrawal_id)} onChange={() => toggle(w.withdrawal_id)} />
                  </td>
                  <td>
                    <code className="adm-sec-mono">#{w.withdrawal_id}</code>
                  </td>
                  <td>
                    <AdminLink to={userDetailLink(w.user_id)} textLink>
                      Conta #{w.user_id}
                    </AdminLink>
                  </td>
                  <td className="adm-shield-num">{formatBRLFromCents(w.amount_cents)}</td>
                  <td>{formatRelativeTime(w.held_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <div className="adm-shield-actions">
          <button type="button" className="btn out" disabled={!data?.accounts} onClick={() => setRelease("accounts")}>
            Liberar contas
          </button>
          <button
            type="button"
            className="btn out"
            disabled={!data?.withdrawals}
            onClick={() => setRelease("withdrawals")}
          >
            {chosen.length > 0 ? `Liberar ${chosen.length} ${chosen.length === 1 ? "saque marcado" : "saques marcados"}` : "Liberar saques"}
          </button>
          <button type="button" className="btn" disabled={total === 0} onClick={() => setRelease("all")}>
            Liberar tudo
          </button>
        </div>
      </div>

      {release ? (
        <ReleaseDialog
          what={release}
          // Saques marcados só valem para "Liberar saques"; "Liberar tudo" e "Liberar contas" liberam o que está retido.
          withdrawalIds={release === "withdrawals" && chosen.length > 0 ? chosen : undefined}
          held={data}
          onClose={() => setRelease(null)}
          onReleased={() => setPicked(new Set())}
        />
      ) : null}
    </AdminSection>
  );
}

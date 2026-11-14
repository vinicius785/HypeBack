import { useState } from "react";

import {
  AdminDialog,
  AdminErrorState,
  AdminListSkeleton,
  AdminSection,
  adminToast,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import {
  useActivateShield,
  useDeactivateShield,
  useShield,
} from "@/hooks/admin/use-admin-shield";
import { isShieldCodeComplete } from "@/lib/admin/shield";
import { formatDateTime } from "@/lib/admin/format";
import type { ShieldStatus } from "@/shared/admin-platform.types";

import { ShieldCodeField } from "./shield-code-field";
import {
  DEFAULT_SHIELD_HOURS,
  SHIELD_STEPS,
  shieldClock,
  SHIELD_HOURS,
  SHIELD_REASON_MAX,
  SHIELD_REASON_MIN,
  describeShieldError,
  formatShieldEnd,
  isShieldLocked,
  shieldRemaining,
} from "./shield-format";

import "@/styles/admin-security.css";

/** Janela "Ativar Operação Escudo": motivo, duração, código e a lista do que muda. Erros ficam na janela, para tentar de novo. */
export function ActivateDialog({ onClose }: { onClose: () => void }) {
  const mutation = useActivateShield();
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState<number>(DEFAULT_SHIELD_HOURS);
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const reasonError =
    reason.trim().length < SHIELD_REASON_MIN
      ? `Descreva o motivo com pelo menos ${SHIELD_REASON_MIN} caracteres.`
      : null;
  const valid = !reasonError && isShieldCodeComplete(code) && !locked;

  const submit = async () => {
    setTouched(true);
    if (!valid || mutation.isPending) return;
    setError(null);
    try {
      await mutation.mutateAsync({ reason: reason.trim(), hours, code });
      adminToast.success("Operação Escudo ativada.");
      onClose();
    } catch (failure) {
      setError(describeShieldError(failure));
      setLocked(isShieldLocked(failure));
      // Cada código vale uma vez: o campo limpa para digitar o próximo.
      setCode("");
    }
  };

  const reasonShown = touched && reasonError;
  const codeError =
    touched && !isShieldCodeComplete(code) && !error
      ? "Digite o código de 6 dígitos."
      : null;

  return (
    <AdminDialog
      open
      title="Ativar Operação Escudo"
      description="As regras de “O que muda” passam a valer na hora e terminam sozinhas no prazo."
      busy={mutation.isPending}
      dirty={reason.trim() !== ""}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn out"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            disabled={mutation.isPending || locked}
            onClick={() => void submit()}
          >
            {mutation.isPending ? "Ativando…" : "Ativar Escudo"}
          </button>
        </>
      }
    >
      <div className="adm-field">
        <label htmlFor="shield-reason">Motivo</label>
        <textarea
          id="shield-reason"
          className="adm-input"
          value={reason}
          maxLength={SHIELD_REASON_MAX}
          readOnly={mutation.isPending}
          placeholder="Por que ativar agora?"
          aria-invalid={reasonShown ? true : undefined}
          data-adm-autofocus
          onChange={(event) => setReason(event.target.value)}
        />
        <div className="adm-field-foot">
          <span data-error={reasonShown ? "true" : undefined}>
            {reasonShown ? reasonError : ""}
          </span>
          <span className="adm-field-count">
            {reason.length}/{SHIELD_REASON_MAX}
          </span>
        </div>
      </div>

      <fieldset
        className="adm-field adm-sec-durs"
        disabled={mutation.isPending}
      >
        <legend>Por quanto tempo?</legend>
        <div
          className="adm-sec-durs-g"
          data-count={SHIELD_HOURS.length}
          role="radiogroup"
          aria-label="Duração do Escudo"
        >
          {SHIELD_HOURS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={hours === option}
              aria-label={`${option} horas`}
              className="adm-sec-dur"
              data-on={hours === option ? "true" : undefined}
              onClick={() => setHours(option)}
            >
              <b>{option} horas</b>
              {option === DEFAULT_SHIELD_HOURS ? <small>Padrão</small> : null}
            </button>
          ))}
        </div>
        <small className="adm-sec-durs-note">
          Depois do prazo, o Escudo termina sozinho.
        </small>
      </fieldset>

      <ShieldCodeField
        value={code}
        onChange={setCode}
        disabled={mutation.isPending || locked}
        error={codeError}
      />

      {error ? (
        <div className="adm-dialog-error" role="alert">
          {error}
        </div>
      ) : null}
    </AdminDialog>
  );
}

/** Janela "Encerrar": pede o código do Authenticator. */
export function DeactivateDialog({ onClose }: { onClose: () => void }) {
  const mutation = useDeactivateShield();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const submit = async () => {
    if (!isShieldCodeComplete(code) || mutation.isPending || locked) return;
    setError(null);
    try {
      await mutation.mutateAsync({ code });
      adminToast.success("Operação Escudo encerrada.");
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
      size="sm"
      title="Encerrar Operação Escudo"
      description="As regras voltam ao normal. Contas em análise e saques em espera continuam retidos até você liberar."
      busy={mutation.isPending}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn out"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            disabled={
              mutation.isPending || locked || !isShieldCodeComplete(code)
            }
            onClick={() => void submit()}
          >
            {mutation.isPending ? "Encerrando…" : "Encerrar Escudo"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <ShieldCodeField
          value={code}
          onChange={setCode}
          disabled={mutation.isPending || locked}
          autoFocus
        />
      </form>
      {error ? (
        <div className="adm-dialog-error" role="alert">
          {error}
        </div>
      ) : null}
    </AdminDialog>
  );
}

/** Quanto do prazo já passou (0 a 100), para a barra. */
function elapsedPercent(
  shield: ShieldStatus,
  now: number = Date.now(),
): number {
  const start = Date.parse(shield.activated_at ?? "");
  const end = Date.parse(shield.expires_at ?? "");
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
}

/** Ligado: o relógio com o que falta, a barra do prazo e quem ativou, quando e por quê (num cartão claro). */
function ActiveStatus({ shield }: { shield: ShieldStatus }) {
  const clock = shieldClock(shield.expires_at);
  const left = shieldRemaining(shield.expires_at);
  const percent = elapsedPercent(shield);
  return (
    <div className="adm-shield-status" data-on="true">
      <div className="adm-shield-status-main">
        <div
          className="adm-shield-clock"
          role="timer"
          aria-label={left ? `Faltam ${left}` : "Encerrando"}
        >
          {clock ? (
            <>
              <b>{clock.hours}</b>
              <span>h</span>
              <b>{String(clock.minutes).padStart(2, "0")}</b>
              <span>min</span>
            </>
          ) : (
            <b>—</b>
          )}
          <em>restantes · até {formatShieldEnd(shield.expires_at)}</em>
        </div>
        <div
          className="adm-shield-bar"
          role="progressbar"
          aria-label="Tempo do Escudo que já passou"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <i style={{ width: `${percent}%` }} />
        </div>
      </div>
      <dl className="adm-shield-facts">
        <div>
          <dt>Ativado por</dt>
          <dd>{shield.activated_by?.name?.trim() || "Não informado"}</dd>
        </div>
        <div>
          <dt>Ativado em</dt>
          <dd>
            {shield.activated_at ? formatDateTime(shield.activated_at) : "—"}
          </dd>
        </div>
        <div className="adm-shield-why">
          <dt>Motivo</dt>
          <dd>{shield.reason?.trim() || "Não informado"}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Estado do Escudo na página: ligado, o relógio e os dados; desligado ou sem configuração, uma frase. As ações ficam na ilha. */
export function ShieldStatusCard() {
  const shield = useShield();
  const data = shield.data;

  if (shield.isLoading) {
    return (
      <AdminSection title="Estado" flush>
        <AdminListSkeleton
          variant="rows"
          rows={1}
          ariaLabel="Carregando a Operação Escudo…"
        />
      </AdminSection>
    );
  }
  if (shield.error) {
    return (
      <AdminSection title="Estado" flush>
        <AdminErrorState
          compact
          error={shield.error}
          onRetry={() => void shield.refetch()}
          retrying={shield.isRefetching}
        />
      </AdminSection>
    );
  }
  if (!data?.configured) {
    return (
      <AdminSection title="Estado" flush>
        <p className="adm-shield-note" data-disabled="true">
          <I n="lock" cls="sm" />
          Configuração pendente no servidor.
        </p>
      </AdminSection>
    );
  }
  if (data.active) {
    return (
      <AdminSection title="Operação Escudo ligada" flush>
        <ActiveStatus shield={data} />
      </AdminSection>
    );
  }
  // Desligado e configurado: nada a mostrar aqui (o botão de ativar está na ilha, ao lado da personagem).
  return null;
}

/**
 * O que muda com a Operação Escudo, lado a lado: uma fileira de passos ligados por um fio fino, cada um com ícone e um rótulo
 * curto (a frase inteira vem na dica). Fica logo abaixo da ilha, sem caixas.
 */
export function ShieldChanges({ active }: { active: boolean }) {
  return (
    <section
      className="adm-shield-changes"
      aria-label="O que muda com a Operação Escudo"
    >
      <h3>{active ? "O que está valendo" : "O que muda"}</h3>
      <ol className="adm-shield-steps">
        {SHIELD_STEPS.map((step) => (
          <li key={step.label} title={step.text}>
            <span className="adm-shield-step-ic" aria-hidden="true">
              <I n={step.icon} cls="sm" />
            </span>
            <b>{step.label}</b>
            <span className="adm-sr">{step.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A aba "Escudo": o que muda, o estado (quando ligado) e o que ficou retido. */
export function SecurityShieldTab({
  children,
}: {
  children?: React.ReactNode;
}) {
  const shield = useShield();
  return (
    <div className="adm-shield-tab">
      <ShieldChanges active={shield.data?.active === true} />
      <ShieldStatusCard />
      {children}
    </div>
  );
}

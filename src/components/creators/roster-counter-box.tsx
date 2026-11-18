import { useState } from "react";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import { isInvalidCommission, rosterErrorMessage, useAnswerRosterCounter } from "@/hooks/use-agency-roster";
import { commissionError, formatCommission, parseCommission, type RosterMember } from "@/shared/services/agency-roster";

/**
 * A proposta do criador no convite: ele quer uma comissão menor (e pode ter deixado uma mensagem). A agência aceita (ele
 * entra já com a comissão proposta), recusa (vale a original) ou faz uma nova oferta. Quem só lê não vê os botões.
 */
export function RosterCounterBox({ member, canWrite }: { member: RosterMember; canWrite: boolean }) {
  const counter = member.counter_offer;
  const answer = useAnswerRosterCounter();
  const [offering, setOffering] = useState(false);
  const [value, setValue] = useState("");
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  if (!counter) return null;

  const name = member.creator.name;
  const error = serverError ?? (tried ? commissionError(value) : null);
  const busy = answer.isPending;

  const send = (body: Parameters<typeof answer.mutate>[0]["answer"], done: string) =>
    answer.mutate(
      { rosterId: member.id, answer: body },
      {
        onSuccess: () => toast.success(done),
        onError: (failure) => {
          if (isInvalidCommission(failure)) setServerError((failure as Error).message);
          else toast.error(rosterErrorMessage(failure, "Não foi possível responder à proposta."));
        },
      },
    );

  const submitOffer = () => {
    setTried(true);
    setServerError(null);
    if (commissionError(value)) return;
    send({ action: "offer", commission_percent: parseCommission(value) }, `Nova oferta enviada para ${name}.`);
  };

  return (
    <div className="rst-cb" role="group" aria-label={`Proposta de ${name}`}>
      <div className="rst-cb-h">
        <span className="rst-cb-ic" aria-hidden="true">
          <I n="msg" cls="sm" />
        </span>
        <span>
          <b>
            {name} propõe {formatCommission(counter.commission_percent)}
          </b>
          <small>O convite está em {formatCommission(member.commission_percent)}. Se aceitar, ele entra no elenco já com a comissão proposta.</small>
        </span>
      </div>
      {counter.message ? <blockquote className="rst-cb-m">“{counter.message}”</blockquote> : null}

      {canWrite ? (
        offering ? (
          <form
            className="rst-cb-f"
            onSubmit={(event) => {
              event.preventDefault();
              submitOffer();
            }}
          >
            <label htmlFor={`offer-${member.id}`}>Nova oferta</label>
            <div className="rsi-pct">
              <input
                id={`offer-${member.id}`}
                className="cm-in"
                inputMode="decimal"
                placeholder="Ex.: 12"
                value={value}
                autoComplete="off"
                aria-invalid={error ? true : undefined}
                data-adm-autofocus
                onChange={(event) => {
                  setValue(event.target.value);
                  setServerError(null);
                }}
              />
              <span aria-hidden="true">%</span>
            </div>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Enviando…" : "Enviar oferta"}
            </button>
            <button type="button" className="btn out" disabled={busy} onClick={() => setOffering(false)}>
              Voltar
            </button>
            {error ? (
              <small className="nfe" role="alert">
                {error}
              </small>
            ) : null}
          </form>
        ) : (
          <div className="rst-cb-a">
            <button type="button" className="btn" disabled={busy} onClick={() => send({ action: "accept" }, `${name} entrou no elenco com ${formatCommission(counter.commission_percent)}.`)}>
              Aceitar {formatCommission(counter.commission_percent)}
            </button>
            <button type="button" className="btn out" disabled={busy} onClick={() => send({ action: "decline" }, `Proposta recusada: vale os ${formatCommission(member.commission_percent)} do convite.`)}>
              Recusar
            </button>
            <button type="button" className="btn out" disabled={busy} onClick={() => setOffering(true)}>
              Fazer nova oferta
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Av, I } from "@/components/prototype/ui";
import { useModalBehavior } from "@/hooks/admin/use-modal-behavior";
import { isInvalidCommission, rosterErrorMessage, useInviteToRoster } from "@/hooks/use-agency-roster";
import { commissionError, parseCommission } from "@/shared/services/agency-roster";

import "@/styles/agency-roster.css";

export interface RosterInviteCreator {
  userId: number;
  name: string;
  username?: string | null;
  photo?: string | null;
}

/**
 * "Convidar para o elenco": a comissão da agência é obrigatória (0 a 100, 1 casa decimal) e o criador a vê antes de
 * aceitar. Sem ela a API recusa o convite; o erro `invalid_commission` volta no próprio campo, com o texto da API.
 */
export function RosterInviteDialog({ creator, onClose }: { creator: RosterInviteCreator; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const fieldId = useId();
  const invite = useInviteToRoster();
  const [value, setValue] = useState("");
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const sending = invite.isPending;
  const error = serverError ?? (tried ? commissionError(value) : null);

  useModalBehavior({ open: true, containerRef: dialogRef, onEscape: sending ? undefined : onClose });

  const submit = () => {
    setTried(true);
    setServerError(null);
    if (commissionError(value) || sending) return;
    invite.mutate(
      { userId: creator.userId, commissionPercent: parseCommission(value) },
      {
        onSuccess: () => {
          toast.success(`Convite enviado para ${creator.name}. Ele entra no elenco quando aceitar.`);
          onClose();
        },
        onError: (failure) => {
          if (isInvalidCommission(failure)) setServerError((failure as Error).message);
          else toast.error(rosterErrorMessage(failure, "Não foi possível convidar para o elenco."));
        },
      },
    );
  };

  return createPortal(
    <div className="pv">
      <div className="ovb on" aria-hidden="true" onClick={() => !sending && onClose()} />
      <div className="ovw">
        <section ref={dialogRef} className="ovd on mpw" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={sending || undefined} tabIndex={-1}>
          <div className="sh-h cm-h">
            <div>
              <small>Elenco</small>
              <h2 id={titleId}>Convidar para o elenco</h2>
            </div>
            <button type="button" className="round" onClick={onClose} disabled={sending} aria-label="Fechar">
              <I n="x" cls="sm" />
            </button>
          </div>
          <form
            className="mpw-b"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="rsi-who">
              <Av name={creator.name} src={creator.photo ?? undefined} size={44} />
              <span>
                <b>{creator.name}</b>
                {creator.username ? <small>@{creator.username}</small> : null}
              </span>
            </div>

            <div className={`n4c ${error ? "bad" : ""}`}>
              <label className="n4l" htmlFor={fieldId}>
                Comissão da agência
              </label>
              <div className="rsi-pct">
                <input
                  id={fieldId}
                  className="cm-in"
                  inputMode="decimal"
                  placeholder="Ex.: 15"
                  value={value}
                  autoComplete="off"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={`${fieldId}-help`}
                  data-adm-autofocus
                  onChange={(event) => {
                    setValue(event.target.value);
                    setServerError(null);
                  }}
                />
                <span aria-hidden="true">%</span>
              </div>
              {error ? (
                <small className="nfe" role="alert">
                  {error}
                </small>
              ) : (
                <small className="lvf-ct" id={`${fieldId}-help`}>
                  Quanto a agência recebe de cada campanha que o criador entregar. De 0 a 100, com no máximo uma casa decimal.
                </small>
              )}
            </div>

            <p className="rsi-note">
              <I n="eye" cls="sm" />O criador vê esta comissão antes de aceitar. Ele pode propor uma menor, e você escolhe se aceita, recusa ou faz uma nova oferta.
            </p>

            <div className="cm-f">
              <button type="button" className="btn out" onClick={onClose} disabled={sending}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={sending}>
                <I n="send" cls="sm" />
                {sending ? "Enviando…" : "Enviar convite"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>,
    document.body,
  );
}

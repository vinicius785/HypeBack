import { useState } from "react";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import { useCreateAccountTypeRequest } from "@/hooks/use-account-type-requests";
import {
  ACCOUNT_TYPE_LABEL,
  JUSTIFICATION_MAX,
  JUSTIFICATION_MIN,
  type AccountType,
} from "@/shared/services/account-type-requests";

import { ACCOUNT_TYPE_INFO } from "./account-type-info";
import { WkModal } from "./wk-modal";

interface Props {
  workspaceId: string;
  current: AccountType;
  onClose: () => void;
}

/**
 * Pedido de troca do tipo de conta em duas etapas: escolher o tipo e justificar; revisar e enviar. O tipo atual não
 * muda: o pedido vai para a equipe Hype.
 */
export function AccountTypeRequestModal({ workspaceId, current, onClose }: Props) {
  const target: AccountType = current === "brand" ? "agency" : "brand";
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateAccountTypeRequest(workspaceId);

  const trimmed = justification.trim();
  const valid = trimmed.length >= JUSTIFICATION_MIN;

  const send = () => {
    setError(null);
    mutation.mutate(
      { requested_type: target, justification: trimmed },
      {
        onSuccess: () => {
          toast.success("Solicitação enviada. A equipe Hype vai analisar e você será avisado.");
          onClose();
        },
        onError: (e) => setError((e as Error)?.message || "Não foi possível enviar a solicitação."),
      },
    );
  };

  return (
    <WkModal
      cls="wkm"
      sub="Tipo de conta"
      title={step === "form" ? "Solicitar alteração do tipo de conta" : "Confirmar solicitação"}
      onClose={mutation.isPending ? () => undefined : onClose}
      footer={
        step === "form" ? (
          <>
            <button type="button" className="btn out" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn" disabled={!valid} onClick={() => setStep("confirm")}>
              Continuar
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn out" disabled={mutation.isPending} onClick={() => setStep("form")}>
              Voltar
            </button>
            <button type="button" className="btn" disabled={mutation.isPending} onClick={send}>
              <I n="send" cls="sm" />
              {mutation.isPending ? "Enviando…" : "Enviar solicitação"}
            </button>
          </>
        )
      }
    >
      {step === "form" ? (
        <div className="stg-rq">
          <div className="stg-rq-cur">
            <small>Tipo atual</small>
            <b>{ACCOUNT_TYPE_LABEL[current]}</b>
          </div>

          <fieldset className="stg-rq-pick">
            <legend>Tipo desejado</legend>
            {(["brand", "agency"] as AccountType[]).map((t) => {
              const isCurrent = t === current;
              return (
                <label key={t} className={`stg-rq-opt${t === target ? " on" : ""}${isCurrent ? " dis" : ""}`}>
                  <input type="radio" name="account-type" checked={t === target} disabled={isCurrent} readOnly />
                  <span>
                    <b>
                      {ACCOUNT_TYPE_LABEL[t]}
                      {isCurrent && <em>Atual</em>}
                    </b>
                    <small>{ACCOUNT_TYPE_INFO[t].description}</small>
                    <ul>
                      {ACCOUNT_TYPE_INFO[t].points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <label className="stg-rq-just">
            <span className="n4l">Justificativa</span>
            <textarea
              className="cm-ta"
              rows={4}
              maxLength={JUSTIFICATION_MAX}
              autoFocus
              placeholder="Explique por que o workspace precisa mudar de tipo (ex.: passamos a atender várias marcas)"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
            <small className={trimmed.length > 0 && !valid ? "bad" : ""}>
              {trimmed.length > 0 && !valid ? `Escreva ao menos ${JUSTIFICATION_MIN} caracteres. ` : ""}
              {justification.length}/{JUSTIFICATION_MAX}
            </small>
          </label>
        </div>
      ) : (
        <div className="stg-rq">
          <p className="stg-rq-sum">
            Você está solicitando que o workspace deixe de ser uma conta de <b>{ACCOUNT_TYPE_LABEL[current]}</b> e passe a ser uma conta de{" "}
            <b>{ACCOUNT_TYPE_LABEL[target]}</b>.
          </p>
          <ul className="stg-rq-cons">
            <li>O tipo de conta só muda se a equipe Hype aprovar. Até lá, nada muda no workspace.</li>
            <li>Não pode haver duas solicitações pendentes: esta ocupa o seu pedido até ser decidida.</li>
            <li>Campanhas, contratos, saldo e permissões não são alterados pela solicitação.</li>
          </ul>
          <div className="stg-rq-just">
            <span className="n4l">Sua justificativa</span>
            <p className="stg-rq-quote">{trimmed}</p>
          </div>
          {error && (
            <p className="stg-rq-err" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </WkModal>
  );
}

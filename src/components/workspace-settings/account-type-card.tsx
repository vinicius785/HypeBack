import { useState } from "react";

import { I } from "@/components/prototype/ui";
import {
  ACCOUNT_REQUEST_STATUS_LABEL,
  ACCOUNT_TYPE_LABEL,
  type AccountType,
  type AccountTypeRequest,
} from "@/shared/services/account-type-requests";
import "@/styles/settings-redesign.css";

import { AccountTypeRequestModal } from "./account-type-request-modal";
import { ACCOUNT_TYPE_INFO } from "./account-type-info";

const TYPES: AccountType[] = ["brand", "agency"];

const dateBr = (iso: string | null | undefined) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
};

interface Props {
  workspaceId: string;
  current: AccountType;
  /** Pedidos do workspace, o mais recente primeiro. */
  requests: AccountTypeRequest[];
  loading: boolean;
  error: boolean;
  /** Pode pedir a troca (proprietário e administradores). */
  canRequest: boolean;
  onRetry: () => void;
}

/**
 * Tipo de conta do workspace: qual é, o que muda entre Marca e Agência e o estado do último pedido. O usuário não troca
 * o tipo: só pede, e a equipe Hype decide (um pedido pendente por vez).
 */
export function AccountTypeCard({ workspaceId, current, requests, loading, error, canRequest, onRetry }: Props) {
  const [open, setOpen] = useState(false);
  const latest = requests[0];
  const pending = latest?.status === "pending" ? latest : null;
  // O último pedido decidido só aparece enquanto é a novidade; depois de um novo pedido, vale o pendente.
  const decided = latest && latest.status !== "pending" ? latest : null;

  return (
    <section className="stg-card" aria-labelledby="stg-at">
      <header className="stg-ath">
        <div>
          <h3 id="stg-at">Tipo de conta</h3>
          <p>Define como o workspace opera no HypeApp. A troca é analisada pela equipe Hype.</p>
        </div>
        {canRequest && (
          <button type="button" className="btn out" disabled={!!pending || loading} onClick={() => setOpen(true)} title={pending ? "Já existe uma solicitação pendente" : undefined}>
            <I n="refresh" cls="sm" />
            Solicitar alteração do tipo de conta
          </button>
        )}
      </header>

      <div className="stg-at-grid" role="list" aria-label="Tipos de conta">
        {TYPES.map((t) => {
          const info = ACCOUNT_TYPE_INFO[t];
          const isCurrent = t === current;
          return (
            <div key={t} role="listitem" className={`stg-at-col${isCurrent ? " cur" : ""}`}>
              <div className="stg-at-ch">
                <b>{ACCOUNT_TYPE_LABEL[t]}</b>
                {isCurrent && <span>Tipo atual</span>}
              </div>
              <p>{info.description}</p>
              <ul>
                {info.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {loading ? (
        <p className="stg-hint">Carregando solicitações…</p>
      ) : error ? (
        <p className="stg-hint" role="alert">
          Não foi possível carregar as solicitações.{" "}
          <button type="button" className="lnk" onClick={onRetry}>
            Tentar de novo
          </button>
        </p>
      ) : pending ? (
        <div className="stg-req is-pending" role="status">
          <b>
            Solicitação pendente <span>{ACCOUNT_REQUEST_STATUS_LABEL.pending}</span>
          </b>
          <p>
            {ACCOUNT_TYPE_LABEL[pending.current_type]} → {ACCOUNT_TYPE_LABEL[pending.requested_type]}, enviada em {dateBr(pending.requested_at)}. A equipe Hype ainda vai analisar; você será avisado da decisão.
          </p>
        </div>
      ) : decided ? (
        <div className={`stg-req is-${decided.status}`} role="status">
          <b>
            Última solicitação <span>{ACCOUNT_REQUEST_STATUS_LABEL[decided.status]}</span>
          </b>
          <p>
            {ACCOUNT_TYPE_LABEL[decided.current_type]} → {ACCOUNT_TYPE_LABEL[decided.requested_type]}
            {dateBr(decided.decided_at) ? `, decidida em ${dateBr(decided.decided_at)}` : ""}.
            {decided.status === "rejected" && decided.decision_reason ? ` Motivo: ${decided.decision_reason}` : ""}
            {decided.status === "approved" ? " O workspace já opera com o novo tipo." : decided.status === "rejected" ? " O tipo de conta continua o mesmo." : ""}
          </p>
        </div>
      ) : null}

      {!canRequest && <p className="stg-hint">Só o proprietário e os administradores podem solicitar a troca do tipo de conta.</p>}

      {open && <AccountTypeRequestModal workspaceId={workspaceId} current={current} onClose={() => setOpen(false)} />}
    </section>
  );
}

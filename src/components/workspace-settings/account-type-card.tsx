import { useState } from "react";

import { I } from "@/components/prototype/ui";
import {
  ACCOUNT_REQUEST_STATUS_LABEL,
  ACCOUNT_TYPE_LABEL,
  type AccountType,
  type AccountTypeRequest,
} from "@/shared/services/account-type-requests";
import "@/styles/settings.css";

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
 * Tipo do workspace (Marca ou Agência): qual é, o que o define, as diferenças (recolhidas) e o estado do último pedido.
 * O usuário não troca o tipo: só pede, e a equipe Hype decide (um pedido pendente por vez). O título e a descrição da
 * seção vêm da página; aqui só o conteúdo.
 */
export function AccountTypeCard({ workspaceId, current, requests, loading, error, canRequest, onRetry }: Props) {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState(false);
  const latest = requests[0];
  const pending = latest?.status === "pending" ? latest : null;
  const decided = latest && latest.status !== "pending" ? latest : null;
  const info = ACCOUNT_TYPE_INFO[current];

  return (
    <div className="st-at">
      <div className="st-at-cur">
        <b>{ACCOUNT_TYPE_LABEL[current]}</b>
        <span>Tipo atual</span>
        <p>{info.description}</p>
      </div>

      <div className="st-at-row">
        <button type="button" className="st-link" aria-expanded={diff} onClick={() => setDiff((v) => !v)}>
          {diff ? "Ocultar diferenças" : "Ver diferenças entre Marca e Agência"}
          <I n="chevdown" cls="sm" />
        </button>
        {canRequest && (
          <button type="button" className="btn out st-btn" disabled={!!pending || loading} onClick={() => setOpen(true)} title={pending ? "Já existe uma solicitação pendente" : undefined}>
            <I n="refresh" cls="sm" />
            Solicitar alteração do tipo de conta
          </button>
        )}
      </div>

      {diff && (
        <div className="st-at-grid" role="list" aria-label="Tipos de conta">
          {TYPES.map((t) => (
            <div key={t} role="listitem" className={`st-at-col${t === current ? " cur" : ""}`}>
              <b>
                {ACCOUNT_TYPE_LABEL[t]}
                {t === current && <span>Tipo atual</span>}
              </b>
              <p>{ACCOUNT_TYPE_INFO[t].description}</p>
              <ul>
                {ACCOUNT_TYPE_INFO[t].points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="st-note">Carregando solicitações…</p>
      ) : error ? (
        <p className="st-note" role="alert">
          Não foi possível carregar as solicitações.{" "}
          <button type="button" className="st-link" onClick={onRetry}>
            Tentar de novo
          </button>
        </p>
      ) : pending ? (
        <div className="st-req is-pending" role="status">
          <b>
            Solicitação pendente <span>{ACCOUNT_REQUEST_STATUS_LABEL.pending}</span>
          </b>
          <p>
            {ACCOUNT_TYPE_LABEL[pending.current_type]} → {ACCOUNT_TYPE_LABEL[pending.requested_type]}, enviada em {dateBr(pending.requested_at)}. A equipe Hype ainda vai analisar; você será avisado da decisão.
          </p>
        </div>
      ) : decided ? (
        <div className={`st-req is-${decided.status}`} role="status">
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

      {!canRequest && <p className="st-note">Só o proprietário e os administradores podem solicitar a troca do tipo de conta.</p>}

      {open && <AccountTypeRequestModal workspaceId={workspaceId} current={current} onClose={() => setOpen(false)} />}
    </div>
  );
}

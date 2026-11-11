import { AdminSection, AdminTooltip } from "@/components/admin/platform";
import {
  TRUST_DISCLAIMER,
  TRUST_LEVEL_TEXT,
  formatTrustPoints,
  splitTrustReasons,
  trustAriaLabel,
  usableTrust,
} from "@/lib/admin/trust";
import { EMPTY_TEXT } from "@/lib/admin/format";
import type { AdminUserTrust, AdminUserTrustReason } from "@/shared/admin-platform.types";

import "@/styles/admin-users.css";

/** Medidor de 5 barras: as acesas mostram o nível (o número ao lado continua sendo o que se lê). */
function TrustMeter({ level }: { level: number }) {
  return (
    <span className="adm-trust-meter" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} data-on={n <= level} />
      ))}
    </span>
  );
}

/** Uma linha de motivo: sinal e pontos, depois o texto. Positivo e negativo se distinguem também pelo sinal, não só pela cor. */
function ReasonLine({ reason }: { reason: AdminUserTrustReason }) {
  return (
    <span className="adm-trust-reason" data-effect={reason.effect}>
      <b className="adm-num">{formatTrustPoints(reason.points)}</b>
      <span>{reason.label}</span>
    </span>
  );
}

/** Conteúdo da dica da lista: nota e até 6 motivos, com "+N" quando há mais (a lista completa fica no detalhe). */
function TrustTip({ trust }: { trust: AdminUserTrust }) {
  const { shown, hidden } = splitTrustReasons(trust.reasons);
  return (
    <span className="adm-trust-tip">
      <span className="adm-trust-tip-h">
        Nota {trust.score}/100 · {TRUST_LEVEL_TEXT[trust.level]}
      </span>
      {shown.length === 0 ? <span className="adm-trust-tip-none">Sem sinais registrados.</span> : null}
      {shown.map((reason, index) => (
        <ReasonLine key={`${reason.code}-${index}`} reason={reason} />
      ))}
      {hidden > 0 ? <span className="adm-trust-tip-more">+{hidden} no detalhe da conta</span> : null}
    </span>
  );
}

/**
 * Selo do nível (o NÚMERO sempre à vista, com a cor de apoio) com a dica dos motivos: abre ao passar o mouse e ao
 * focar por teclado. Sem `trust` utilizável mostra "—", sem selo.
 */
export function TrustBadge({ trust: raw }: { trust: AdminUserTrust | null | undefined }) {
  const trust = usableTrust(raw);
  if (!trust) return <span className="adm-muted">{EMPTY_TEXT}</span>;
  return (
    <AdminTooltip content={<TrustTip trust={trust} />} placement="top" delay={250} describe>
      <button type="button" className="adm-trust" data-level={trust.level} aria-label={trustAriaLabel(trust.level)}>
        <span>{trust.level}</span>
        <TrustMeter level={trust.level} />
      </button>
    </AdminTooltip>
  );
}

/**
 * Bloco do detalhe: selo, nota, lista COMPLETA de motivos (positivos e negativos) e o aviso de que é estimativa.
 * Conta sem `trust` (excluída ou cálculo indisponível) mostra "—" e o motivo.
 */
export function AdminUserTrustSection({ trust: raw }: { trust: AdminUserTrust | null | undefined }) {
  const trust = usableTrust(raw);
  return (
    <AdminSection title="Confiança da conta" description={TRUST_DISCLAIMER}>
      {trust ? (
        <div className="adm-trust-detail">
          <div className="adm-trust-summary" data-level={trust.level}>
            <span className="adm-trust" data-level={trust.level} role="img" aria-label={trustAriaLabel(trust.level)}>
              <span>{trust.level}</span>
              <TrustMeter level={trust.level} />
            </span>
            <span className="adm-trust-text">
              <b>{TRUST_LEVEL_TEXT[trust.level]}</b>
              <span>
                Nota <span className="adm-num">{trust.score}</span>/100
              </span>
            </span>
            <span
              className="adm-trust-bar"
              role="meter"
              aria-label="Nota de confiança"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.max(0, Math.min(100, trust.score))}
            >
              <i style={{ width: `${Math.max(0, Math.min(100, trust.score))}%` }} />
            </span>
          </div>
          {trust.reasons.length === 0 ? (
            <p className="adm-muted">Nenhum sinal registrado para esta conta.</p>
          ) : (
            <ul className="adm-trust-list" aria-label="Motivos do nível de confiança">
              {trust.reasons.map((reason, index) => (
                <li key={`${reason.code}-${index}`}>
                  <ReasonLine reason={reason} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="adm-muted">{EMPTY_TEXT} Sem cálculo para esta conta (excluída ou indisponível no momento).</p>
      )}
    </AdminSection>
  );
}

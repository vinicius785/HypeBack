import { useNavigate } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import { useCanUseSecurity, useSecuritySummary } from "@/hooks/admin/use-admin-security";

import { bellCountText } from "./security-labels";

import "@/styles/admin-security.css";

/**
 * Sino da sentinela no topo do Admin: só para o administrador da plataforma. A bolinha mostra os alertas novos
 * (`GET alerts/summary`, atualizado ao abrir e a cada 60 s com a aba visível, e na hora ao marcar como visto);
 * sem alertas novos o sino fica sem bolinha, e acima de 99 mostra "99+". O clique leva à aba Alertas, filtro Novos.
 */
export function SecurityBell() {
  const canUse = useCanUseSecurity();
  const summary = useSecuritySummary();
  const navigate = useNavigate();
  if (!canUse) return null;

  const unseen = summary.data?.unseen ?? 0;
  const text = bellCountText(unseen);
  const label = unseen > 0 ? `Segurança: ${unseen} ${unseen === 1 ? "alerta novo" : "alertas novos"}` : "Segurança: nenhum alerta novo";
  return (
    <button
      type="button"
      className="adm-sec-bell"
      aria-label={label}
      title={label}
      onClick={() => void navigate({ to: "/admin/security", search: {} as never })}
    >
      <I n="bell" />
      {text ? (
        <b className="adm-sec-bell-n" aria-hidden="true">
          {text}
        </b>
      ) : null}
    </button>
  );
}

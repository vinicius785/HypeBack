import { useState } from "react";

import { AdminLink } from "@/components/admin/platform";
import { AccountSituationBadge, situationOf } from "@/components/admin/users/account-situation";
import { AccountSituationDialog } from "@/components/admin/users/account-situation-dialog";
import { userDetailLink } from "@/components/admin/users/admin-users-links";
import { useAdminCapabilities } from "@/hooks/admin/use-admin-team";
import { useAdminUser } from "@/hooks/admin/use-admin-users";
import { describeAdminError } from "@/lib/admin/admin-errors";

/**
 * Contestação de conta: a equipe decide sem trocar de tela. Mostra a situação atual da conta com o motivo que o criador
 * leu, o atalho para a ficha e, para quem pode moderar, "Liberar conta" (a mesma ação de mudar a situação, para Ativa).
 * O motivo nunca vai para o console.
 */
export function ContestationPanel({ userId }: { userId: number }) {
  const query = useAdminUser(userId);
  const capabilities = useAdminCapabilities();
  const [releasing, setReleasing] = useState(false);
  const user = query.data;
  const situation = user ? situationOf(user) : null;
  const canRelease = !capabilities.loading && capabilities.can("users.moderate") && user?.kind === "creator" && situation !== null && situation !== "active";

  return (
    <section className="adm-sup-contest" aria-label="Conta contestada">
      <h4>Conta contestada</h4>
      {query.isLoading ? (
        <p className="adm-muted">Carregando a conta…</p>
      ) : query.isError || !user ? (
        <p role="alert">{describeAdminError(query.error)}</p>
      ) : (
        <>
          <div className="adm-sup-contest-row">
            {situation ? <AccountSituationBadge value={situation} /> : null}
            <AdminLink to={userDetailLink(user.id)} textLink>
              Abrir a ficha de {user.name}
            </AdminLink>
          </div>
          {user.account_status_reason?.trim() ? (
            <p className="adm-sup-contest-why">
              <b>Motivo mostrado ao criador</b>
              <span>{user.account_status_reason}</span>
            </p>
          ) : null}
          {canRelease ? (
            <button type="button" className="btn" onClick={() => setReleasing(true)}>
              Liberar conta
            </button>
          ) : null}
          {releasing ? <AccountSituationDialog user={user} target="active" onClose={() => setReleasing(false)} /> : null}
        </>
      )}
    </section>
  );
}

import { useState } from "react";

import { AdminConfirmDialog, adminToast, type AdminConfirmValues } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useAdminAccountStatus } from "@/hooks/admin/use-admin-account-status";
import { describeAdminError } from "@/lib/admin/admin-errors";
import type { AdminAccountSituation, AdminUserDetail } from "@/shared/admin-platform.types";

import { ACCOUNT_REASON_MAX, ACCOUNT_SITUATION_EFFECT } from "./account-situation";
import { translateValidationMessage } from "./admin-user-errors";

/**
 * Muda a situação da conta do criador. Ativa, Em análise, Reprovada e Suspensa: todas menos Ativa pedem o motivo (que o
 * CRIADOR lê no app) e não deixam confirmar sem ele; voltar para Ativa não pede (o motivo é limpo).
 * O motivo e as mensagens nunca vão para o console.
 */
export function AccountSituationDialog({
  user,
  target,
  onClose,
}: {
  user: AdminUserDetail;
  target: AdminAccountSituation;
  onClose: () => void;
}) {
  const mutation = useAdminAccountStatus(user.id);
  const [error, setError] = useState<string | null>(null);
  const toActive = target === "active";

  const confirm = ({ reason }: AdminConfirmValues) => {
    setError(null);
    mutation.mutate(toActive ? { status: target } : { status: target, reason }, {
      onSuccess: () => {
        adminToast.success(toActive ? "Conta ativada." : "Conta suspensa.");
        onClose();
      },
      onError: (failure) => setError(translateValidationMessage(describeAdminError(failure))),
    });
  };

  return (
    <AdminConfirmDialog
      open
      eyebrow={`Criador · ${user.email}`}
      title={toActive ? `Ativar a conta de ${user.name}` : `Suspender a conta de ${user.name}`}
      description={toActive ? "O criador volta a ter acesso ao app." : ACCOUNT_SITUATION_EFFECT[target]}
      consequences={
        toActive
          ? ["O motivo anterior é apagado.", "A ação fica registrada no histórico, com o seu nome."]
          : [
              `${user.name} não consegue usar o app, mas vê o seu motivo e pode contestar pelo suporte.`,
              "A ação fica registrada no histórico, com o seu nome e o motivo.",
            ]
      }
      tone={toActive ? "neutral" : "danger"}
      confirmLabel={toActive ? "Ativar conta" : "Suspender conta"}
      pendingLabel="Salvando…"
      pending={mutation.isPending}
      error={error}
      reason={
        toActive
          ? false
          : {
              label: "Motivo para o criador",
              placeholder: "Escreva pensando em quem vai ler: é o criador, não a equipe.",
              max: ACCOUNT_REASON_MAX,
            }
      }
      onConfirm={confirm}
      onClose={onClose}
    >
      {toActive ? null : (
        <p className="adm-conseq-note" role="note">
          <I n="eye" cls="sm" />
          <span>Este texto será mostrado ao criador no app.</span>
        </p>
      )}
    </AdminConfirmDialog>
  );
}

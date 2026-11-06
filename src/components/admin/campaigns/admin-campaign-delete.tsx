import { useState } from "react";

import { AdminConfirmDialog, adminToast, type AdminConfirmValues } from "@/components/admin/platform";
import { WorkspaceBlockers } from "@/components/admin/workspaces/workspace-impact";
import { useAdminDeleteCampaign } from "@/hooks/admin/use-admin-campaigns";
import { describeAdminError, getDeleteBlockers } from "@/lib/admin/admin-errors";
import type { AdminDeleteBlocker } from "@/shared/admin-platform.types";

/** O que o diálogo precisa saber da campanha (a lista e o detalhe a conhecem com formas diferentes). */
export interface AdminCampaignDeleteTarget {
  id: string;
  title: string;
  workspaceName?: string;
}

/**
 * Confirmação da exclusão de uma campanha pelo Admin: motivo (vai para a trilha de auditoria) e o TÍTULO digitado.
 * Quem decide se pode excluir é o servidor: uma campanha que já movimentou saldo de criadores volta 409 e o diálogo
 * lista os impedimentos, sugerindo encerrar a campanha em vez de excluir.
 */
export function AdminCampaignDeleteDialog({
  campaign,
  onClose,
  onDeleted,
}: {
  campaign: AdminCampaignDeleteTarget;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const mutation = useAdminDeleteCampaign(campaign.id);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<AdminDeleteBlocker[]>([]);

  const confirm = ({ reason, confirmText }: AdminConfirmValues) => {
    setError(null);
    setBlockers([]);
    mutation.mutate(
      { reason, confirm_title: confirmText.trim() },
      {
        onSuccess: () => {
          adminToast.success("Campanha excluída.");
          onClose();
          onDeleted?.();
        },
        onError: (failure) => {
          setError(describeAdminError(failure));
          setBlockers(getDeleteBlockers(failure));
        },
      },
    );
  };

  return (
    <AdminConfirmDialog
      open
      eyebrow={campaign.workspaceName ? `Campanha · ${campaign.workspaceName}` : "Campanha"}
      title={`Excluir a campanha ${campaign.title}`}
      description="Esta ação é permanente e não pode ser desfeita."
      consequences={[
        "A campanha some para o workspace e para os criadores, com participações, conteúdos, roteiros e contratos.",
        "O link de inscrição da campanha deixa de funcionar.",
        "Só é possível se a campanha ainda não movimentou saldo de criadores. Se já movimentou, encerre a campanha.",
        "A ação fica registrada na trilha de auditoria, com o seu nome e o motivo.",
      ]}
      tone="danger"
      confirmLabel="Excluir campanha para sempre"
      pendingLabel="Excluindo…"
      pending={mutation.isPending}
      error={error}
      typedConfirmation={{
        expected: campaign.title,
        label: (
          <>
            Para confirmar, digite o título da campanha: <b>{campaign.title}</b>
          </>
        ),
        hint: "Sem diferenciar maiúsculas e minúsculas.",
      }}
      onConfirm={confirm}
      onClose={onClose}
    >
      {blockers.length > 0 ? (
        <WorkspaceBlockers
          blockers={blockers}
          resolveHint="Encerre a campanha em vez de excluir: o histórico financeiro dos criadores fica preservado."
        />
      ) : null}
    </AdminConfirmDialog>
  );
}

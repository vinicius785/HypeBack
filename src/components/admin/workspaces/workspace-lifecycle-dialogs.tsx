import { useState } from "react";
import { toast } from "sonner";

import {
  AdminConfirmDialog,
  AdminErrorState,
  AdminSkeletonLines,
  type AdminConfirmValues,
} from "@/components/admin/platform";
import { isAdminApiError } from "@/lib/admin/admin-client";
import { getDeleteBlockers } from "@/lib/admin/admin-errors";
import { useAdminWorkspaceImpact } from "@/hooks/admin/use-admin-workspaces";
import {
  useRefreshOnStaleWorkspace,
  useWorkspaceDangerMutation,
  useWorkspaceTransitionMutation,
  type WorkspaceDangerAction,
  type WorkspaceTransition,
} from "@/hooks/admin/use-admin-workspaces-mutations";
import type { AdminDeleteBlocker, AdminWorkspaceDetail } from "@/shared/admin-platform.types";

import type { WorkspaceAction } from "./workspace-constants";
import { workspaceErrorMessage } from "./workspace-errors";
import {
  WorkspaceBlockers,
  WorkspaceConsequences,
  WorkspaceImpactSummary,
  WorkspaceImpactWarnings,
} from "./workspace-impact";

import "@/styles/admin-workspaces.css";

interface ActionCopy {
  title: string;
  description: string;
  confirm: string;
  pending: string;
  done: string;
}

const COPY: Record<WorkspaceAction, ActionCopy> = {
  suspend: {
    title: "Suspender workspace",
    description: "Confirme a suspensão deste workspace. Ele pode ser reativado depois.",
    confirm: "Suspender",
    pending: "Suspendendo…",
    done: "Workspace suspenso.",
  },
  reactivate: {
    title: "Reativar workspace",
    description: "O workspace volta ao estado ativo e o time do cliente volta a acessá-lo.",
    confirm: "Reativar",
    pending: "Reativando…",
    done: "Workspace reativado.",
  },
  archive: {
    title: "Arquivar workspace",
    description: "Confira o impacto antes de arquivar. O workspace pode ser desarquivado depois.",
    confirm: "Arquivar",
    pending: "Arquivando…",
    done: "Workspace arquivado.",
  },
  unarchive: {
    title: "Desarquivar workspace",
    description: "O workspace volta ao estado ativo e deixa de ser somente leitura.",
    confirm: "Desarquivar",
    pending: "Desarquivando…",
    done: "Workspace desarquivado.",
  },
  delete: {
    title: "Excluir workspace",
    description: "Confira o impacto antes de excluir. Só a plataforma pode restaurar um workspace excluído.",
    confirm: "Excluir workspace",
    pending: "Excluindo…",
    done: "Workspace excluído.",
  },
  restore: {
    title: "Restaurar workspace",
    description: "O workspace excluído será restaurado e volta a existir para o time do cliente.",
    confirm: "Restaurar",
    pending: "Restaurando…",
    done: "Workspace restaurado.",
  },
};

interface WorkspaceActionDialogProps {
  /** A ação aberta; `null` com o diálogo fechado. */
  action: WorkspaceAction | null;
  workspace: AdminWorkspaceDetail;
  onClose: () => void;
  /** Troca de ação sem passar pelo menu ("Arquivar em vez de excluir"). */
  onSwitch: (action: WorkspaceAction) => void;
}

/** Diálogo da ação de ciclo de vida escolhida no menu "Ações". O texto digitado reinicia a cada ação. */
export function WorkspaceActionDialog({ action, workspace, onClose, onSwitch }: WorkspaceActionDialogProps) {
  if (!action) return null;
  if (action === "archive" || action === "delete") {
    return <DangerDialog key={action} action={action} workspace={workspace} onClose={onClose} onSwitch={onSwitch} />;
  }
  return <TransitionDialog key={action} action={action} workspace={workspace} onClose={onClose} />;
}

/**
 * Suspender, reativar, desarquivar e restaurar: motivo e pronto. Suspender mostra, além disso, o que
 * acontece (texto do resumo de impacto); se o resumo não carregar, a ação segue possível (não precisa do token).
 */
function TransitionDialog({
  action,
  workspace,
  onClose,
}: {
  action: WorkspaceTransition;
  workspace: AdminWorkspaceDetail;
  onClose: () => void;
}) {
  const copy = COPY[action];
  const mutation = useWorkspaceTransitionMutation(workspace.id, action);
  const refreshIfStale = useRefreshOnStaleWorkspace();
  const impact = useAdminWorkspaceImpact(workspace.id, action === "suspend");
  const [error, setError] = useState<string | null>(null);

  const submit = async ({ reason }: AdminConfirmValues) => {
    setError(null);
    try {
      await mutation.mutateAsync({ reason });
      toast.success(copy.done);
      onClose();
    } catch (failure) {
      if (refreshIfStale(failure)) {
        toast.error(workspaceErrorMessage(failure));
        onClose();
        return;
      }
      setError(workspaceErrorMessage(failure));
    }
  };

  return (
    <AdminConfirmDialog
      open
      title={copy.title}
      eyebrow={`Workspace · ${workspace.name}`}
      description={copy.description}
      consequences={action === "suspend" ? impact.data?.consequences.suspend : undefined}
      confirmLabel={copy.confirm}
      pendingLabel={copy.pending}
      pending={mutation.isPending}
      error={error}
      onConfirm={submit}
      onClose={onClose}
    >
      {action === "suspend" && impact.isLoading ? (
        <div role="status">
          <span className="adm-sr">Carregando o que acontece com a suspensão…</span>
          <AdminSkeletonLines lines={3} />
        </div>
      ) : null}
      {action === "suspend" && impact.isError ? (
        <p className="adm-workspaces-quiet">Não foi possível carregar o que acontece com a suspensão. Você ainda pode confirmar.</p>
      ) : null}
    </AdminConfirmDialog>
  );
}

const EXPIRED_MESSAGE =
  "O resumo de impacto expirou (ele vale 10 minutos). Atualizamos o resumo: revise e confirme de novo.";

/**
 * Arquivar e excluir. Abre buscando o resumo de impacto (GET /impact) e só deixa confirmar com ele na tela:
 * a pessoa vê contagens, dinheiro, avisos e o que acontece, digita o motivo e o nome do workspace, e o
 * `impact_token` que ela viu vai junto — o servidor recalcula e recusa se algo mudou.
 *
 * Excluir fica DESABILITADO enquanto houver impedimentos, e cada um é explicado (a saída é resolver ou arquivar).
 * Token que mudou ou expirou recarrega o resumo e avisa; impedimento novo (WORKSPACE_DELETE_BLOCKED) entra na lista.
 */
function DangerDialog({
  action,
  workspace,
  onClose,
  onSwitch,
}: {
  action: WorkspaceDangerAction;
  workspace: AdminWorkspaceDetail;
  onClose: () => void;
  onSwitch: (action: WorkspaceAction) => void;
}) {
  const copy = COPY[action];
  const impact = useAdminWorkspaceImpact(workspace.id, true);
  const mutation = useWorkspaceDangerMutation(workspace.id, action);
  const refreshIfStale = useRefreshOnStaleWorkspace();
  const [error, setError] = useState<string | null>(null);
  // Impedimentos que o servidor apontou na recusa; valem até o resumo ser consultado de novo.
  const [reported, setReported] = useState<{ blockers: AdminDeleteBlocker[]; at: number } | null>(null);

  const data = impact.data;
  const blockers =
    action !== "delete"
      ? []
      : reported && reported.at === impact.dataUpdatedAt
        ? reported.blockers
        : (data?.blockers ?? []);
  const blocked = blockers.length > 0;

  const submit = async ({ reason, confirmText }: AdminConfirmValues) => {
    if (!data) return;
    setError(null);
    // O token vale 10 minutos: vencido, nem tenta (o servidor recusaria do mesmo jeito).
    if (Date.parse(data.impact_token_expires_at) <= Date.now()) {
      setError(EXPIRED_MESSAGE);
      void impact.refetch();
      return;
    }
    try {
      await mutation.mutateAsync({ reason, confirm_name: confirmText.trim(), impact_token: data.impact_token });
      toast.success(copy.done);
      onClose();
    } catch (failure) {
      if (refreshIfStale(failure)) {
        toast.error(workspaceErrorMessage(failure));
        onClose();
        return;
      }
      if (isAdminApiError(failure, "IMPACT_TOKEN_MISMATCH")) {
        void impact.refetch();
      } else if (isAdminApiError(failure, "WORKSPACE_DELETE_BLOCKED")) {
        setReported({ blockers: getDeleteBlockers(failure), at: impact.dataUpdatedAt });
        void impact.refetch();
      }
      setError(workspaceErrorMessage(failure));
    }
  };

  return (
    <AdminConfirmDialog
      open
      wide
      tone={action === "delete" ? "danger" : "neutral"}
      title={copy.title}
      eyebrow={`Workspace · ${workspace.name}`}
      description={copy.description}
      confirmLabel={copy.confirm}
      pendingLabel={copy.pending}
      cancelLabel={blocked ? "Fechar" : "Cancelar"}
      pending={mutation.isPending}
      error={error}
      reason={blocked ? false : undefined}
      typedConfirmation={blocked ? undefined : { expected: workspace.name }}
      confirmDisabled={!data || impact.isFetching || blocked}
      onConfirm={submit}
      onClose={onClose}
    >
      {impact.isLoading ? (
        <div role="status">
          <span className="adm-sr">Carregando o resumo de impacto…</span>
          <AdminSkeletonLines lines={5} />
        </div>
      ) : null}
      {impact.isError && !data ? (
        <AdminErrorState compact error={impact.error} onRetry={() => void impact.refetch()} retrying={impact.isFetching} />
      ) : null}
      {data ? (
        <>
          {blocked ? (
            <WorkspaceBlockers
              blockers={blockers}
              onArchive={workspace.can.archive ? () => onSwitch("archive") : undefined}
            />
          ) : null}
          <WorkspaceConsequences items={data.consequences[action]} />
          <WorkspaceImpactWarnings warnings={data.warnings} />
          <WorkspaceImpactSummary impact={data} />
          {impact.isFetching ? (
            <p className="adm-workspaces-quiet" role="status">
              Atualizando o resumo…
            </p>
          ) : null}
        </>
      ) : null}
    </AdminConfirmDialog>
  );
}

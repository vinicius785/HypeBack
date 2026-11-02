/**
 * Ações de escrita do módulo Workspaces do Admin. Cada uma usa `useAdminMutation`: uma `Idempotency-Key`
 * por intenção (mesmo corpo reenvia a mesma chave; corpo novo ou sucesso troca a chave) e o `reason` vai
 * sempre no corpo.
 *
 * Depois do sucesso:
 *  - quem devolve o workspace (transições e edição) grava a resposta no detalhe: o cabeçalho já mostra o
 *    novo estado, sem esperar a nova consulta;
 *  - tudo do Admin é invalidado (`adminKeys.all`): o estado do workspace aparece também nas listas de
 *    usuários, campanhas e financeiro, na visão geral, na atividade e na auditoria. Só o que está na tela
 *    consulta de novo; o resto marca como velho. A invalidação não é aguardada: o diálogo fecha na hora.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { adminPatch, adminPath, adminPost, isAdminApiError } from "@/lib/admin/admin-client";
import type {
  AdminWorkspaceDangerBody,
  AdminWorkspaceDetail,
  AdminWorkspaceMember,
  AdminWorkspaceMemberAddBody,
  AdminWorkspaceMemberRemoveResult,
  AdminWorkspaceMemberRoleBody,
  AdminWorkspaceTransitionBody,
  AdminWorkspaceUpdateBody,
} from "@/shared/admin-platform.types";

import { adminKeys } from "./admin-query-keys";
import { useAdminMutation } from "./use-admin-mutation";
import { workspaceDetailKey } from "./use-admin-workspaces";

export type WorkspaceTransition = "suspend" | "reactivate" | "unarchive" | "restore";
export type WorkspaceDangerAction = "archive" | "delete";

function useWorkspaceWrite<TData, TBody>(
  workspaceId: string,
  run: (body: TBody, idempotencyKey: string) => Promise<TData>,
  returnsWorkspace: boolean,
) {
  const queryClient = useQueryClient();
  return useAdminMutation<TData, TBody>({
    mutationFn: run,
    onSuccess: (data) => {
      if (returnsWorkspace) queryClient.setQueryData(workspaceDetailKey(workspaceId), data);
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

/**
 * A ação foi recusada porque o workspace mudou de estado enquanto a tela estava aberta
 * (`INVALID_STATE_TRANSITION`, `WORKSPACE_DELETED`): a tela está velha, então consulta tudo de novo.
 * Devolve `true` quando era esse o caso, para o diálogo se fechar em vez de pedir para tentar de novo.
 */
export function useRefreshOnStaleWorkspace() {
  const queryClient = useQueryClient();
  return useCallback(
    (error: unknown): boolean => {
      const stale = isAdminApiError(error, "INVALID_STATE_TRANSITION") || isAdminApiError(error, "WORKSPACE_DELETED");
      if (stale) void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      return stale;
    },
    [queryClient],
  );
}

/** Suspender, reativar, desarquivar e restaurar: só o motivo. */
export function useWorkspaceTransitionMutation(workspaceId: string, action: WorkspaceTransition) {
  return useWorkspaceWrite<AdminWorkspaceDetail, AdminWorkspaceTransitionBody>(
    workspaceId,
    (body, idempotencyKey) =>
      adminPost<AdminWorkspaceDetail>(adminPath`/admin/workspaces/${workspaceId}/${action}`, body, { idempotencyKey }),
    true,
  );
}

/** Arquivar e excluir: motivo, nome digitado e o token do resumo de impacto que a pessoa viu. */
export function useWorkspaceDangerMutation(workspaceId: string, action: WorkspaceDangerAction) {
  return useWorkspaceWrite<AdminWorkspaceDetail, AdminWorkspaceDangerBody>(
    workspaceId,
    (body, idempotencyKey) =>
      adminPost<AdminWorkspaceDetail>(adminPath`/admin/workspaces/${workspaceId}/${action}`, body, { idempotencyKey }),
    true,
  );
}

export function useWorkspaceUpdateMutation(workspaceId: string) {
  return useWorkspaceWrite<AdminWorkspaceDetail, AdminWorkspaceUpdateBody>(
    workspaceId,
    (body, idempotencyKey) =>
      adminPatch<AdminWorkspaceDetail>(adminPath`/admin/workspaces/${workspaceId}`, body, { idempotencyKey }),
    true,
  );
}

export function useWorkspaceMemberAddMutation(workspaceId: string) {
  return useWorkspaceWrite<AdminWorkspaceMember, AdminWorkspaceMemberAddBody>(
    workspaceId,
    (body, idempotencyKey) =>
      adminPost<AdminWorkspaceMember>(adminPath`/admin/workspaces/${workspaceId}/members`, body, { idempotencyKey }),
    false,
  );
}

export function useWorkspaceMemberRoleMutation(workspaceId: string, userId: number) {
  return useWorkspaceWrite<AdminWorkspaceMember, AdminWorkspaceMemberRoleBody>(
    workspaceId,
    (body, idempotencyKey) =>
      adminPatch<AdminWorkspaceMember>(adminPath`/admin/workspaces/${workspaceId}/members/${userId}`, body, {
        idempotencyKey,
      }),
    false,
  );
}

/** POST e não DELETE: DELETE com corpo é descartado por proxies (o motivo precisa chegar). */
export function useWorkspaceMemberRemoveMutation(workspaceId: string, userId: number) {
  return useWorkspaceWrite<AdminWorkspaceMemberRemoveResult, { reason: string }>(
    workspaceId,
    (body, idempotencyKey) =>
      adminPost<AdminWorkspaceMemberRemoveResult>(adminPath`/admin/workspaces/${workspaceId}/members/${userId}/remove`, body, {
        idempotencyKey,
      }),
    false,
  );
}

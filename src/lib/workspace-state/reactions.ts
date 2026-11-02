/**
 * O que o app faz quando o servidor revela o estado de um workspace (eventos do `response-observer`).
 * Nenhuma tela precisa tratar: o estado entra na lista de workspaces em cache, o contexto deriva o workspace
 * selecionado dela, e o layout mostra o bloqueio (suspenso) ou o aviso (arquivado).
 *
 *   WORKSPACE_SUSPENDED  marca o workspace como suspenso (aparece a tela de bloqueio). Sem aviso: a tela explica.
 *   WORKSPACE_ARCHIVED   marca como arquivado (aparece a faixa) e avisa, uma vez só, que aquela escrita não passou.
 *   WORKSPACE_DELETED    tira da lista, limpa o id guardado, busca a lista de novo (o contexto abre outro
 *                        workspace, se houver) e explica com um aviso.
 */
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getWorkspaceId, removeWorkspaceId } from "@/lib/utils/api";
import type { WorkspaceStatus } from "@/shared/types";

import { WORKSPACE_STATE_DEFAULT_MESSAGE } from "./lifecycle-errors";
import type { WorkspaceStateEvent } from "./response-observer";
import {
  ME_WORKSPACES_KEY,
  getCachedWorkspaces,
  pickDefaultWorkspace,
  removeCachedWorkspace,
  setCachedWorkspaceStatus,
} from "./workspace-list-cache";

export const ARCHIVED_NOTICE = "Este workspace está arquivado: só consulta.";
export const DELETED_NOTICE = WORKSPACE_STATE_DEFAULT_MESSAGE.WORKSPACE_DELETED;
export const NO_WORKSPACES_NOTICE = "Você não tem mais workspaces. Crie um novo para continuar.";

/** `id` fixo: várias escritas recusadas em sequência mostram um aviso só, não uma pilha. */
export const ARCHIVED_TOAST_ID = "workspace-archived";
export const DELETED_TOAST_ID = "workspace-deleted";

export interface WorkspaceEventEffects {
  /** O workspace aberto sumiu: quem chama decide se a tela atual (um detalhe dele) ainda faz sentido. */
  onWorkspaceGone?: () => void;
}

function markStatus(queryClient: QueryClient, workspaceId: string | undefined, status: WorkspaceStatus): void {
  if (!workspaceId) return;
  if (setCachedWorkspaceStatus(queryClient, workspaceId, status)) {
    // O servidor é quem manda: a lista fica marcada como velha e é conferida ao voltar para a aba (assim um
    // workspace reativado pelo suporte sai do bloqueio sem recarregar a página). Sem busca imediata.
    void queryClient.invalidateQueries({ queryKey: ME_WORKSPACES_KEY, refetchType: "none" });
  } else if (!getCachedWorkspaces(queryClient)?.some((w) => w.id === workspaceId)) {
    // A lista ainda não chegou (ou não conhece o workspace): busca para saber o estado de verdade.
    void queryClient.invalidateQueries({ queryKey: ME_WORKSPACES_KEY });
  }
}

function handleDeleted(
  queryClient: QueryClient,
  workspaceId: string | undefined,
  storedId: string | null,
  effects: WorkspaceEventEffects,
): void {
  const wasOpen = workspaceId === undefined || workspaceId === storedId;
  const inList = workspaceId !== undefined && !!getCachedWorkspaces(queryClient)?.some((w) => w.id === workspaceId);
  // Várias chamadas falham juntas: a primeira já tratou, as outras chegam com o workspace fora da lista e do storage.
  if (!wasOpen && !inList) return;

  if (workspaceId !== undefined) removeCachedWorkspace(queryClient, workspaceId);
  if (wasOpen) removeWorkspaceId();
  void queryClient.invalidateQueries({ queryKey: ME_WORKSPACES_KEY });
  // Excluído é o que o servidor diz agora; se não era o workspace aberto, a lista se corrige sem barulho.
  if (!wasOpen) return;

  const next = pickDefaultWorkspace(getCachedWorkspaces(queryClient) ?? []);
  toast.info(DELETED_NOTICE, {
    id: DELETED_TOAST_ID,
    description: next ? `Você está agora em ${next.name}.` : NO_WORKSPACES_NOTICE,
  });
  effects.onWorkspaceGone?.();
}

export function applyWorkspaceStateEvent(
  event: WorkspaceStateEvent,
  queryClient: QueryClient,
  effects: WorkspaceEventEffects = {},
): void {
  const storedId = getWorkspaceId();
  const workspaceId = event.workspaceId ?? storedId ?? undefined;
  switch (event.code) {
    case "WORKSPACE_SUSPENDED":
      markStatus(queryClient, workspaceId, "suspended");
      return;
    case "WORKSPACE_ARCHIVED":
      markStatus(queryClient, workspaceId, "archived");
      toast.info(ARCHIVED_NOTICE, { id: ARCHIVED_TOAST_ID });
      return;
    case "WORKSPACE_DELETED":
      handleDeleted(queryClient, workspaceId, storedId, effects);
      return;
  }
}

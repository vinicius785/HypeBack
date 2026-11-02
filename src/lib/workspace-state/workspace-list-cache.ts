/**
 * A lista de workspaces da pessoa (`["me-workspaces"]`) é a fonte do estado de cada workspace: o contexto
 * deriva o selecionado dela. Quando uma resposta do servidor revela que o estado mudou (suspenso, arquivado,
 * excluído), as reações corrigem a lista em cache na hora; a próxima busca traz a verdade do servidor.
 */
import type { QueryClient } from "@tanstack/react-query";

import { getWorkspaceId } from "@/lib/utils/api";
import type { Workspace, WorkspaceStatus } from "@/shared/types";

/** Mesma chave de `useWorkspaces` (`hooks/use-workspaces.ts`) e das telas que invalidam a lista. */
export const ME_WORKSPACES_KEY = ["me-workspaces"] as const;

export function getCachedWorkspaces(queryClient: QueryClient): Workspace[] | undefined {
  return queryClient.getQueryData<Workspace[]>(ME_WORKSPACES_KEY);
}

/** Troca o estado de um workspace da lista em cache. `false` quando ele não está na lista ou já tem esse estado. */
export function setCachedWorkspaceStatus(
  queryClient: QueryClient,
  workspaceId: string,
  status: WorkspaceStatus,
): boolean {
  const list = getCachedWorkspaces(queryClient);
  const current = list?.find((w) => w.id === workspaceId);
  if (!list || !current || current.status === status) return false;
  queryClient.setQueryData<Workspace[]>(
    ME_WORKSPACES_KEY,
    list.map((w) => (w.id === workspaceId ? { ...w, status } : w)),
  );
  return true;
}

/** Tira um workspace da lista em cache. `false` quando ele não estava nela. */
export function removeCachedWorkspace(queryClient: QueryClient, workspaceId: string): boolean {
  const list = getCachedWorkspaces(queryClient);
  if (!list?.some((w) => w.id === workspaceId)) return false;
  queryClient.setQueryData<Workspace[]>(
    ME_WORKSPACES_KEY,
    list.filter((w) => w.id !== workspaceId),
  );
  return true;
}

/**
 * Workspace a abrir quando não há um guardado (ou o guardado sumiu): o primeiro que está funcionando; só se
 * nenhum estiver, o primeiro da lista (a pessoa cai na explicação do bloqueio, e o menu deixa trocar).
 */
export function pickDefaultWorkspace(workspaces: readonly Workspace[]): Workspace | undefined {
  return workspaces.find((w) => w.status === "active") ?? workspaces[0];
}

/** O workspace guardado (o das chamadas em andamento) está suspenso segundo a lista em cache. */
export function isStoredWorkspaceSuspended(queryClient: QueryClient): boolean {
  const id = getWorkspaceId();
  if (!id) return false;
  return getCachedWorkspaces(queryClient)?.find((w) => w.id === id)?.status === "suspended";
}

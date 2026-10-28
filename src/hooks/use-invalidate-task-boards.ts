import type { QueryClient } from "@tanstack/react-query";

/**
 * Prefixo da chave do board agregado "Tarefas e aprovações" da home
 * (`useWorkspaceOverview` → `getWorkspaceDashboardOverview`). A chave real tem o
 * `workspaceId` como sufixo (`withWorkspaceKey`); invalidar pelo prefixo casa
 * todos os workspaces por prefix-match.
 */
export const WORKSPACE_OVERVIEW_QUERY_KEY = [
  "workspace-dashboard-overview",
] as const;

/**
 * Invalida as caches que alimentam os boards de "Tarefas e aprovações":
 * - o dashboard da campanha (board in-page do `dashboard-tab`);
 * - o **overview agregado do workspace** (board da home).
 *
 * Toda mutação que RESOLVE uma pendência (aprovar/recusar roteiro, conteúdo,
 * participante, contrato…) deve chamar isto. O overview NÃO é filho da chave da
 * campanha, então invalidar apenas `["campaigns", id, "dashboard"]` não o atinge
 * — por isso itens resolvidos continuavam no board da home até o staleTime (60s).
 */
export function invalidateCampaignTaskBoards(
  queryClient: QueryClient,
  campaignId: string,
): void {
  queryClient.invalidateQueries({
    queryKey: ["campaigns", campaignId, "dashboard"],
  });
  queryClient.invalidateQueries({ queryKey: WORKSPACE_OVERVIEW_QUERY_KEY });
}

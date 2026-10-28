import { useWorkspaceIdForQueries } from "@/contexts/workspace-context";

/**
 * Id do workspace atual para compor queryKeys; dados da API dependem do header Workspace-Id.
 */
export function useWorkspaceQueryKey(): string | undefined {
  return useWorkspaceIdForQueries();
}

/**
 * Anexa o workspace ao fim da chave para não reutilizar cache entre workspaces.
 * Com `enabled: !!workspaceId`, o placeholder `__no_workspace__` nunca dispara fetch.
 */
export function withWorkspaceKey(
  parts: readonly unknown[],
  workspaceId: string | undefined,
): unknown[] {
  return [...parts, workspaceId ?? "__no_workspace__"];
}

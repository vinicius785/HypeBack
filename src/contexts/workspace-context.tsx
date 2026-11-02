import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import type { Workspace, WorkspacePermissions } from "@/shared/types";
import { getWorkspaceId, saveWorkspaceId } from "@/lib/utils/api";
import { invalidateWorkspaceScopedQueries } from "@/lib/utils/workspace-query-invalidation";
import { useWorkspaceLifecycleReactions } from "@/lib/workspace-state/use-workspace-lifecycle-reactions";
import { pickDefaultWorkspace } from "@/lib/workspace-state/workspace-list-cache";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { mergeWorkspacePermissions } from "@/shared/utils/workspace-permissions";

interface WorkspaceContextType {
  workspaces: Workspace[];
  isLoading: boolean;
  isInitialized: boolean;
  selectedWorkspace: Workspace | undefined;
  permissions: WorkspacePermissions;
  selectWorkspace: (workspace: Workspace) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

/** Workspace suspenso recusa toda chamada: não há o que rebuscar (a tela de bloqueio explica). */
function refreshWorkspaceScopedQueries(queryClient: QueryClient, workspace: Workspace) {
  if (workspace.status === "suspended") return;
  invalidateWorkspaceScopedQueries(queryClient);
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const [selectedWorkspace, setSelectedWorkspace] = useState<
    Workspace | undefined
  >(undefined);
  const [isInitialized, setIsInitialized] = useState(false);

  // O estado do workspace (suspenso, arquivado, excluído) é revelado pelas respostas do servidor e entra na
  // lista abaixo; o workspace selecionado é derivado dela. Ver `lib/workspace-state/`.
  useWorkspaceLifecycleReactions();

  // Restaurar workspace salvo ou auto-selecionar o primeiro que está funcionando
  useEffect(() => {
    if (isLoading) return;
    if (workspaces.length === 0) {
      // Sem workspaces (conta nova, ou o último foi excluído): nenhum fica selecionado.
      setSelectedWorkspace(undefined);
      setIsInitialized(true);
      return;
    }

    const savedWorkspaceId = getWorkspaceId();
    const savedWorkspace = workspaces.find((w) => w.id === savedWorkspaceId);

    if (savedWorkspace) {
      setSelectedWorkspace(savedWorkspace);
    } else {
      const next = pickDefaultWorkspace(workspaces) ?? workspaces[0];
      setSelectedWorkspace(next);
      saveWorkspaceId(next.id);
      refreshWorkspaceScopedQueries(queryClient, next);
    }
    setIsInitialized(true);
  }, [isLoading, workspaces, queryClient]);

  const selectWorkspace = useCallback(
    (workspace: Workspace) => {
      setSelectedWorkspace(workspace);
      saveWorkspaceId(workspace.id);
      refreshWorkspaceScopedQueries(queryClient, workspace);
    },
    [queryClient],
  );

  const permissions = useMemo(
    () => mergeWorkspacePermissions(selectedWorkspace?.permissions),
    [selectedWorkspace?.permissions],
  );

  const value = useMemo(
    () => ({
      workspaces,
      isLoading,
      isInitialized,
      selectedWorkspace,
      permissions,
      selectWorkspace,
    }),
    [
      workspaces,
      isLoading,
      isInitialized,
      selectedWorkspace,
      permissions,
      selectWorkspace,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceContext must be used within WorkspaceProvider");
  }
  return context;
}

/**
 * Id para queryKeys escopadas ao workspace. Fora do provider usa `localStorage`
 * (ex.: telas que ainda não montaram o contexto).
 */
export function useWorkspaceIdForQueries(): string | undefined {
  const ctx = useContext(WorkspaceContext);
  return ctx?.selectedWorkspace?.id ?? getWorkspaceId() ?? undefined;
}

/** Atalho para `useWorkspaceContext().permissions`. */
export function useWorkspacePermissions() {
  return useWorkspaceContext().permissions;
}

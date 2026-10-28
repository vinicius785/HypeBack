import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { Workspace, WorkspacePermissions } from "@/shared/types";
import { getWorkspaceId, saveWorkspaceId } from "@/lib/utils/api";
import { invalidateWorkspaceScopedQueries } from "@/lib/utils/workspace-query-invalidation";
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

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const [selectedWorkspace, setSelectedWorkspace] = useState<
    Workspace | undefined
  >(undefined);
  const [isInitialized, setIsInitialized] = useState(false);

  // Restaurar workspace salvo ou auto-selecionar o primeiro
  useEffect(() => {
    if (isLoading) return;
    if (workspaces.length === 0) {
      setIsInitialized(true);
      return;
    }

    const savedWorkspaceId = getWorkspaceId();
    const savedWorkspace = workspaces.find((w) => w.id === savedWorkspaceId);

    if (savedWorkspace) {
      setSelectedWorkspace(savedWorkspace);
    } else {
      setSelectedWorkspace(workspaces[0]);
      saveWorkspaceId(workspaces[0].id);
      invalidateWorkspaceScopedQueries(queryClient);
    }
    setIsInitialized(true);
  }, [isLoading, workspaces, queryClient]);

  const selectWorkspace = useCallback(
    (workspace: Workspace) => {
      setSelectedWorkspace(workspace);
      saveWorkspaceId(workspace.id);
      invalidateWorkspaceScopedQueries(queryClient);
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

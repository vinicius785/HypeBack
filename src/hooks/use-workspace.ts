import { useState, useEffect, useRef } from "react";

import type { Workspace } from "@/shared/types";
import { getWorkspaceId, saveWorkspaceId } from "@/lib/utils/api";

export function useWorkspace(options: Workspace[], initialValue?: Workspace) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<
    Workspace | undefined
  >(initialValue);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!hasRestoredRef.current && !initialValue && options.length > 0) {
      const savedWorkspaceId = getWorkspaceId();
      if (savedWorkspaceId) {
        const savedWorkspace = options.find(
          (option) => option.id === savedWorkspaceId // Comparação direta, ambos são strings
        );
        if (savedWorkspace) {
          setSelectedWorkspace(savedWorkspace);
        }
      }
      hasRestoredRef.current = true;
    }
  }, [options, initialValue]);

  useEffect(() => {
    if (initialValue !== undefined) {
      setSelectedWorkspace(initialValue);
      hasRestoredRef.current = true;
    }
  }, [initialValue]);

  const selectWorkspace = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    saveWorkspaceId(workspace.id); // workspace.id já é string (UUID)
  };

  return {
    selectedWorkspace,
    selectWorkspace,
  };
}

import { useQuery } from "@tanstack/react-query";
import { getMyWorkspaces } from "@/shared/services/workspace";

/**
 * Workspaces do usuário (`GET /me/workspaces`) com permissões por papel.
 */
export function useWorkspaces() {
  return useQuery({
    queryKey: ["me-workspaces"],
    queryFn: getMyWorkspaces,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
}


import { useMemo } from "react";

import { useAuth } from "@/contexts/auth-context";
import { useWorkspaceIdForQueries } from "@/contexts/workspace-context";
import { useWorkspaceMembersQuery } from "@/hooks/use-workspace-members";

export interface PersonOption {
  id: number;
  name: string;
  /** A lista de membros não traz foto; vem das tarefas (quem já é responsável) e da própria pessoa logada. */
  avatar?: string | null;
}

/**
 * Quem pode ser responsável por uma tarefa: os membros do workspace (o mesmo serviço da tela de equipe, que exige a
 * permissão `members_list`). Se a lista não chegar (erro ou sem essa permissão), `failed` fica verdadeiro e sobra a própria
 * pessoa como opção ("atribuir a mim"), além de quem já é responsável, que o modal sempre mostra.
 */
export function useWorkspacePeople(options?: { enabled?: boolean }): { people: PersonOption[]; isLoading: boolean; failed: boolean } {
  const workspaceId = useWorkspaceIdForQueries();
  const { user } = useAuth();
  const query = useWorkspaceMembersQuery(options?.enabled === false ? undefined : workspaceId);
  const people = useMemo(() => {
    const list: PersonOption[] = (query.data ?? []).map((m) => ({ id: m.user_id, name: m.name || m.email }));
    if (query.isError && user && !list.some((p) => p.id === user.id)) list.push({ id: user.id, name: user.name || user.email, avatar: user.avatar });
    return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [query.data, query.isError, user]);
  return { people, isLoading: query.isLoading, failed: query.isError };
}

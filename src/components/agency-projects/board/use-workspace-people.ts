import { useMemo } from "react";

import { useAuth } from "@/contexts/auth-context";
import { useWorkspaceIdForQueries } from "@/contexts/workspace-context";
import { useWorkspaceMembersQuery } from "@/hooks/use-workspace-members";
import type { Project, Task } from "@/shared/services/agency-projects";

export interface PersonOption {
  id: number;
  name: string;
  /** A lista de membros não traz foto; vem das tarefas (quem já é responsável) e da própria pessoa logada. */
  avatar?: string | null;
}

/**
 * Pessoas que o projeto já conhece, com foto: o responsável, os participantes e quem aparece como responsável nas tarefas.
 * A lista de membros do workspace pode vir sem foto; por aqui ela aparece para quem já trabalhou no projeto.
 */
export function knownProjectPeople(project: Pick<Project, "responsible" | "participants">, tasks: readonly Pick<Task, "assignees">[]): PersonOption[] {
  const byId = new Map<number, PersonOption>();
  const add = (p: { user_id: number; name: string; avatar: string | null } | null | undefined) => {
    if (!p) return;
    const prev = byId.get(p.user_id);
    byId.set(p.user_id, { id: p.user_id, name: p.name || prev?.name || "", avatar: p.avatar ?? prev?.avatar ?? null });
  };
  add(project.responsible);
  for (const p of project.participants) add(p);
  for (const t of tasks) for (const a of t.assignees) add(a);
  return [...byId.values()];
}

/**
 * Quem pode ser responsável por uma tarefa: os membros do workspace (o mesmo serviço da tela de equipe, que exige a
 * permissão `members_list`). Se a lista não chegar (erro ou sem essa permissão), `failed` fica verdadeiro e sobra a própria
 * pessoa como opção ("atribuir a mim"), além de quem já é responsável, que o modal sempre mostra.
 */
export function useWorkspacePeople(options?: { enabled?: boolean; known?: readonly PersonOption[] }): { people: PersonOption[]; isLoading: boolean; failed: boolean } {
  const workspaceId = useWorkspaceIdForQueries();
  const { user } = useAuth();
  const query = useWorkspaceMembersQuery(options?.enabled === false ? undefined : workspaceId);
  const people = useMemo(() => {
    const known = new Map((options?.known ?? []).map((p) => [p.id, p]));
    const photo = (id: number, own?: string | null) => own || known.get(id)?.avatar || (user?.id === id ? user.avatar : null) || null;
    const list: PersonOption[] = (query.data ?? []).map((m) => ({ id: m.user_id, name: m.name || m.email, avatar: photo(m.user_id, m.avatar) }));
    if (query.isError && user && !list.some((p) => p.id === user.id)) list.push({ id: user.id, name: user.name || user.email, avatar: user.avatar });
    return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [query.data, query.isError, user, options?.known]);
  return { people, isLoading: query.isLoading, failed: query.isError };
}

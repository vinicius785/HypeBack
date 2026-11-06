import { useWorkspaceContext } from "@/contexts/workspace-context";

/**
 * O usuário é "Cliente" da agência no workspace selecionado: acompanha e aprova só as campanhas das marcas dele.
 * Serve para esconder as áreas internas da agência (Marcas, Projetos, Elenco, chat da equipe); a barreira real é a API.
 */
export function useIsClientRole(): boolean {
  return useWorkspaceContext().selectedWorkspace?.role === "cliente";
}

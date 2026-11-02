import type { QueryClient } from "@tanstack/react-query";

import { removeAuthToken, removeWorkspaceId } from "./api";

/**
 * Encerra a sessão deste navegador: apaga o token e o workspace escolhido e esvazia o cache do React Query.
 *
 * As chaves de consulta (`get-current-user`, `me-workspaces`, `notifications`, toda a árvore do Admin) não
 * levam o usuário na chave. Sem esvaziar o cache, quem entrar em seguida na mesma aba veria, até o
 * refetch, os dados da conta anterior (listas do Admin com e-mails, workspaces, o `is_platform_admin`
 * antigo). Serve ao "Sair" (menu, menu mobile, Configurações, onboarding) e à sessão vencida no Admin.
 */
export function clearClientSession(queryClient: QueryClient): void {
  removeAuthToken();
  removeWorkspaceId();
  queryClient.clear();
}

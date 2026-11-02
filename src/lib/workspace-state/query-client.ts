/**
 * QueryClient do app com a política de repetição que respeita o ciclo de vida do workspace.
 *
 * O padrão do React Query repete 3 vezes qualquer consulta que falha (1s, 2s, 4s). Com workspace suspenso,
 * arquivado ou excluído a resposta é uma recusa do servidor (4xx com código): repetir só multiplica as chamadas
 * recusadas ("tempestade de retries"), e o sino de notificações ainda repete a cada minuto. Aqui essas recusas
 * não são repetidas; o resto segue com o padrão.
 */
import { QueryClient } from "@tanstack/react-query";

import { readWorkspaceStateError } from "./lifecycle-errors";
import { isStoredWorkspaceSuspended } from "./workspace-list-cache";

/** Mesmo limite do padrão do React Query. */
const DEFAULT_MAX_RETRIES = 3;

/**
 * `retry` das consultas. Não repete:
 * - erro com código de ciclo de vida (corpo cru ou `Error` com `code`);
 * - qualquer erro enquanto o workspace aberto está suspenso (serviços que descartam o corpo do erro não deixam
 *   o código à vista; o estado que o observador gravou na lista diz o que está acontecendo).
 */
export function shouldRetryQuery(failureCount: number, error: unknown, workspaceIsSuspended: () => boolean = () => false): boolean {
  if (readWorkspaceStateError(error) !== null) return false;
  if (workspaceIsSuspended()) return false;
  return failureCount < DEFAULT_MAX_RETRIES;
}

export function createAppQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          shouldRetryQuery(failureCount, error, () => isStoredWorkspaceSuspended(queryClient)),
      },
    },
  });
  return queryClient;
}

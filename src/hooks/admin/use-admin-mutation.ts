import { useRef } from "react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { newIdempotencyKey } from "@/lib/admin/admin-client";

export interface AdminMutationOptions<TData, TVariables> {
  /**
   * Faz a chamada. Receba a `Idempotency-Key` desta intenção e repasse a `adminPost`/`adminPatch`:
   * `(vars, idempotencyKey) => adminPost(path, body, { idempotencyKey })`.
   */
  mutationFn: (variables: TVariables, idempotencyKey: string) => Promise<TData>;
  /**
   * O que identifica a intenção. Padrão: o JSON das variáveis (mesmo corpo = mesma chave). Informe só se as
   * variáveis tiverem campos que não mudam o que o servidor grava.
   */
  fingerprint?: (variables: TVariables) => string;
  /** Chaves a invalidar no sucesso (`adminKeys.resource('workspaces')`, `adminKeys.of('overview')`...). */
  invalidate?: ReadonlyArray<readonly unknown[]>;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: unknown, variables: TVariables) => void;
}

/**
 * Ação de escrita do Admin com a `Idempotency-Key` certa, sem a tela ter de pensar nisso.
 *
 * - **mesmo corpo → mesma chave**: clique duplo ou reenvio depois de uma queda de rede (a resposta pode ter
 *   se perdido com o servidor já tendo gravado) é reconhecido pelo servidor em vez de duplicar a ação;
 * - **corpo diferente → chave nova**: reusar a chave com outro corpo dá `IDEMPOTENCY_CONFLICT`;
 * - **depois de um sucesso → chave nova** (a próxima ação, mesmo com o mesmo texto, é outra intenção);
 * - **depois de uma falha a chave fica**: tentar de novo é a mesma intenção;
 * - no sucesso invalida as chaves informadas.
 */
export function useAdminMutation<TData = void, TVariables = void>(
  options: AdminMutationOptions<TData, TVariables>,
): UseMutationResult<TData, unknown, TVariables> {
  const queryClient = useQueryClient();
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);

  return useMutation<TData, unknown, TVariables>({
    mutationFn: (variables) => {
      const fingerprint = options.fingerprint ? options.fingerprint(variables) : JSON.stringify(variables ?? null);
      if (!intent.current || intent.current.fingerprint !== fingerprint) {
        intent.current = { fingerprint, key: newIdempotencyKey() };
      }
      return options.mutationFn(variables, intent.current.key);
    },
    onSuccess: async (data, variables) => {
      intent.current = null;
      await Promise.all((options.invalidate ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      await options.onSuccess?.(data, variables);
    },
    onError: (error, variables) => options.onError?.(error, variables),
  });
}

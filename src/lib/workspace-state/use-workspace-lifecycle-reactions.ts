/**
 * Liga o observador de respostas às reações (`reactions.ts`) enquanto o `WorkspaceProvider` está montado.
 *
 * `useLayoutEffect`: efeitos de layout rodam antes de todos os efeitos normais, que é onde o React Query dispara
 * as primeiras consultas da tela. Assim nenhuma chamada nasce antes do observador existir.
 */
import { useLayoutEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { isWorkspaceDetailPath } from "./paths";
import { applyWorkspaceStateEvent } from "./reactions";
import { installWorkspaceStateObserver } from "./response-observer";

export function useWorkspaceLifecycleReactions(): void {
  const queryClient = useQueryClient();
  const router = useRouter();

  useLayoutEffect(
    () =>
      installWorkspaceStateObserver((event) =>
        applyWorkspaceStateEvent(event, queryClient, {
          onWorkspaceGone: () => {
            // Um detalhe do workspace que sumiu (campanha, live, perfil) não existe no próximo: volta ao início.
            if (isWorkspaceDetailPath(router.state.location.pathname)) {
              void router.navigate({ to: "/", replace: true });
            }
          },
        }),
      ),
    [queryClient, router],
  );
}

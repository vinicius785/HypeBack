import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/contexts/auth-context";
import { setAdminUnauthorizedHandler } from "@/lib/admin/admin-client";
import { clearClientSession } from "@/lib/utils/session";

/**
 * Sessão vencida no Admin: o cliente HTTP (`admin-client.ts`) só lança o erro e avisa; quem decide o que
 * fazer é o layout, montando este hook uma vez.
 *
 * Faz o mesmo que o app já faz quando `/me` volta 401 (`use-current-user.ts` e `(private)/_layout.tsx`):
 * apaga o token, zera o usuário e manda para `/sign-in` com `replace`. Além disso esvazia o cache inteiro
 * e o workspace escolhido (`clearClientSession`): dado de plataforma e da conta anterior não devem
 * sobreviver ao logout na memória do navegador.
 *
 * Cobre os dois jeitos de a sessão acabar no meio do uso: token vencido e conta suspensa por outro
 * administrador (o backend responde 401 no meio da sessão e 403 `ACCOUNT_SUSPENDED` no login).
 */
export function useAdminSessionGuard(): void {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let handled = false;
    return setAdminUnauthorizedHandler(() => {
      // Várias consultas falham juntas quando o token cai: só a primeira age.
      if (handled) return;
      handled = true;
      clearClientSession(queryClient);
      setUser(null);
      navigate({ to: "/sign-in", replace: true });
    });
  }, [setUser, navigate, queryClient]);
}

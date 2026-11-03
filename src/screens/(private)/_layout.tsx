import { useEffect } from "react";

import { useQueryClient } from "@tanstack/react-query";

import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";

import { getAuthToken } from "@/lib/utils/api";
import { clearClientSession } from "@/lib/utils/session";
import { needsWorkspaceCheck, onboardingRedirectFor } from "@/lib/onboarding/flow";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWorkspaces } from "@/hooks/use-workspaces";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

export const Route = createFileRoute("/(private)")({
  beforeLoad: async () => {
    const token = getAuthToken();

    if (!token) throw redirect({ to: "/sign-in" });
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { user, isLoading, error, isError } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Se houver erro de autenticação (401, 403, 404, 429), redirecionar para login
    if (isError && error) {
      const errorStatus = (error as any)?.status || (error as any)?.response?.status;
      
      // Se for erro 401 (não autorizado), 404 (não encontrado) ou 429 (too many requests)
      if (errorStatus === 401 || errorStatus === 404 || errorStatus === 429) {
        clearClientSession(queryClient);
        navigate({ to: "/sign-in", replace: true });
        return;
      }
    }
  }, [isError, error]); // Removido navigate das dependências

  const noUser = !user && !isLoading && !isError;
  useEffect(() => {
    // Token inválido sem erro de rede: encerra a sessão (fora do render, o clear do cache notifica assinantes).
    if (noUser) {
      clearClientSession(queryClient);
      navigate({ to: "/sign-in", replace: true });
    }
  }, [noUser, queryClient, navigate]);

  // Conta nova cai na Configuração da conta. Com a confirmação do telefone desligada (lib/onboarding/flow.ts), é a
  // falta de marca que decide, então a lista de marcas é consultada antes (só para quem pode ser conta nova).
  const checkWorkspaces = needsWorkspaceCheck(user);
  const { data: workspaces, isPending: workspacesPending } = useWorkspaces({ enabled: checkWorkspaces });
  const onboardingTo = onboardingRedirectFor({
    user,
    workspaceCount: workspaces?.length,
    pathname: location.pathname,
  });
  useEffect(() => {
    if (onboardingTo) navigate({ to: onboardingTo, replace: true });
  }, [onboardingTo, navigate]);

  // Se houver erro e não for erro de autenticação, mostrar erro
  if (isError && error && !isLoading) {
    const errorStatus = (error as any)?.status || (error as any)?.response?.status;
    
    // Se não for erro de autenticação, ainda mostrar loading ou erro genérico
    if (errorStatus !== 401 && errorStatus !== 404) {
      return (
        <div className="w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-neutral-950 mb-2">Erro ao carregar dados</p>
            <p className="text-sm text-neutral-600">
              {(error as Error)?.message || "Ocorreu um erro. Tente novamente."}
            </p>
          </div>
        </div>
      );
    }
    
    // Se for erro de autenticação, já vai redirecionar no useEffect acima
    return <LoadingSpinner message="Redirecionando..." />;
  }

  // Mostrar loading apenas se estiver carregando E não houver erro
  if (isLoading && !isError) {
    return <LoadingSpinner message="Preparando ambiente..." />;
  }

  // Se não houver usuário e não estiver carregando, pode ser que o token seja inválido
  if (noUser) {
    return <LoadingSpinner message="Redirecionando..." />;
  }

  if (!user) {
    return <LoadingSpinner message="Preparando ambiente..." />;
  }

  // Conta nova: espera saber se já tem marca, para não piscar o app antes de levá-la à configuração.
  if (checkWorkspaces && workspacesPending && !location.pathname.startsWith("/onboarding")) {
    return <LoadingSpinner message="Preparando ambiente..." />;
  }

  return <Outlet />;
}

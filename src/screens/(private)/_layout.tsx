import { useEffect } from "react";

import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";

import { getAuthToken, removeAuthToken } from "@/lib/utils/api";
import { useCurrentUser } from "@/hooks/use-current-user";

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

  useEffect(() => {
    // Se houver erro de autenticação (401, 403, 404, 429), redirecionar para login
    if (isError && error) {
      const errorStatus = (error as any)?.status || (error as any)?.response?.status;
      
      // Se for erro 401 (não autorizado), 404 (não encontrado) ou 429 (too many requests)
      if (errorStatus === 401 || errorStatus === 404 || errorStatus === 429) {
        removeAuthToken();
        navigate({ to: "/sign-in", replace: true });
        return;
      }
    }
  }, [isError, error]); // Removido navigate das dependências

  useEffect(() => {
    if (user && !user.phone && !location.pathname.startsWith("/onboarding")) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [user, location.pathname, navigate]);

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
  if (!user && !isLoading && !isError) {
    removeAuthToken();
    navigate({ to: "/sign-in", replace: true });
    return <LoadingSpinner message="Redirecionando..." />;
  }

  if (!user) {
    return <LoadingSpinner message="Preparando ambiente..." />;
  }

  return <Outlet />;
}

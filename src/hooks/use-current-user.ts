import { useEffect, useState, useRef } from "react";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import { getAuthToken, removeAuthToken } from "@/lib/utils/api";
import { getCurrentUser } from "@/shared/services/me";

export function useCurrentUser() {
  const { setUser } = useAuth();
  const token = getAuthToken();
  const hasRemovedTokenRef = useRef(false);

  const [isInitializing, setIsInitializing] = useState(true);

  // Verificar se já houve erro 401 antes (evitar múltiplas requisições)
  const shouldEnable = !!token && !hasRemovedTokenRef.current;

  const {
    data: currentUser,
    isLoading,
    error,
    isError,
  } = useQuery({
    queryKey: ["get-current-user"], // QueryKey único para compartilhar cache entre todas as instâncias
    queryFn: async () => {
      // Verificar novamente antes de fazer a requisição
      const currentToken = getAuthToken();
      if (hasRemovedTokenRef.current || !currentToken) {
        throw new Error("Token removido");
      }
      return getCurrentUser();
    },
    enabled: shouldEnable,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Não refazer ao montar - usar cache se disponível
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos - evita múltiplas requisições
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    setIsInitializing(false);
  }, []);

  // Remover token imediatamente quando houver erro 401/404/429
  useEffect(() => {
    if (isError && error) {
      const errorStatus = (error as any)?.status || (error as any)?.response?.status;
      
      if (errorStatus === 401 || errorStatus === 404 || errorStatus === 429) {
        if (!hasRemovedTokenRef.current) {
          hasRemovedTokenRef.current = true;
          removeAuthToken();
          setUser(null);
        }
      }
    }
  }, [isError, error, setUser]);

  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
    }
  }, [currentUser, setUser]);

  const isActuallyLoading = isInitializing || (!!token && isLoading && !isError && !hasRemovedTokenRef.current);

  return {
    user: currentUser,
    isLoading: isActuallyLoading,
    error,
    isError,
  };
}

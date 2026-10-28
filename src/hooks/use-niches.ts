import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  clearPersistedNiches,
  getNiches,
  loadPersistedNiches,
  savePersistedNiches,
} from "@/shared/services/niche";
import type { Niche } from "@/shared/types";

export const NICHES_QUERY_KEY = ["niches"] as const;

/**
 * Hook para buscar todos os nichos disponíveis.
 *
 * Estratégia de cache em 3 camadas:
 *
 *  1. **localStorage** (TTL 24h) — sobrevive a reloads. Hidrata `initialData`
 *     instantaneamente, evitando flash de loading na maioria dos casos.
 *  2. **React Query memory cache** (staleTime 24h, gcTime 7d) — dentro da
 *     sessão, nenhum refetch automático; entre sessões, `gcTime` mantém em
 *     memory caso a hook remonte.
 *  3. **Request paralelizada** — quando precisa buscar, todas as páginas vão
 *     em paralelo (`Promise.all`).
 *
 * GET /niches não usa Workspace-Id; cache global é seguro.
 *
 * Para forçar refresh (ex.: após admin criar novo nicho):
 *   const refresh = useRefreshNiches();
 *   refresh();
 */
export function useNiches() {
  return useQuery<Niche[]>({
    queryKey: NICHES_QUERY_KEY,
    queryFn: async () => {
      const data = await getNiches();
      savePersistedNiches(data);
      return data;
    },
    // Hidrata com cache local — evita flash de loading se localStorage tem
    // dados válidos (< 24h). `initialData` só é usado quando o React Query
    // ainda não tem nada em memória.
    initialData: () => loadPersistedNiches() ?? undefined,
    initialDataUpdatedAt: () => {
      // Indica ao React Query quando os dados do localStorage foram salvos —
      // permite decidir corretamente se está stale.
      if (typeof window === "undefined") return undefined;
      try {
        const raw = window.localStorage.getItem("hypeapp:niches:v1");
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as { savedAt?: number };
        return typeof parsed?.savedAt === "number" ? parsed.savedAt : undefined;
      } catch {
        return undefined;
      }
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7d em memória após nenhum observer
    // Nichos quase nunca mudam — desligar refetches automáticos é seguro e
    // elimina ruído de rede em troca de tab, reconexão, etc.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/**
 * Função para forçar refresh dos nichos (limpa localStorage + invalida cache
 * do React Query). Use após criar/editar nichos no painel admin.
 */
export function useRefreshNiches() {
  const qc = useQueryClient();
  return () => {
    clearPersistedNiches();
    qc.invalidateQueries({ queryKey: NICHES_QUERY_KEY });
  };
}

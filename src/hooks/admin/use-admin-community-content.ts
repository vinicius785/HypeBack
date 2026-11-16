/**
 * Aulas e inspirações (aba "Conteúdos" do app). Os arquivos sobem pelas rotas de upload da Comunidade; aqui só se guardam os
 * endereços devolvidos. Sem paginação: a lista traz até 200, a mais nova primeiro.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminDelete, adminGet, adminPatchPlain, adminPostPlain } from "@/lib/admin/admin-client";
import type {
  CommunityInspiration,
  CommunityInspirationBody,
  CommunityLesson,
  CommunityLessonBody,
} from "@/shared/community-content.types";

const LESSONS = "/admin/community/lessons";
const INSPIRATIONS = "/admin/community/inspirations";

export const communityContentKeys = {
  lessons: ["admin", "community-content", "lessons"] as const,
  inspirations: ["admin", "community-content", "inspirations"] as const,
};

export function useCommunityLessons() {
  return useQuery({ queryKey: communityContentKeys.lessons, queryFn: ({ signal }) => adminGet<CommunityLesson[]>(LESSONS, undefined, { signal }), staleTime: 15_000 });
}

export function useCommunityInspirations() {
  return useQuery({ queryKey: communityContentKeys.inspirations, queryFn: ({ signal }) => adminGet<CommunityInspiration[]>(INSPIRATIONS, undefined, { signal }), staleTime: 15_000 });
}

function useContentMutations<TItem, TBody>(base: string, key: readonly string[]) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  return {
    create: useMutation<TItem, unknown, TBody>({ mutationFn: (body) => adminPostPlain<TItem>(base, body), onSuccess: refresh }),
    update: useMutation<TItem, unknown, { id: string; body: Partial<TBody> }>({
      mutationFn: ({ id, body }) => adminPatchPlain<TItem>(`${base}/${encodeURIComponent(id)}`, body),
      onSuccess: refresh,
    }),
    remove: useMutation<void, unknown, string>({ mutationFn: (id) => adminDelete(`${base}/${encodeURIComponent(id)}`), onSuccess: refresh }),
  };
}

export function useLessonMutations() {
  return useContentMutations<CommunityLesson, CommunityLessonBody>(LESSONS, communityContentKeys.lessons);
}

export function useInspirationMutations() {
  return useContentMutations<CommunityInspiration, CommunityInspirationBody>(INSPIRATIONS, communityContentKeys.inspirations);
}

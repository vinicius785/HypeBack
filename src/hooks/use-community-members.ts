/** Hooks React Query da equipe da comunidade (moderadores e contas oficiais) — escopo global (super-admin). */
import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { communityPostKeys } from "@/hooks/use-community-posts";
import {
  listCommunityMembers,
  updateCommunityMember,
  type CommunityMembersFilter,
  type UpdateCommunityMemberInput,
} from "@/shared/services/community-members";

const PAGE_SIZE = 20;

export const communityMemberKeys = {
  all: ["admin-community-members"] as const,
  list: (filter: CommunityMembersFilter, q: string) => ["admin-community-members", "list", filter, q] as const,
};

export function useCommunityMembers(params: { filter: CommunityMembersFilter; q?: string }) {
  const q = params.q?.trim() ?? "";
  return useInfiniteQuery({
    queryKey: communityMemberKeys.list(params.filter, q),
    queryFn: ({ pageParam }) => listCommunityMembers({ filter: params.filter, q: q || undefined, page: pageParam, perPage: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.total_pages ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateCommunityMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: UpdateCommunityMemberInput }) => updateCommunityMember(userId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityMemberKeys.all });
      // O selo aparece nos autores do Feed.
      void queryClient.invalidateQueries({ queryKey: communityPostKeys.all });
    },
  });
}

/**
 * Hooks React Query da moderação de posts da comunidade — escopo global
 * (super-admin), como `use-groups.ts`.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  deleteCommunityPost,
  listCommunityPosts,
} from "@/shared/services/community-posts";
import { groupKeys } from "@/hooks/use-groups";

const PAGE_SIZE = 20;

export const communityPostKeys = {
  all: ["admin-community-posts"] as const,
  list: (group: string, search: string) =>
    ["admin-community-posts", "list", group, search] as const,
};

export function useCommunityPosts(
  params: { group?: string; search?: string } = {},
) {
  const group = params.group ?? "all";
  const search = params.search ?? "";
  return useInfiniteQuery({
    queryKey: communityPostKeys.list(group, search),
    queryFn: ({ pageParam }) =>
      listCommunityPosts({
        group,
        search: search || undefined,
        cursor: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) =>
      last.meta.has_more ? last.meta.next_cursor : undefined,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useDeleteCommunityPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deleteCommunityPost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityPostKeys.all });
      // O post pode estar num grupo: `posts_count` e a aba Conteúdos mudam.
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

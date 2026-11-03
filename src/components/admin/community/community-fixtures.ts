/** Publicações e páginas de exemplo para os testes da Comunidade do Admin. */
import type { CommunityPostModeration, CommunityPostPage } from "@/shared/services/community-posts";

export const GROUP_REF = { id: "g-moda", name: "Moda e Estilo", color: "9e2cfa" };

export function makePost(overrides: Partial<CommunityPostModeration> = {}): CommunityPostModeration {
  return {
    id: "p1",
    content: "Gravei um vídeo novo hoje!",
    image_url: null,
    video_url: null,
    video_thumbnail_url: null,
    author: { id: "u1", name: "Marina Alves", avatar_url: null },
    likes_count: 12,
    comments_count: 3,
    created_at: "2026-11-02T12:00:00.000Z",
    group: null,
    ...overrides,
  };
}

/** Uma página do cursor; `next` preenchido diz que há mais. */
export function postPage(items: CommunityPostModeration[], next: string | null = null): CommunityPostPage {
  return { items, meta: { next_cursor: next, has_more: next !== null } };
}

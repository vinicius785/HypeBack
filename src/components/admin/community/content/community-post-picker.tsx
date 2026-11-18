import { useMemo, useState } from "react";

import { AdminEmptyState, AdminErrorState, AdminLoadMore, AdminSearchInput, AdminSkeleton } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useCommunityPosts } from "@/hooks/use-community-posts";
import { getUploadUrl } from "@/lib/utils/api";
import type { CommunityPostModeration } from "@/shared/services/community-posts";

function mediaSrc(url: string | null | undefined): string | undefined {
  return url ? (url.startsWith("/") ? getUploadUrl(url) : url) : undefined;
}

/** Só entra quem tem foto ou vídeo: inspiração é visual. */
export function postHasMedia(post: CommunityPostModeration): boolean {
  return !!post.image_url || !!post.video_url;
}

/** O que a inspiração herda de uma publicação da comunidade. O poster do vídeo vira a foto; sem ele, a foto fica vazia (precisa enviar). */
export function inspirationFromPost(post: CommunityPostModeration) {
  const title = post.content.replace(/\s+/g, " ").trim().slice(0, 150);
  return {
    title,
    imageUrl: post.image_url ?? post.video_thumbnail_url ?? "",
    videoUrl: post.video_url ?? "",
    authorId: post.author.id,
    needsPoster: !!post.video_url && !post.image_url && !post.video_thumbnail_url,
  };
}

/** Escolher uma publicação da comunidade (feed e grupos) com foto ou vídeo: busca, grade e "carregar mais". */
export function CommunityPostPicker({ onPick }: { onPick: (post: CommunityPostModeration) => void }) {
  const [search, setSearch] = useState("");

  const query = useCommunityPosts({ search });
  const posts = useMemo(() => (query.data?.pages.flatMap((page) => page.items) ?? []).filter(postHasMedia), [query.data]);

  return (
    <div className="adm-picker">
      <AdminSearchInput value={search} onSearch={(value) => setSearch(value.trim())} placeholder="Buscar por texto ou autor" label="Buscar publicações" />
      {query.isLoading ? (
        <div className="adm-picker-grid" role="status" aria-busy="true">
          <span className="adm-sr">Carregando publicações…</span>
          {Array.from({ length: 6 }, (_, i) => (
            <AdminSkeleton key={i} height={200} radius="var(--adm-r-md)" />
          ))}
        </div>
      ) : query.error ? (
        <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
      ) : posts.length === 0 ? (
        <AdminEmptyState compact title="Nenhuma publicação com foto ou vídeo" description={search ? "Tente outra busca." : "Quando a comunidade publicar com mídia, ela aparece aqui."} />
      ) : (
        <>
          <ul className="adm-picker-grid" aria-label="Publicações da comunidade">
            {posts.map((post) => {
              const src = mediaSrc(post.image_url ?? post.video_thumbnail_url);
              const video = mediaSrc(post.video_url);
              return (
                <li key={post.id}>
                  <button type="button" className="adm-picker-card" onClick={() => onPick(post)} aria-label={`Escolher a publicação de ${post.author.name}`}>
                    {src ? <img src={src} alt="" loading="lazy" /> : video ? <video src={`${video}#t=0.5`} muted playsInline preload="metadata" aria-hidden="true" /> : null}
                    {post.video_url ? (
                      <em>
                        <I n="video" />
                        Vídeo
                      </em>
                    ) : null}
                    <span className="adm-picker-cap">
                      <b>{post.author.name}</b>
                      <small>{post.content.trim() || "Sem texto"}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <AdminLoadMore
            loaded={posts.length}
            hasMore={!!query.hasNextPage}
            loading={query.isFetchingNextPage}
            onLoadMore={() => void query.fetchNextPage()}
            noun={{ singular: "publicação", plural: "publicações", feminine: true }}
          />
        </>
      )}
    </div>
  );
}

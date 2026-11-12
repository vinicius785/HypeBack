import { useMemo, useState, type ReactNode } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";

import {
  AdminAvatar,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminErrorState,
  AdminFilterBar,
  inIsland,
  AdminIconButton,
  AdminLink,
  AdminListSkeleton,
  AdminLoadMore,
  AdminRefreshButton,
  AdminSearchInput,
  AdminSection,
  adminToast,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { communityPostKeys, useCommunityPosts, useDeleteCommunityPost } from "@/hooks/use-community-posts";
import { formatDateTime, formatInt, formatRelativeTime } from "@/lib/admin/format";
import { getUploadUrl } from "@/lib/utils/api";
import type { CommunityPostModeration } from "@/shared/services/community-posts";

import { VerifiedBadge } from "./verified-badge";

import "@/styles/admin-community.css";

/** `all` = tudo o que os criadores publicam; `none` = só o que está fora de grupos (a API chama de "feed geral"). */
type FeedScope = "all" | "none";

const SCOPE_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "none", label: "Sem grupo" },
] as const;

/** Cor do grupo na API: hex sem `#` (vazio quando o grupo só tem capa). */
function groupDot(color: string): string {
  return /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : "var(--adm-text-muted)";
}

function FeedMedia({ post }: { post: CommunityPostModeration }) {
  // Vídeo tem prioridade sobre imagem: é o que o app mostra quando o post traz os dois.
  const video = getUploadUrl(post.video_url);
  if (video) {
    const poster = getUploadUrl(post.video_thumbnail_url);
    return (
      <video
        className="adm-com-media"
        src={video}
        poster={poster}
        controls
        playsInline
        // A lista pode ter dezenas de vídeos: com capa, nada baixa até o play; sem capa, o primeiro quadro (metadata) é a capa.
        preload={poster ? "none" : "metadata"}
        aria-label="Vídeo da publicação"
      />
    );
  }
  const image = getUploadUrl(post.image_url);
  if (image) return <img className="adm-com-media" src={image} alt="Imagem da publicação" loading="lazy" />;
  return null;
}

/** "12 curtidas" / "1 curtida". */
function countText(count: number, singular: string, plural: string): string {
  return `${formatInt(count)} ${count === 1 ? singular : plural}`;
}

/** Ícone + o texto completo ("12 curtidas"): o número nunca fica sem a palavra que o explica. */
function FeedStat({ icon, text }: { icon: string; text: string }) {
  return (
    <span>
      <I n={icon} cls="sm" />
      {text}
    </span>
  );
}

function FeedItem({ post, onRemove }: { post: CommunityPostModeration; onRemove: (post: CommunityPostModeration) => void }) {
  const { author, group } = post;
  return (
    <li className="adm-com-item">
      <AdminAvatar name={author.name} photo={author.avatar_url} size={44} />
      <div className="adm-com-body">
        <p className="adm-com-meta">
          <b>{author.name}</b>
          {author.is_verified ? <VerifiedBadge /> : null}
          <time dateTime={post.created_at} title={formatDateTime(post.created_at)}>
            {formatRelativeTime(post.created_at)}
          </time>
          {group ? (
            <AdminLink
              to={{ to: "/admin/groups/$groupId", params: { groupId: group.id } }}
              className="adm-com-group"
              title={`Abrir o grupo ${group.name}`}
            >
              <i aria-hidden="true" style={{ background: groupDot(group.color) }} />
              <span>{group.name}</span>
            </AdminLink>
          ) : null}
        </p>
        {post.content ? <p className="adm-com-text">{post.content}</p> : null}
        <FeedMedia post={post} />
        <p className="adm-com-stats">
          <FeedStat icon="heart" text={countText(post.likes_count, "curtida", "curtidas")} />
          <FeedStat icon="msg" text={countText(post.comments_count, "comentário", "comentários")} />
        </p>
      </div>
      <AdminIconButton
        icon="trash"
        tone="danger"
        label={`Remover a publicação de ${author.name}`}
        onClick={() => onRemove(post)}
      />
    </li>
  );
}

/** A mesma publicação pode vir em duas páginas quando o cursor se move (alguém publica ou remove no meio). */
function uniqueById(posts: CommunityPostModeration[]): CommunityPostModeration[] {
  const seen = new Set<string>();
  return posts.filter((post) => (seen.has(post.id) ? false : (seen.add(post.id), true)));
}

/**
 * Feed da Comunidade: tudo o que os criadores publicam no app, dentro e fora de grupos, do mais recente para o
 * mais antigo. Dá para buscar pelo texto, ficar só com o que não está em grupo (que nenhum grupo modera) e remover
 * qualquer publicação. É o mesmo "Para você" que os criadores veem na aba Comunidade do app.
 */
export function CommunityFeed({ tools }: { tools?: HTMLElement | null } = {}) {
  const [scope, setScope] = useState<FeedScope>("all");
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<CommunityPostModeration | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const refreshing = useIsFetching({ queryKey: communityPostKeys.all }) > 0;

  const query = useCommunityPosts({ group: scope, search });
  const remove = useDeleteCommunityPost();
  const posts = useMemo(() => uniqueById(query.data?.pages.flatMap((page) => page.items) ?? []), [query.data]);

  const closeRemove = () => {
    if (remove.isPending) return;
    setRemoving(null);
    setRemoveError(null);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveError(null);
    try {
      await remove.mutateAsync(removing.id);
      adminToast.success("Publicação removida");
      setRemoving(null);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Não foi possível remover a publicação.");
    }
  };

  const clearSearch = () => setSearch("");

  let body: ReactNode;
  if (query.isPending) {
    body = (
      <div className="adm-com-skel">
        <AdminListSkeleton variant="timeline" rows={4} ariaLabel="Carregando publicações…" />
      </div>
    );
  } else if (query.isError) {
    body = (
      <AdminErrorState
        compact
        title="Não foi possível carregar o feed"
        message={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
        retrying={query.isRefetching}
      />
    );
  } else if (posts.length === 0) {
    body = search ? (
      <AdminEmptyState
        compact
        icon="search"
        title="Nenhuma publicação encontrada"
        description={`Nada no texto das publicações com “${search}”.`}
        action={
          <button type="button" className="btn out adm-btn-sm" onClick={clearSearch}>
            Limpar busca
          </button>
        }
      />
    ) : (
      <AdminEmptyState
        compact
        icon="file"
        title={scope === "none" ? "Nenhuma publicação fora de grupos" : "Nenhuma publicação ainda"}
        description="O que os criadores publicarem no app aparece aqui."
      />
    );
  } else {
    body = (
      <>
        <ul className="adm-com-list" aria-busy={query.isPlaceholderData ? true : undefined}>
          {posts.map((post) => (
            <FeedItem key={post.id} post={post} onRemove={setRemoving} />
          ))}
        </ul>
        <div className="adm-com-more">
          <AdminLoadMore
            loaded={posts.length}
            hasMore={!!query.hasNextPage}
            loading={query.isFetchingNextPage}
            onLoadMore={() => void query.fetchNextPage()}
            noun={{ singular: "publicação", plural: "publicações", feminine: true }}
          />
        </div>
      </>
    );
  }

  return (
    <div className="adm-com-stack">
      {inIsland(tools, (
      <AdminFilterBar
        // A origem (Todas, Sem grupo) mora no painel do ícone de filtro, como os estados das outras telas.
        filters={[{ kind: "select", key: "scope", label: "Origem das publicações", options: SCOPE_OPTIONS, defaultValue: "all" }]}
        values={{ scope }}
        onChange={(patch) => {
          if (patch.scope !== undefined) setScope(patch.scope as FeedScope);
        }}
        onClear={() => setScope("all")}
        search={
          <AdminSearchInput
            value={search}
            onSearch={setSearch}
            placeholder="Buscar no texto das publicações"
            label="Buscar publicações"
          />
        }
        searchLabel="Buscar publicações"
        compact
        trailing={
          <AdminRefreshButton
            iconOnly
            loading={refreshing}
            onClick={() => void queryClient.invalidateQueries({ queryKey: communityPostKeys.all })}
          />
        }
      />
      ))}

      <AdminSection flush>{body}</AdminSection>

      <AdminConfirmDialog
        open={removing !== null}
        tone="danger"
        eyebrow={removing ? `Publicação de ${removing.author.name}` : undefined}
        title="Remover esta publicação?"
        description="A publicação deixa de aparecer no app para todos os criadores. Esta ação não pode ser desfeita."
        reason={false}
        confirmLabel="Remover"
        pending={remove.isPending}
        pendingLabel="Removendo…"
        error={removeError}
        onConfirm={() => void confirmRemove()}
        onClose={closeRemove}
      >
        {removing?.content ? <blockquote className="adm-com-quote">{removing.content}</blockquote> : null}
      </AdminConfirmDialog>
    </div>
  );
}

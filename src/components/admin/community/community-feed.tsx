import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  AdminAvatar,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminErrorState,
  AdminFilterBar,
  AdminLink,
  AdminSearchInput,
  AdminSection,
  AdminSkeleton,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useCommunityPosts, useDeleteCommunityPost } from "@/hooks/use-community-posts";
import { formatDateTime, formatInt, formatRelativeTime } from "@/lib/admin/format";
import { getUploadUrl } from "@/lib/utils/api";
import type { CommunityPostModeration } from "@/shared/services/community-posts";

import "@/styles/admin-community.css";

/** `all` = tudo o que os criadores publicam; `none` = só o que está fora de grupos (a API chama de "feed geral"). */
type FeedScope = "all" | "none";

const SCOPE_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "none", label: "Sem grupo" },
] as const;

const NO_FILTER_VALUES: Readonly<Record<string, string>> = {};
const ignoreFilterChange = () => {};

/** Cor do grupo na API: hex sem `#` (vazio quando o grupo só tem capa). */
function groupDot(color: string): string {
  return /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : "var(--adm-text-muted)";
}

function FeedMedia({ post }: { post: CommunityPostModeration }) {
  // Vídeo tem prioridade sobre imagem: é o que o app mostra quando o post traz os dois.
  const video = getUploadUrl(post.video_url);
  if (video) {
    return (
      <video
        className="adm-com-media"
        src={video}
        poster={getUploadUrl(post.video_thumbnail_url)}
        controls
        playsInline
        preload="metadata"
        aria-label="Vídeo da publicação"
      />
    );
  }
  const image = getUploadUrl(post.image_url);
  if (image) return <img className="adm-com-media" src={image} alt="Imagem da publicação" loading="lazy" />;
  return null;
}

function FeedItem({ post, onRemove }: { post: CommunityPostModeration; onRemove: (post: CommunityPostModeration) => void }) {
  const { author, group } = post;
  return (
    <li className="adm-com-item">
      <AdminAvatar name={author.name} photo={author.avatar_url} size={44} />
      <div className="adm-com-body">
        <p className="adm-com-meta">
          <b>{author.name}</b>
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
          <span>
            <I n="heart" cls="sm" />
            {formatInt(post.likes_count)} {post.likes_count === 1 ? "curtida" : "curtidas"}
          </span>
          <span>
            <I n="msg" cls="sm" />
            {formatInt(post.comments_count)} {post.comments_count === 1 ? "comentário" : "comentários"}
          </span>
        </p>
      </div>
      <button
        type="button"
        className="btn ghost red adm-btn-sm"
        aria-label={`Remover a publicação de ${author.name}`}
        onClick={() => onRemove(post)}
      >
        <I n="trash" cls="sm" />
        Remover
      </button>
    </li>
  );
}

function FeedSkeleton() {
  return (
    <div className="adm-com-skeleton" role="status">
      <span className="adm-sr">Carregando…</span>
      {Array.from({ length: 4 }, (_, index) => (
        <div className="adm-com-item" key={index} aria-hidden="true">
          <AdminSkeleton width={44} height={44} radius="50%" />
          <div className="adm-com-body">
            <AdminSkeleton height={14} width="28%" />
            <AdminSkeleton height={12} width={`${88 - (index % 3) * 16}%`} style={{ marginTop: 12 }} />
            <AdminSkeleton height={12} width="54%" style={{ marginTop: 6 }} />
          </div>
          <AdminSkeleton width={92} height={36} radius={999} />
        </div>
      ))}
    </div>
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
export function CommunityFeed() {
  const [scope, setScope] = useState<FeedScope>("all");
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<CommunityPostModeration | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

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
      toast.success("Publicação removida");
      setRemoving(null);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Não foi possível remover a publicação.");
    }
  };

  const clearSearch = () => setSearch("");

  let body: ReactNode;
  if (query.isPending) {
    body = <FeedSkeleton />;
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
        {query.hasNextPage ? (
          <div className="adm-com-more">
            <button
              type="button"
              className="btn out adm-btn-sm"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="adm-com-stack">
      <AdminFilterBar
        segment={{
          options: SCOPE_OPTIONS,
          value: scope,
          onChange: (value) => setScope(value as FeedScope),
          ariaLabel: "Origem das publicações",
        }}
        search={
          <AdminSearchInput
            value={search}
            onSearch={setSearch}
            placeholder="Buscar no texto das publicações"
            label="Buscar publicações"
          />
        }
        values={NO_FILTER_VALUES}
        onChange={ignoreFilterChange}
      />

      <AdminSection flush>{body}</AdminSection>

      <AdminConfirmDialog
        open={removing !== null}
        tone="danger"
        eyebrow={removing ? `Publicação de ${removing.author.name}` : undefined}
        title="Remover esta publicação?"
        description="Ela deixa de aparecer no app para todos os criadores. O backoffice não tem como desfazer."
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

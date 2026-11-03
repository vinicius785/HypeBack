import { useId, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import {
  AdminConfirmDialog,
  AdminEmptyState,
  AdminErrorState,
  AdminListSkeleton,
  AdminLoadMore,
  AdminSkeleton,
  AdminTabPanel,
  AdminTabs,
  adminErrorMessage,
  adminToast,
  type AdminTabItem,
} from "@/components/admin/platform";
import {
  AccessPicker,
  CoverPicker,
  entryLabel,
  GroupImg,
  NameDescRules,
  OfficialSwitch,
  PvOverlay,
  useGroupForm,
} from "@/components/groups/pv-group";
import { PvPostComposer } from "@/components/groups/pv-post-composer";
import { Av, I } from "@/components/prototype/ui";
import {
  useAddGroupModerator,
  useDeleteGroup,
  useDeleteGroupPost,
  useGroup,
  useGroupPosts,
  useRemoveGroupModerator,
  useUpdateGroup,
  useUploadGroupCover,
} from "@/hooks/use-groups";
import { formatDate, formatInt } from "@/lib/admin/format";
import { getUploadUrl } from "@/lib/utils/api";
import type { CommunityGroupDetail, GroupPost } from "@/shared/types";

import { GROUPS_TAB_SEARCH } from "./community-search";

import "@/styles/admin-community.css";

type DetTab = "content" | "mods" | "edit";

const TAB_PREFIX = "adm-grp";

/** Texto de apoio de um número só com ícone: "12 curtidas". */
function countText(count: number, singular: string, plural: string): string {
  return `${formatInt(count)} ${count === 1 ? singular : plural}`;
}

/**
 * Diálogo de um grupo (`/admin/groups/$groupId`): conteúdos (moderação), moderadores e edição. Abre por cima da aba
 * Grupos. Carregando, o título é um esqueleto; com erro ou grupo inexistente, o diálogo diz o que houve.
 */
export function GroupDetailDialog({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
  const { data: group, isLoading, error, refetch, isFetching } = useGroup(groupId);
  const titleId = useId();
  // Volta para a aba Grupos (sem a busca, a Comunidade abriria no Feed).
  const close = () => navigate({ to: "/admin/groups", search: GROUPS_TAB_SEARCH });

  if (isLoading || error || !group) {
    const notFound = !isLoading && (!error || (error as { status?: number }).status === 404);
    return (
      <PvOverlay onClose={close} className="wide gpd" label="Grupo" labelledBy={isLoading ? undefined : titleId}>
        <div className="sh-h cm-h">
          <div className="gpx-dh">
            <div>
              <small>Grupo</small>
              {isLoading ? (
                <h2>
                  <AdminSkeleton width={220} height={26} radius={8} />
                  <span className="adm-sr" role="status">
                    Carregando grupo…
                  </span>
                </h2>
              ) : (
                <h2 id={titleId}>{notFound ? "Grupo não encontrado" : "Não foi possível abrir o grupo"}</h2>
              )}
            </div>
          </div>
          <button type="button" className="round" onClick={close} aria-label="Fechar">
            <I n="x" cls="sm" />
          </button>
        </div>
        <div className="gpx-db">
          {isLoading ? null : notFound ? (
            <AdminEmptyState compact icon="search" title="Não encontramos este grupo" description="Ele pode ter sido removido." />
          ) : (
            <AdminErrorState
              compact
              title="Não foi possível abrir o grupo"
              message={error instanceof Error ? error.message : undefined}
              onRetry={() => void refetch()}
              retrying={isFetching}
            />
          )}
        </div>
        <div className="cm-f">
          <span style={{ flex: 1 }} />
          <button type="button" className="btn out" onClick={close}>
            Fechar
          </button>
        </div>
      </PvOverlay>
    );
  }

  return <GroupDetail group={group} onClose={close} />;
}

function GroupDetail({ group, onClose }: { group: CommunityGroupDetail; onClose: () => void }) {
  const groupId = group.id;
  const [tab, setTab] = useState<DetTab>("content");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  // O composer de "Conteúdos" avisa quando está enviando mídia: o diálogo não fecha no meio do envio.
  const [composing, setComposing] = useState(false);
  const titleId = useId();
  const archived = !!group.deleted_at;

  const updateMutation = useUpdateGroup(groupId);
  const deleteMutation = useDeleteGroup();
  const uploadCover = useUploadGroupCover();

  const coverUrl = getUploadUrl(group.cover_url) ?? null;
  const f = useGroupForm({
    name: group.name,
    description: group.description,
    rules: group.rules,
    required_level: group.required_level,
    required_hype_points: group.required_hype_points,
    is_official: group.is_official,
    cover: coverUrl,
  });

  const saving = updateMutation.isPending || uploadCover.isPending;
  const busy = saving || deleteMutation.isPending || composing;

  const handleSave = async () => {
    f.setTried(true);
    if (Object.keys(f.errors).length > 0) {
      f.focusFirstError();
      adminToast.error("Corrija os campos destacados antes de continuar.");
      return;
    }
    const values = f.payload();
    try {
      let newCover: string | undefined;
      if (f.coverFile) {
        try {
          const uploaded = await uploadCover.mutateAsync(f.coverFile);
          newCover = uploaded.url;
        } catch {
          adminToast.warning("Não foi possível enviar a capa; salvando sem alterá-la.");
        }
      }
      await updateMutation.mutateAsync({
        name: values.name,
        description: values.description,
        is_official: values.is_official,
        rules: values.rules,
        required_level: values.required_level,
        required_hype_points: values.required_hype_points,
        ...(newCover !== undefined ? { cover_url: newCover } : {}),
      });
      f.setTried(false);
      adminToast.success("Alterações salvas");
    } catch (err) {
      adminToast.error(adminErrorMessage(err, "Não foi possível salvar."));
    }
  };

  const closeArchive = () => {
    if (deleteMutation.isPending) return;
    setArchiveOpen(false);
    setArchiveError(null);
  };

  const handleArchive = async () => {
    setArchiveError(null);
    try {
      await deleteMutation.mutateAsync(groupId);
      adminToast.success("Grupo arquivado");
      onClose();
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : "Não foi possível arquivar.");
    }
  };

  const mods = group.moderators;
  const postsCount = group.posts_count;
  const tabs: readonly AdminTabItem<DetTab>[] = [
    { id: "content", label: "Conteúdos", count: postsCount },
    { id: "mods", label: "Moderadores", count: mods.length },
    { id: "edit", label: "Editar" },
  ];

  return (
    <PvOverlay onClose={onClose} busy={busy} className="wide gpd" labelledBy={titleId}>
      <div className="sh-h cm-h">
        <div className="gpx-dh">
          <div className="gpx-th">
            <GroupImg src={coverUrl} name={group.name} cls="sm" />
          </div>
          <div>
            <small>
              {archived ? "Grupo arquivado" : "Grupo"}
              {group.is_official ? " · Oficial" : ""}
            </small>
            <h2 id={titleId}>{group.name}</h2>
            <span className="gpx-mt">
              <I n="users" cls="sm" />
              {group.members_count} membros
              <i />
              {entryLabel(group.required_level, group.required_hype_points)}
            </span>
          </div>
        </div>
        <button type="button" className="round" onClick={onClose} disabled={busy} aria-label="Fechar">
          <I n="x" cls="sm" />
        </button>
      </div>
      <AdminTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Seções do grupo" idPrefix={TAB_PREFIX} />
      <AdminTabPanel key={tab} idPrefix={TAB_PREFIX} id={tab} active className="gpx-db swp">
        {tab === "content" && <GroupContent groupId={groupId} onComposerBusyChange={setComposing} />}
        {tab === "mods" && <GroupModerators groupId={groupId} moderators={mods} />}
        {tab === "edit" && (
          <>
            <div className="gpx-ff">
              <div className="gpx-s0">
                <CoverPicker f={f} label="Capa do grupo" />
                <NameDescRules f={f} className="gpx-sf" />
              </div>
              <AccessPicker f={f} variant="tm" />
              <OfficialSwitch f={f} className="gpx-sw" />
            </div>
            <div className="gpx-dz">
              <div>
                <b>{archived ? "Grupo arquivado" : "Arquivar grupo"}</b>
                <small>
                  {archived
                    ? "O grupo está oculto no app dos criadores."
                    : "O grupo some do app; os conteúdos são preservados."}
                </small>
              </div>
              {archived ? null : (
                <button type="button" className="btn ghost red" onClick={() => setArchiveOpen(true)}>
                  Arquivar
                </button>
              )}
            </div>
          </>
        )}
      </AdminTabPanel>
      <div className="cm-f">
        {tab === "edit" ? (
          <>
            <button type="button" className="btn out" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="button" className="btn" onClick={handleSave} disabled={busy}>
              <I n="check" cls="sm" />
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </>
        ) : (
          <>
            <small>
              {tab === "content"
                ? typeof postsCount === "number"
                  ? `${postsCount} ${postsCount === 1 ? "conteúdo publicado" : "conteúdos publicados"}`
                  : "Conteúdos do grupo"
                : `${mods.length} ${mods.length === 1 ? "moderador" : "moderadores"}`}
            </small>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn out" onClick={onClose} disabled={busy}>
              Fechar
            </button>
          </>
        )}
      </div>

      <AdminConfirmDialog
        open={archiveOpen}
        tone="danger"
        eyebrow={`Grupo · ${group.name}`}
        title="Arquivar este grupo?"
        description="O grupo deixa de aparecer no app dos criadores. Os conteúdos continuam guardados."
        reason={false}
        confirmLabel="Arquivar"
        pending={deleteMutation.isPending}
        pendingLabel="Arquivando…"
        error={archiveError}
        onConfirm={() => void handleArchive()}
        onClose={closeArchive}
      />
    </PvOverlay>
  );
}

// ---------------------------------------------------------------------------
// Aba: Conteúdos (moderação de posts)
// ---------------------------------------------------------------------------

function GroupContent({ groupId, onComposerBusyChange }: { groupId: string; onComposerBusyChange: (busy: boolean) => void }) {
  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage, refetch, isRefetching } =
    useGroupPosts(groupId);
  const deletePost = useDeleteGroupPost(groupId);
  const [removing, setRemoving] = useState<GroupPost | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const posts = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const closeRemove = () => {
    if (deletePost.isPending) return;
    setRemoving(null);
    setRemoveError(null);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveError(null);
    try {
      await deletePost.mutateAsync(removing.id);
      adminToast.success("Conteúdo removido");
      setRemoving(null);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Não foi possível remover.");
    }
  };

  let list: ReactNode;
  if (isLoading) {
    list = <AdminListSkeleton variant="timeline" rows={3} ariaLabel="Carregando conteúdos…" />;
  } else if (error) {
    list = (
      <AdminErrorState
        compact
        title="Não foi possível carregar os conteúdos"
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
        retrying={isRefetching}
      />
    );
  } else if (posts.length === 0) {
    list = (
      <AdminEmptyState compact icon="file" title="Nenhum conteúdo ainda" description="As publicações dos membros aparecem aqui." />
    );
  } else {
    list = (
      <>
        <div className="gpx-pl">
          {posts.map((p) => {
            const video = getUploadUrl(p.video_url);
            const poster = getUploadUrl(p.video_thumbnail_url);
            const image = getUploadUrl(p.image_url);
            return (
              <div key={p.id} className="gpx-pr">
                <Av name={p.author.name} src={p.author.avatar_url ?? undefined} size={48} />
                <div className="gpx-pt">
                  <b>
                    {p.author.name}
                    <em>{formatDate(p.created_at)}</em>
                  </b>
                  <p style={{ whiteSpace: "pre-wrap" }}>{p.content}</p>
                  {video ? (
                    <video
                      className="gpx-md"
                      src={video}
                      poster={poster}
                      controls
                      playsInline
                      preload={poster ? "none" : "metadata"}
                      aria-label="Vídeo do post"
                    />
                  ) : image ? (
                    <img className="gpx-md im" src={image} alt="Conteúdo do post" loading="lazy" />
                  ) : null}
                  <small style={{ marginTop: 6 }}>
                    <span role="img" aria-label={countText(p.likes_count, "curtida", "curtidas")}>
                      <I n="heart" cls="sm" />
                      <span aria-hidden="true">{formatInt(p.likes_count)}</span>
                    </span>
                    &nbsp;&nbsp;
                    <I n="msg" cls="sm" />
                    {countText(p.comments_count, "comentário", "comentários")}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn ghost red"
                  aria-label={`Remover o conteúdo de ${p.author.name}`}
                  onClick={() => setRemoving(p)}
                >
                  <I n="trash" cls="sm" />
                  Remover
                </button>
              </div>
            );
          })}
        </div>
        <AdminLoadMore
          loaded={posts.length}
          hasMore={!!hasNextPage}
          loading={isFetchingNextPage}
          onLoadMore={() => void fetchNextPage()}
          noun={{ singular: "conteúdo", plural: "conteúdos" }}
        />
      </>
    );
  }

  return (
    <>
      <PvPostComposer groupId={groupId} onBusyChange={onComposerBusyChange} />
      {list}
      <AdminConfirmDialog
        open={removing !== null}
        tone="danger"
        eyebrow={removing ? `Conteúdo de ${removing.author.name}` : undefined}
        title="Remover este conteúdo?"
        description="O conteúdo deixa de aparecer no grupo. Esta ação não pode ser desfeita."
        reason={false}
        confirmLabel="Remover"
        pending={deletePost.isPending}
        pendingLabel="Removendo…"
        error={removeError}
        onConfirm={() => void confirmRemove()}
        onClose={closeRemove}
      >
        {removing?.content ? <blockquote className="adm-com-quote">{removing.content}</blockquote> : null}
      </AdminConfirmDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Aba: Moderadores
// ---------------------------------------------------------------------------

type Moderator = CommunityGroupDetail["moderators"][number];

function GroupModerators({ groupId, moderators }: { groupId: string; moderators: CommunityGroupDetail["moderators"] }) {
  const [userId, setUserId] = useState("");
  const [removing, setRemoving] = useState<Moderator | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const addMod = useAddGroupModerator(groupId);
  const removeMod = useRemoveGroupModerator(groupId);
  const inputId = useId();

  const handleAdd = async () => {
    const id = userId.trim();
    if (!id) {
      adminToast.error("Informe o ID do usuário.");
      return;
    }
    try {
      await addMod.mutateAsync(id);
      adminToast.success("Moderador adicionado");
      setUserId("");
    } catch (err) {
      adminToast.error(adminErrorMessage(err, "Não foi possível adicionar."));
    }
  };

  const closeRemove = () => {
    if (removeMod.isPending) return;
    setRemoving(null);
    setRemoveError(null);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveError(null);
    try {
      await removeMod.mutateAsync(removing.id);
      adminToast.success("Moderador removido");
      setRemoving(null);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Não foi possível remover.");
    }
  };

  return (
    <>
      <div className="gpx-ml">
        {moderators.length === 0 ? (
          <p className="gpx-nm">Este grupo ainda não tem moderadores.</p>
        ) : (
          moderators.map((m) => (
            <div key={m.id} className="gpx-mr">
              <Av name={m.name} src={m.avatar_url ?? undefined} size={48} />
              <div>
                <b>{m.name}</b>
                <small>@{m.username} · Moderador</small>
              </div>
              <button
                type="button"
                className="btn ghost red"
                aria-label={`Remover o moderador ${m.name}`}
                onClick={() => setRemoving(m)}
              >
                Remover
              </button>
            </div>
          ))
        )}
      </div>
      <div className="gpx-ad">
        <label className="n4l" htmlFor={inputId}>
          Adicionar moderador
        </label>
        <div className="gpx-add">
          <input
            id={inputId}
            className="cm-in"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAdd();
            }}
            placeholder="ID (UUID) do usuário"
            autoComplete="off"
          />
          <button type="button" className="btn" onClick={handleAdd} disabled={addMod.isPending}>
            <I n="plus" cls="sm" />
            {addMod.isPending ? "Adicionando…" : "Adicionar"}
          </button>
        </div>
      </div>

      <AdminConfirmDialog
        open={removing !== null}
        tone="danger"
        eyebrow={removing ? `Moderador · ${removing.name}` : undefined}
        title="Remover moderador?"
        description={removing ? `${removing.name} deixa de moderar este grupo.` : undefined}
        reason={false}
        confirmLabel="Remover"
        pending={removeMod.isPending}
        pendingLabel="Removendo…"
        error={removeError}
        onConfirm={() => void confirmRemove()}
        onClose={closeRemove}
      />
    </>
  );
}

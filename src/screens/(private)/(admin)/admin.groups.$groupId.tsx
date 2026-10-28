import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Av, I } from "@/components/prototype/ui";
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
import { getUploadUrl } from "@/lib/utils/api";
import type { CommunityGroupDetail, GroupPost } from "@/shared/types";

export const Route = createFileRoute(
  "/(private)/(admin)/admin/groups/$groupId" as "/(private)/(admin)/admin/groups/$groupId",
)({
  component: GroupDetailRoute,
});

type DetTab = "content" | "mods" | "edit";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function GroupDetailRoute() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const { data: group, isLoading, error } = useGroup(groupId);
  const close = () => navigate({ to: "/admin/groups" });

  if (isLoading || error || !group) {
    return (
      <PvOverlay onClose={close}>
        <section className="ovd on wide gpd" role="dialog" aria-label="Grupo">
          <div className="sh-h cm-h">
            <div className="gpx-dh">
              <div>
                <small>Grupo</small>
                <h2>{isLoading ? "Carregando…" : "Grupo não encontrado"}</h2>
              </div>
            </div>
            <button type="button" className="round" onClick={close} aria-label="Fechar">
              <I n="x" cls="sm" />
            </button>
          </div>
          <div className="gpx-db">
            {!isLoading && (
              <div className="gpx-em">
                <span>
                  <I n="x" />
                </span>
                <b>Não foi possível abrir o grupo</b>
                <small>
                  {error instanceof Error
                    ? error.message
                    : "Ele pode ter sido removido."}
                </small>
              </div>
            )}
          </div>
          <div className="cm-f">
            <span style={{ flex: 1 }} />
            <button type="button" className="btn out" onClick={close}>
              Fechar
            </button>
          </div>
        </section>
      </PvOverlay>
    );
  }

  return <GroupDetail group={group} onClose={close} />;
}

function GroupDetail({
  group,
  onClose,
}: {
  group: CommunityGroupDetail;
  onClose: () => void;
}) {
  const groupId = group.id;
  const [tab, setTab] = useState<DetTab>("content");
  const [conf, setConf] = useState<null | "arch">(null);
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

  const handleSave = async () => {
    f.setTried(true);
    if (Object.keys(f.errors).length > 0) {
      toast.error("Corrija os campos destacados antes de continuar.");
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
          toast.warning("Não foi possível enviar a capa; salvando sem alterá-la.");
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
      toast.success("Alterações salvas");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível salvar.",
      );
    }
  };

  const handleArchive = async () => {
    try {
      await deleteMutation.mutateAsync(groupId);
      toast.success("Grupo arquivado");
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível arquivar.",
      );
    }
  };

  const mods = group.moderators;
  const postsCount = group.posts_count;
  const switchTab = (t: DetTab) => {
    setConf(null);
    setTab(t);
  };

  return (
    <PvOverlay onClose={onClose}>
      <section className="ovd on wide gpd" role="dialog" aria-label="Grupo">
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
              <h2>{group.name}</h2>
              <span className="gpx-mt">
                <I n="users" cls="sm" />
                {group.members_count} membros
                <i />
                {entryLabel(group.required_level, group.required_hype_points)}
              </span>
            </div>
          </div>
          <button type="button" className="round" onClick={onClose} aria-label="Fechar">
            <I n="x" cls="sm" />
          </button>
        </div>
        <div className="sh-seg gpx-sg">
          {(
            [
              ["content", "Conteúdos", postsCount],
              ["mods", "Moderadores", mods.length],
              ["edit", "Editar", undefined],
            ] as [DetTab, string, number | undefined][]
          ).map(([k, l, n]) => (
            <button
              key={k}
              type="button"
              className={tab === k ? "on" : ""}
              onClick={() => switchTab(k)}
            >
              {l}
              {n != null ? <em>{n}</em> : null}
            </button>
          ))}
        </div>
        <div className="gpx-db swp" key={tab}>
          {tab === "content" && <GroupContent groupId={groupId} />}
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
                {archived ? null : conf === "arch" ? (
                  <div className="hdx-cf">
                    <b>Arquivar este grupo?</b>
                    <div>
                      <button
                        type="button"
                        className="btn out"
                        onClick={() => setConf(null)}
                        disabled={deleteMutation.isPending}
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        className="btn dng"
                        onClick={handleArchive}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? "Arquivando..." : "Arquivar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn ghost red"
                    onClick={() => setConf("arch")}
                  >
                    Arquivar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <div className="cm-f">
          {tab === "edit" ? (
            <>
              <button type="button" className="btn out" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleSave}
                disabled={saving}
              >
                <I n="check" cls="sm" />
                {saving ? "Salvando..." : "Salvar alterações"}
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
              <button type="button" className="btn out" onClick={onClose}>
                Fechar
              </button>
            </>
          )}
        </div>
      </section>
    </PvOverlay>
  );
}

// ---------------------------------------------------------------------------
// Aba: Conteúdos (moderação de posts)
// ---------------------------------------------------------------------------

function GroupContent({ groupId }: { groupId: string }) {
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGroupPosts(groupId);
  const deletePost = useDeleteGroupPost(groupId);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const posts = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const handleDelete = async (post: GroupPost) => {
    try {
      await deletePost.mutateAsync(post.id);
      toast.success("Conteúdo removido");
      setConfirmId(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível remover.",
      );
    }
  };

  let list: React.ReactNode;
  if (isLoading) {
    list = (
      <div className="gpx-em">
        <small>Carregando…</small>
      </div>
    );
  } else if (error) {
    list = (
      <div className="gpx-em">
        <span>
          <I n="x" />
        </span>
        <b>Erro ao carregar conteúdos</b>
        <small>{error instanceof Error ? error.message : "Tente novamente."}</small>
      </div>
    );
  } else if (posts.length === 0) {
    list = (
      <div className="gpx-em">
        <span>
          <I n="file" />
        </span>
        <b>Nenhum conteúdo ainda</b>
        <small>As publicações dos membros aparecem aqui.</small>
      </div>
    );
  } else {
    list = (
      <>
        <div className="gpx-pl">
          {posts.map((p) => {
            const cf = confirmId === p.id;
            const video = getUploadUrl(p.video_url);
            const image = getUploadUrl(p.image_url);
            return (
              <div key={p.id} className={`gpx-pr ${cf ? "cf" : ""}`}>
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
                      poster={getUploadUrl(p.video_thumbnail_url)}
                      controls
                      playsInline
                      preload="metadata"
                      aria-label="Vídeo do post"
                    />
                  ) : image ? (
                    <img className="gpx-md im" src={image} alt="Conteúdo do post" />
                  ) : null}
                  <small style={{ marginTop: 6 }}>
                    <I n="heart" cls="sm" />
                    {p.likes_count}
                    &nbsp;&nbsp;
                    <I n="msg" cls="sm" />
                    {p.comments_count} comentários
                  </small>
                </div>
                {cf ? (
                  <div className="hdx-cf">
                    <b>Remover este conteúdo?</b>
                    <div>
                      <button
                        type="button"
                        className="btn out"
                        onClick={() => setConfirmId(null)}
                        disabled={deletePost.isPending}
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        className="btn dng"
                        onClick={() => handleDelete(p)}
                        disabled={deletePost.isPending}
                      >
                        {deletePost.isPending ? "Removendo..." : "Remover"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn ghost red"
                    onClick={() => setConfirmId(p.id)}
                  >
                    <I n="trash" cls="sm" />
                    Remover
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {hasNextPage && (
          <div className="gpx-more">
            <button
              type="button"
              className="btn out"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? "Carregando..." : "Carregar mais"}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <PvPostComposer groupId={groupId} />
      {list}
    </>
  );
}

// ---------------------------------------------------------------------------
// Aba: Moderadores
// ---------------------------------------------------------------------------

function GroupModerators({
  groupId,
  moderators,
}: {
  groupId: string;
  moderators: CommunityGroupDetail["moderators"];
}) {
  const [userId, setUserId] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const addMod = useAddGroupModerator(groupId);
  const removeMod = useRemoveGroupModerator(groupId);

  const handleAdd = async () => {
    const id = userId.trim();
    if (!id) {
      toast.error("Informe o ID do usuário.");
      return;
    }
    try {
      await addMod.mutateAsync(id);
      toast.success("Moderador adicionado");
      setUserId("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível adicionar.",
      );
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeMod.mutateAsync(id);
      toast.success("Moderador removido");
      setConfirmId(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível remover.",
      );
    }
  };

  return (
    <>
      <div className="gpx-ml">
        {moderators.length === 0 ? (
          <p className="gpx-nm">Este grupo ainda não tem moderadores.</p>
        ) : (
          moderators.map((m) => {
            const cf = confirmId === m.id;
            return (
              <div key={m.id} className={`gpx-mr ${cf ? "cf" : ""}`}>
                <Av name={m.name} src={m.avatar_url ?? undefined} size={48} />
                <div>
                  <b>{m.name}</b>
                  <small>@{m.username} · Moderador</small>
                </div>
                {cf ? (
                  <div className="hdx-cf">
                    <b>Remover moderador?</b>
                    <div>
                      <button
                        type="button"
                        className="btn out"
                        onClick={() => setConfirmId(null)}
                        disabled={removeMod.isPending}
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        className="btn dng"
                        onClick={() => handleRemove(m.id)}
                        disabled={removeMod.isPending}
                      >
                        {removeMod.isPending ? "Removendo..." : "Remover"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn ghost red"
                    onClick={() => setConfirmId(m.id)}
                  >
                    Remover
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="gpx-ad">
        <label className="n4l">Adicionar moderador</label>
        <div className="gpx-add">
          <input
            className="cm-in"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAdd();
            }}
            placeholder="ID (UUID) do usuário"
            autoComplete="off"
          />
          <button
            type="button"
            className="btn"
            onClick={handleAdd}
            disabled={addMod.isPending}
          >
            <I n="plus" cls="sm" />
            {addMod.isPending ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
      </div>
    </>
  );
}

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Av, I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import {
  bulkAddCampaignGroupMembers,
  createCampaignGroupPost,
  createCampaignGroup,
  listCampaignGroupParticipants,
  listCampaignGroupPosts,
  listCampaignGroups,
  updateCampaignGroupLink,
  uploadCampaignGroupCover,
  type CampaignCommunityGroup,
} from "@/shared/services/campaign-groups";

interface GroupsTabProps {
  campaignId: string;
  canWrite: boolean;
}

export function GroupsTab({ campaignId, canWrite }: GroupsTabProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const groupsQuery = useQuery({
    queryKey: ["campaign-community-groups", campaignId],
    queryFn: () => listCampaignGroups(campaignId),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createCampaignGroup(campaignId, {
        name: name.trim(),
        description: description.trim(),
        auto_join_on_approval: true,
        remove_on_campaign_exit: false,
      }),
    onSuccess: async () => {
      setName("");
      setDescription("");
      await queryClient.invalidateQueries({
        queryKey: ["campaign-community-groups", campaignId],
      });
      toast.success("Grupo privado criado e vinculado à campanha.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = () => {
    if (name.trim().length < 2 || description.trim().length < 2) {
      toast.error("Informe nome e descrição do grupo.");
      return;
    }
    createMutation.mutate();
  };

  if (groupsQuery.isLoading) {
    return (
      <div className="pv">
        <div className="empty" style={{ padding: "70px 20px", background: "#fff", borderRadius: 32 }}>
          <span className="ei">
            <I n="users" />
          </span>
          <b>Carregando grupos…</b>
        </div>
      </div>
    );
  }
  if (groupsQuery.error) {
    return (
      <div className="pv">
        <div className="empty" style={{ padding: "70px 20px", background: "#fff", borderRadius: 32 }}>
          <span className="ei">
            <I n="users" />
          </span>
          <b>Não foi possível carregar os grupos</b>
          <p>{(groupsQuery.error as Error).message}</p>
          <button className="btn" onClick={() => groupsQuery.refetch()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const groups = groupsQuery.data ?? [];

  return (
    <>
      {groups.length === 0 ? (
        <div className="pv">
          <div className="empty" style={{ padding: "70px 20px", background: "#fff", borderRadius: 32 }}>
            <span className="ei">
              <I n="users" />
            </span>
            <b>Nenhum grupo vinculado</b>
            <p>Crie um grupo privado para reunir os participantes desta campanha.</p>
          </div>
        </div>
      ) : (
        groups.map((group) => (
          <CampaignGroupPanel
            key={group.id}
            campaignId={campaignId}
            group={group}
            canWrite={canWrite}
          />
        ))
      )}

      {canWrite && (
        <section className="mt-6 grid gap-3 rounded-[22px] bg-canvas p-4">
          <h3 className="font-semibold text-neutral-900">Criar novo grupo</h3>
          <Input
            label="Nome"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Creators da campanha"
          />
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-950">
            Descrição
            <textarea
              className="min-h-24 resize-y rounded-2xl border border-transparent bg-white px-4 py-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Objetivo e regras essenciais do grupo"
            />
          </label>
          <Button
            className="w-fit"
            disabled={createMutation.isPending}
            onClick={submit}
          >
            {createMutation.isPending ? "Criando…" : "Criar e vincular"}
          </Button>
        </section>
      )}
    </>
  );
}

function CampaignGroupPanel({
  campaignId,
  group,
  canWrite,
}: {
  campaignId: string;
  group: CampaignCommunityGroup;
  canWrite: boolean;
}) {
  const queryClient = useQueryClient();
  const [autoJoin, setAutoJoin] = useState(group.auto_join_on_approval);
  const [removeOnExit, setRemoveOnExit] = useState(
    group.remove_on_campaign_exit,
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [postDraft, setPostDraft] = useState("");

  useEffect(() => {
    setAutoJoin(group.auto_join_on_approval);
    setRemoveOnExit(group.remove_on_campaign_exit);
  }, [group.auto_join_on_approval, group.remove_on_campaign_exit]);
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [deferredSearch, status]);

  const participantKey = [
    "campaign-community-group-participants",
    campaignId,
    group.id,
    page,
    deferredSearch,
    status,
  ] as const;
  const participantsQuery = useQuery({
    queryKey: participantKey,
    queryFn: () =>
      listCampaignGroupParticipants(campaignId, group.id, {
        page,
        per_page: 25,
        search: deferredSearch || undefined,
        status,
      }),
  });

  const totalQuery = useQuery({
    queryKey: [
      "campaign-community-group-participants",
      campaignId,
      group.id,
      "total",
    ],
    queryFn: () =>
      listCampaignGroupParticipants(campaignId, group.id, {
        page: 1,
        per_page: 1,
        status: "all",
      }),
  });

  const postsKey = [
    "campaign-community-group-posts",
    campaignId,
    group.id,
  ] as const;
  const postsQuery = useQuery({
    queryKey: postsKey,
    queryFn: () =>
      listCampaignGroupPosts(campaignId, group.id, { page: 1, per_page: 5 }),
  });

  const configMutation = useMutation({
    mutationFn: (v: { auto: boolean; remove: boolean }) =>
      updateCampaignGroupLink(campaignId, group.id, {
        auto_join_on_approval: v.auto,
        remove_on_campaign_exit: v.remove,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["campaign-community-groups", campaignId],
      });
      toast.success("Configuração do grupo salva.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const bulkMutation = useMutation({
    mutationFn: (ids: number[]) =>
      bulkAddCampaignGroupMembers(campaignId, group.id, ids),
    onSuccess: async (result) => {
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["campaign-community-group-participants", campaignId, group.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["campaign-community-groups", campaignId],
        }),
      ]);
      const summary = `${result.meta.joined} incluído(s), ${result.meta.already_member} já estava(m) no grupo`;
      if (result.meta.failed > 0) {
        toast.error(`${summary} e ${result.meta.failed} falha(s).`);
      } else {
        toast.success(summary);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const postMutation = useMutation({
    mutationFn: () =>
      createCampaignGroupPost(campaignId, group.id, postDraft.trim()),
    onSuccess: async () => {
      setPostDraft("");
      await queryClient.invalidateQueries({ queryKey: postsKey });
      toast.success("Post publicado no grupo.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverMutation = useMutation({
    mutationFn: (file: File) =>
      uploadCampaignGroupCover(campaignId, group.id, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["campaign-community-groups", campaignId],
      });
      toast.success("Capa do grupo atualizada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A capa deve ter no máximo 5 MB.");
      return;
    }
    coverMutation.mutate(file);
  };

  const rows = participantsQuery.data?.data ?? [];
  const selectableIds = useMemo(
    () => rows.filter((row) => !row.is_member).map((row) => row.campaign_user_id),
    [rows],
  );
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selected.has(id));

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(selectableIds) : new Set());
  };
  const toggleOne = (id: number, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(group.share_url);
      toast.success("Link seguro copiado. Cole-o no chat da campanha.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const toggleConfig = (
    next: { auto_join_on_approval?: boolean; remove_on_campaign_exit?: boolean },
  ) => {
    if (!canWrite || configMutation.isPending) return;
    const a = next.auto_join_on_approval ?? autoJoin;
    const r = next.remove_on_campaign_exit ?? removeOnExit;
    setAutoJoin(a);
    setRemoveOnExit(r);
    configMutation.mutate({ auto: a, remove: r });
  };

  const submitPost = () => {
    if (postDraft.trim() && !postMutation.isPending) postMutation.mutate();
  };

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!selectAllRef.current) return;
    const n = selectableIds.filter((id) => selected.has(id)).length;
    selectAllRef.current.indeterminate = n > 0 && n < selectableIds.length;
  }, [selected, selectableIds]);

  const showCb = canWrite && selectableIds.length > 0;
  const total = participantsQuery.data?.meta.total ?? 0;
  const totalPages = participantsQuery.data?.meta.total_pages ?? 0;
  const joinedCount = group.members_count;
  const allTotal = totalQuery.data?.meta.total;
  const tabs: [string, string][] = [
    ["all", "Todos"],
    ["joined", "Incluídos"],
    ["pending", "Não incluídos"],
    ["failed", "Com falha"],
  ];
  const posts = postsQuery.data?.data ?? [];

  return (
    <div className="pv">
      <div className="mg" style={{ marginBottom: 20 }}>
        <div className="gwrap">
          <div className="gmain card gjm">
            <div className="gjh">
              <div>
                <h2>Participantes do grupo</h2>
                <p className="sub">Inclusão em lote e situação de cada pessoa</p>
              </div>
              <div className="gjp">
                <b>
                  {joinedCount}
                  {allTotal !== undefined && <span> de {allTotal}</span>}
                </b>
                {allTotal !== undefined && allTotal > 0 && (
                  <div className="cc-trk">
                    <i
                      style={
                        {
                          "--w": `${Math.min(100, Math.round((joinedCount / allTotal) * 100))}%`,
                          "--i": 0,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="gtools gjt">
              <div className="gtabs" id="gtabs">
                {tabs.map(([k, l]) => (
                  <button
                    key={k}
                    className={status === k ? "on" : ""}
                    onClick={() => setStatus(k)}
                  >
                    {l}
                    {status === k && participantsQuery.data && (
                      <em>{total}</em>
                    )}
                  </button>
                ))}
              </div>
              <div className="ctr-tools">
                <label className={`find mini ${search ? "has" : ""}`}>
                  <I n="search" cls="sm" />
                  <input
                    placeholder="Buscar"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    autoComplete="off"
                  />
                </label>
              </div>
            </div>
            <div className="gscroll">
              {participantsQuery.isLoading ? (
                <div className="empty">
                  <span className="ei">
                    <I n="users" />
                  </span>
                  <b>Carregando participantes…</b>
                </div>
              ) : participantsQuery.error ? (
                <div className="empty">
                  <span className="ei">
                    <I n="users" />
                  </span>
                  <b>Não foi possível carregar</b>
                  <p>{(participantsQuery.error as Error).message}</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="empty">
                  <span className="ei">
                    <I n="users" />
                  </span>
                  <b>Ninguém por aqui</b>
                  <p>Nenhum participante com este filtro.</p>
                </div>
              ) : (
                <>
                  <div className={`crh ${showCb ? "" : "nocb"}`}>
                    <span className="crc">
                      {showCb && (
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          aria-label="Selecionar todos"
                          checked={allSelected}
                          onChange={(event) => toggleAll(event.target.checked)}
                        />
                      )}
                    </span>
                    <span></span>
                    <span>Participante</span>
                    <span>Status</span>
                    <span className="r">Ação</span>
                  </div>
                  <div className={`ctlist gt ${showCb ? "" : "nocb"}`}>
                    {rows.map((row) => {
                      const st = row.is_member
                        ? "joined"
                        : row.sync_status === "failed"
                          ? "failed"
                          : "pending";
                      const attempts = row.sync_attempts ?? 0;
                      return (
                        <div
                          key={row.campaign_user_id}
                          className={`cr ctt ${selected.has(row.campaign_user_id) ? "on" : ""}`}
                        >
                          <span className="crc">
                            {!row.is_member && canWrite && (
                              <input
                                type="checkbox"
                                aria-label={`Selecionar ${row.name}`}
                                checked={selected.has(row.campaign_user_id)}
                                onChange={(event) =>
                                  toggleOne(
                                    row.campaign_user_id,
                                    event.target.checked,
                                  )
                                }
                              />
                            )}
                          </span>
                          <Av name={row.name} size={44} />
                          <div className="crm">
                            <b>
                              <span>{row.name}</span>
                            </b>
                            <small title={row.sync_error ?? undefined}>
                              {st === "failed" && attempts > 0
                                ? `${attempts} tentativa${attempts > 1 ? "s" : ""} sem sucesso`
                                : row.email}
                            </small>
                          </div>
                          <span className={`gs g-${st}`}>
                            <i></i>
                            {st === "failed"
                              ? "Falhou"
                              : st === "joined"
                                ? "Incluído"
                                : "Não incluído"}
                          </span>
                          <span className="cra">
                            {!row.is_member && canWrite && (
                              <button
                                className="gact"
                                disabled={bulkMutation.isPending}
                                onClick={() =>
                                  bulkMutation.mutate([row.campaign_user_id])
                                }
                              >
                                {st === "failed" ? "Tentar de novo" : "Incluir"}
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    paddingTop: 14,
                  }}
                >
                  <small style={{ color: "var(--muted)" }}>
                    Página {page} de {totalPages} · {total} participante(s)
                  </small>
                  <span style={{ display: "flex", gap: 6 }}>
                    <button
                      className="lnk"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </button>
                    <button
                      className="lnk"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                    </button>
                  </span>
                </div>
              )}
            </div>
            <div id="gbar">
              {selected.size > 0 && (
                <div className="gbar">
                  <span className="gbc">{selected.size}</span>
                  <b>selecionado{selected.size > 1 ? "s" : ""}</b>
                  <span style={{ flex: 1 }}></span>
                  <button className="lnk" onClick={() => setSelected(new Set())}>
                    Limpar
                  </button>
                  <button
                    className="gbtn"
                    disabled={bulkMutation.isPending}
                    onClick={() => bulkMutation.mutate([...selected])}
                  >
                    <I n="plus" cls="sm" />
                    {bulkMutation.isPending ? "Adicionando…" : "Incluir no grupo"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="side2 fade">
          <div className="s2-top">
            <small>Grupo privado da campanha</small>
            {group.cover_url && (
              <img
                src={getUploadUrl(group.cover_url)}
                alt=""
                style={{
                  display: "block",
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  objectFit: "cover",
                  marginTop: 10,
                }}
              />
            )}
            <h3 className="gname">{group.name}</h3>
            {group.description && (
              <p className="s2-s" style={{ marginTop: 6 }}>
                {group.description}
              </p>
            )}
            <p className="s2-s" style={{ marginTop: 6 }}>
              {group.members_count} participante(s) no grupo
            </p>
            {canWrite && (
              <>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={handleCoverSelect}
                />
                <button
                  className="gact"
                  style={{ marginTop: 10 }}
                  disabled={coverMutation.isPending}
                  onClick={() => coverInputRef.current?.click()}
                >
                  {coverMutation.isPending
                    ? "Enviando..."
                    : group.cover_url
                      ? "Alterar capa"
                      : "Adicionar capa"}
                </button>
              </>
            )}
          </div>

          <section className="s2">
            <div className="sw">
              <div>
                <b>Entrada automática</b>
                <small>
                  Quem for aprovado entra sozinho no grupo. A aprovação não
                  falha se o grupo estiver indisponível.
                </small>
              </div>
              <button
                className={`tgl ${autoJoin ? "on" : ""}`}
                role="switch"
                aria-checked={autoJoin}
                aria-label="Entrada automática"
                disabled={!canWrite}
                onClick={() => toggleConfig({ auto_join_on_approval: !autoJoin })}
              >
                <i></i>
              </button>
            </div>
          </section>

          <section className="s2">
            <div className="sw">
              <div>
                <b>Remover ao sair da campanha</b>
                <small>Mantém o participante no grupo quando desligado.</small>
              </div>
              <button
                className={`tgl ${removeOnExit ? "on" : ""}`}
                role="switch"
                aria-checked={removeOnExit}
                aria-label="Remover ao sair da campanha"
                disabled={!canWrite}
                onClick={() =>
                  toggleConfig({ remove_on_campaign_exit: !removeOnExit })
                }
              >
                <i></i>
              </button>
            </div>
          </section>

          <section className="s2">
            <h3>Link do grupo</h3>
            <div className="lkb">
              <span>{group.share_url}</span>
              <button className="round" onClick={copyLink} aria-label="Copiar link">
                <I n="copy" cls="sm" />
              </button>
            </div>
          </section>

          <section className="s2">
            <h3>{canWrite ? "Publicar no grupo" : "Publicações"}</h3>
            {canWrite && (
              <>
                <textarea
                  className="gpt"
                  maxLength={2000}
                  value={postDraft}
                  onChange={(event) => setPostDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      submitPost();
                    }
                  }}
                  placeholder="Mensagem, aviso ou link HTTPS para os participantes"
                />
                <button
                  className="btn"
                  disabled={postMutation.isPending || postDraft.trim().length === 0}
                  onClick={submitPost}
                >
                  {postMutation.isPending ? "Publicando…" : "Publicar"}
                </button>
              </>
            )}
            <div className="gposts">
              {postsQuery.isLoading ? (
                <div className="gp">
                  <small>Carregando publicações…</small>
                </div>
              ) : postsQuery.error ? (
                <div className="gp">
                  <small>{(postsQuery.error as Error).message}</small>
                </div>
              ) : posts.length === 0 ? (
                <div className="gp">
                  <small>Nenhuma publicação enviada a este grupo ainda.</small>
                </div>
              ) : (
                posts.map((post) => (
                  <div className="gp" key={post.id}>
                    <p style={{ whiteSpace: "pre-wrap" }}>{post.content}</p>
                    <small>
                      {post.author_name} · {formatPostDate(post.created_at)}
                      {post.origin === "backoffice" ? " · Backoffice" : ""}
                    </small>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Data + hora da publicação (pt-BR). */
function formatPostDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

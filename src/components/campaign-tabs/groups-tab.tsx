import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

  const createForm = (
    <form
      className="gnew-f"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label>
        <span>Nome</span>
        <input
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Creators da campanha"
          autoComplete="off"
        />
      </label>
      <label>
        <span>Descrição</span>
        <textarea
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Objetivo e regras essenciais do grupo"
        />
      </label>
      <button
        type="submit"
        className="btn"
        disabled={createMutation.isPending || name.trim().length < 2 || description.trim().length < 2}
      >
        {createMutation.isPending ? "Criando…" : "Criar e vincular"}
      </button>
    </form>
  );

  return (
    <>
      {groups.length === 0 ? (
        <div className="pv">
          <section className={`gnew ${canWrite ? "" : "solo"}`}>
            <div className="gnew-i">
              <span className="ei">
                <I n="users" />
              </span>
              <b>Nenhum grupo vinculado</b>
              <p>Crie um grupo privado para reunir os participantes desta campanha.</p>
            </div>
            {canWrite && createForm}
          </section>
        </div>
      ) : (
        <>
          {groups.map((group) => (
            <CampaignGroupPanel
              key={group.id}
              campaignId={campaignId}
              group={group}
              canWrite={canWrite}
            />
          ))}
          {canWrite && (
            <div className="pv">
              <section className="gnew more">
                <div className="gnew-i">
                  <b>Criar novo grupo</b>
                  <p>Outro grupo privado vinculado a esta campanha.</p>
                </div>
                {createForm}
              </section>
            </div>
          )}
        </>
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
  // Participantes abrem por um botão dentro do cartão; o menu "⋯" guarda a configuração do convite.
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
      listCampaignGroupPosts(campaignId, group.id, { page: 1, per_page: 40 }),
    // O chat se atualiza sozinho enquanto a aba está aberta.
    refetchInterval: 15_000,
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
  // A API devolve do mais novo para o mais antigo; o chat lê de cima para baixo, com a última mensagem embaixo.
  const chat = useMemo(
    () => [...posts].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [posts],
  );
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [chat.length]);
  const openAdd = () => {
    setStatus("pending");
    setOpen(true);
  };

  const initials = group.name;
  return (
    <div className="pv">
      <div className="gcm">
        <div className="gcm-l">
          <section className="gcard">
            <div className="gcard-top">
              <span className="gcard-lg">
                {group.cover_url ? <img src={getUploadUrl(group.cover_url)} alt="" /> : <Av name={initials} size={56} />}
              </span>
              <div className="gcard-id">
                <h3 title={group.name}>{group.name}</h3>
                <small>Grupo privado da campanha</small>
              </div>
              <div className={`cfw bcd-menu gcard-menu${menuOpen ? " open" : ""}`} ref={menuRef}>
                <button
                  type="button"
                  className="bcd-dots"
                  aria-label={`Configurar o grupo ${group.name}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <I n="more" />
                </button>
                {menuOpen ? (
                  <div className="cfm right gm" role="menu">
                    <p className="gm-h">Convite e entrada</p>
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={autoJoin}
                      className="gm-row"
                      disabled={!canWrite}
                      onClick={() => toggleConfig({ auto_join_on_approval: !autoJoin })}
                    >
                      <span>
                        <b>Entrada automática</b>
                        <small>Quem for aprovado entra sozinho. A aprovação não falha se o grupo estiver indisponível.</small>
                      </span>
                      <i className={`tgl${autoJoin ? " on" : ""}`} aria-hidden="true">
                        <i />
                      </i>
                    </button>
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={removeOnExit}
                      className="gm-row"
                      disabled={!canWrite}
                      onClick={() => toggleConfig({ remove_on_campaign_exit: !removeOnExit })}
                    >
                      <span>
                        <b>Remover ao sair da campanha</b>
                        <small>Desligado, mantém o participante no grupo.</small>
                      </span>
                      <i className={`tgl${removeOnExit ? " on" : ""}`} aria-hidden="true">
                        <i />
                      </i>
                    </button>
                    <hr />
                    <button
                      type="button"
                      role="menuitem"
                      className="gm-it"
                      onClick={() => {
                        setMenuOpen(false);
                        void copyLink();
                      }}
                    >
                      <I n="link" cls="sm" />
                      Copiar link do convite
                    </button>
                    {canWrite ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="gm-it"
                        disabled={coverMutation.isPending}
                        onClick={() => {
                          setMenuOpen(false);
                          coverInputRef.current?.click();
                        }}
                      >
                        <I n="image" cls="sm" />
                        {coverMutation.isPending ? "Enviando capa…" : group.cover_url ? "Alterar capa" : "Adicionar capa"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={handleCoverSelect}
            />
            {group.description ? <p className="gdesc">{group.description}</p> : null}

            <div className="gcard-act">
              <button
                type="button"
                className={`gview${open ? " on" : ""}`}
                aria-expanded={open}
                aria-controls={`gpart-${group.id}`}
                onClick={() => setOpen((v) => !v)}
              >
                <I n="users" cls="sm" />
                <span>{open ? "Ocultar lista" : "Ver participantes"}</span>
                <em>
                  {joinedCount}
                  {allTotal !== undefined ? ` de ${allTotal}` : ""}
                </em>
                <I n="chevdown" cls="sm" />
              </button>
              {canWrite ? (
                <button type="button" className="gadd" onClick={openAdd}>
                  <I n="plus" cls="sm" />
                  Adicionar
                </button>
              ) : null}
            </div>

            <div className={`gpart${open ? " open" : ""}`} id={`gpart-${group.id}`} inert={!open}>
              <div className="gpart-in">
                <div className="gp-tabs" role="tablist" aria-label="Situação dos participantes">
                  {tabs.map(([k, l]) => (
                    <button key={k} type="button" role="tab" aria-selected={status === k} className={status === k ? "on" : ""} onClick={() => setStatus(k)}>
                      {l}
                      {status === k && participantsQuery.data ? <em>{total}</em> : null}
                    </button>
                  ))}
                </div>
                <label className="gp-find">
                  <I n="search" cls="sm" />
                  <input
                    placeholder="Buscar participante"
                    aria-label="Buscar participante"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    autoComplete="off"
                  />
                </label>

                {participantsQuery.isLoading ? (
                  <p className="gp-empty">Carregando participantes…</p>
                ) : participantsQuery.error ? (
                  <p className="gp-empty">{(participantsQuery.error as Error).message}</p>
                ) : rows.length === 0 ? (
                  <p className="gp-empty">Nenhum participante com este filtro.</p>
                ) : (
                  <div className="ctlist gpl">
                    {showCb ? (
                      <label className="gpl-all">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          aria-label="Selecionar todos"
                          checked={allSelected}
                          onChange={(event) => toggleAll(event.target.checked)}
                        />
                        Selecionar todos os não incluídos
                      </label>
                    ) : null}
                    {rows.map((row) => {
                      const st = row.is_member ? "joined" : row.sync_status === "failed" ? "failed" : "pending";
                      const attempts = row.sync_attempts ?? 0;
                      return (
                        <div key={row.campaign_user_id} className={`gpr${selected.has(row.campaign_user_id) ? " on" : ""}`}>
                          <span className="gpr-c">
                            {!row.is_member && canWrite ? (
                              <input
                                type="checkbox"
                                aria-label={`Selecionar ${row.name}`}
                                checked={selected.has(row.campaign_user_id)}
                                onChange={(event) => toggleOne(row.campaign_user_id, event.target.checked)}
                              />
                            ) : null}
                          </span>
                          <Av name={row.name} size={36} />
                          <div className="gpr-m">
                            <b title={row.name}>{row.name}</b>
                            <small title={row.sync_error ?? row.email}>
                              {st === "failed" && attempts > 0 ? `${attempts} tentativa${attempts > 1 ? "s" : ""} sem sucesso` : row.email}
                            </small>
                          </div>
                          {st === "joined" ? (
                            <span className="gsp joined">
                              <i />
                              Incluído
                            </span>
                          ) : canWrite ? (
                            <button
                              type="button"
                              className="gpr-a"
                              disabled={bulkMutation.isPending}
                              aria-label={`${st === "failed" ? "Tentar de novo" : "Incluir"} ${row.name}`}
                              onClick={() => bulkMutation.mutate([row.campaign_user_id])}
                            >
                              <I n={st === "failed" ? "refresh" : "plus"} cls="sm" />
                              {st === "failed" ? "Tentar" : "Incluir"}
                            </button>
                          ) : (
                            <span className="gsp">{st === "failed" ? "Falhou" : "Não incluído"}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {totalPages > 1 ? (
                  <div className="gp-pg">
                    <small>
                      Página {page} de {totalPages} · {total}
                    </small>
                    <span>
                      <button type="button" className="lnk" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                        Anterior
                      </button>
                      <button type="button" className="lnk" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                        Próxima
                      </button>
                    </span>
                  </div>
                ) : null}

                {selected.size > 0 ? (
                  <div className="gp-bar">
                    <span className="gbc">{selected.size}</span>
                    <b>selecionado{selected.size > 1 ? "s" : ""}</b>
                    <span style={{ flex: 1 }} />
                    <button type="button" className="lnk" onClick={() => setSelected(new Set())}>
                      Limpar
                    </button>
                    <button type="button" className="gbtn" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate([...selected])}>
                      <I n="plus" cls="sm" />
                      {bulkMutation.isPending ? "Adicionando…" : "Incluir no grupo"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>

        <section className="gchat" aria-label={`Chat do grupo ${group.name}`}>
          <header className="gchat-h">
            <span className="gchat-lg">
              {group.cover_url ? <img src={getUploadUrl(group.cover_url)} alt="" /> : <Av name={initials} size={40} />}
            </span>
            <div>
              <b title={group.name}>{group.name}</b>
              <small>
                {group.members_count} participante{group.members_count === 1 ? "" : "s"} · o que você enviar chega a todos
              </small>
            </div>
          </header>

          <div className="gchat-feed" ref={feedRef} role="log" aria-live="polite" aria-label="Mensagens do grupo">
            {postsQuery.isLoading ? (
              <p className="gchat-st">Carregando mensagens…</p>
            ) : postsQuery.error ? (
              <p className="gchat-st">{(postsQuery.error as Error).message}</p>
            ) : chat.length === 0 ? (
              <div className="gchat-empty">
                <span>
                  <I n="msg" />
                </span>
                <b>Nenhuma mensagem ainda</b>
                <small>Avisos, regras e links que você enviar aqui chegam a todos os participantes do grupo.</small>
              </div>
            ) : (
              chat.map((post, i) => {
                const day = chatDay(post.created_at);
                const newDay = i === 0 || chatDay(chat[i - 1].created_at) !== day;
                return (
                  <div key={post.id} className="gmsg-w">
                    {newDay ? <p className="gday">{day}</p> : null}
                    <div className="gmsg">
                      <div className="gmsg-b">{renderChatContent(post.content)}</div>
                      <small title={formatPostDate(post.created_at)}>
                        {post.author_name} · {chatTime(post.created_at)}
                        {post.origin === "backoffice" ? " · Plataforma" : ""}
                      </small>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {canWrite ? (
            <form
              className="gchat-c"
              onSubmit={(event) => {
                event.preventDefault();
                submitPost();
              }}
            >
              <textarea
                rows={1}
                maxLength={2000}
                value={postDraft}
                aria-label="Mensagem para o grupo"
                placeholder="Escreva uma mensagem, aviso ou link HTTPS…"
                onChange={(event) => setPostDraft(event.target.value)}
                onInput={(event) => {
                  const el = event.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    submitPost();
                  }
                }}
              />
              <button type="submit" className="gsend" aria-label="Enviar mensagem" disabled={postMutation.isPending || postDraft.trim().length === 0}>
                <I n="send" cls="sm" />
              </button>
            </form>
          ) : (
            <p className="gchat-ro">Só quem gerencia a campanha envia mensagens ao grupo.</p>
          )}
        </section>
      </div>
    </div>
  );
}

const chatTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

/** "Hoje", "Ontem" ou a data, para separar os dias no chat. */
function chatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

/** Texto da mensagem com os links https clicáveis (abrem em outra aba, sem repassar a origem). */
function renderChatContent(text: string) {
  return text.split(/(https:\/\/[^\s<]+)/g).map((part, i) =>
    /^https:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
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

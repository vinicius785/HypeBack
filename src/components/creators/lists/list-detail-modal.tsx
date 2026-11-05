import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";

import { NET_ICON, NET_LABEL } from "@/components/creators/creator-accounts";
import { Av, I } from "@/components/prototype/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddToInfluencerList, useCreatorsCatalog, useRemoveFromInfluencerList } from "@/hooks/use-creators-catalog";
import { useInfluencerAccountsMap } from "@/hooks/use-influencer-accounts";
import { useInfluencerList, useInfluencerListReach } from "@/hooks/use-influencer-lists";
import type { InfluencerList } from "@/shared/services/influencer-lists";
import { groupCreators } from "@/shared/utils/group-creators";
import "@/styles/creator-lists.css";

import { ListIndicators } from "./list-indicators";
import {
  MEMBER_SORTS,
  countLabel,
  fmtCompact,
  filterAndSortMembers,
  listDateLabel,
  memberStats,
  type MemberSort,
} from "./list-format";

/** Abaixo disto a lista é curta: busca e ordenação só atrapalhariam. */
const TOOLS_MIN = 5;

interface Props {
  list: InfluencerList;
  canWrite: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export function ListDetailModal({ list, canWrite, onClose, onEdit }: Props) {
  const navigate = useNavigate();
  const detail = useInfluencerList(list.id);
  const removeMutation = useRemoveFromInfluencerList();
  const members = useMemo(() => detail.data?.influencers ?? [], [detail.data]);
  const total = detail.data?.influencers_total ?? members.length;
  const reach = useInfluencerListReach(list.id, total);

  const { map: accounts, loading: accountsLoading } = useInfluencerAccountsMap(members.map((m) => m.id));
  const stats = useMemo(() => new Map(members.map((m) => [m.id, memberStats(accounts.get(m.id))])), [members, accounts]);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MemberSort>("added");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handles = (m: { id: number }) => (accounts.get(m.id) ?? []).map((p) => p.username);
  const rows = filterAndSortMembers(members, stats, query, sort, handles);
  const showTools = members.length >= TOOLS_MIN;
  const date = listDateLabel(list);

  const remove = async (userId: number) => {
    try {
      await removeMutation.mutateAsync({ listId: list.id, userId });
    } finally {
      setRemovingId(null);
    }
  };

  return createPortal(
    <div className="pv">
      <div className="ovb on" onClick={onClose} />
      <div className="ovw">
        <section className="ovd on lmd" role="dialog" aria-label={`Lista ${list.name}`}>
          <header className="lst-h">
            <div className="lst-ht">
              <h2 title={list.name}>{list.name}</h2>
              {list.description ? <p>{list.description}</p> : null}
              <span className="lst-meta">
                <b>{countLabel(total)}</b>
                {date ? ` · ${date}` : ""}
              </span>
            </div>
            <div className="lst-ha">
              {canWrite && (
                <button type="button" className="btn out" onClick={onEdit}>
                  <I n="notepad" cls="sm" />
                  Editar
                </button>
              )}
              <button type="button" className="round" aria-label="Fechar" onClick={onClose}>
                <I n="x" cls="sm" />
              </button>
            </div>
          </header>

          <div className="lst-body">
            {detail.isLoading ? (
              <div className="lst-load" aria-busy="true">
                <div className="lst-kpis">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-[64px] w-full rounded-2xl" />
                  ))}
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : detail.isError ? (
              <div className="lst-empty" role="alert">
                <span>
                  <I n="alert" />
                </span>
                <b>Não foi possível carregar esta lista</b>
                <small>Confira a conexão e tente de novo.</small>
                <button type="button" className="btn out" onClick={() => detail.refetch()}>
                  Tentar de novo
                </button>
              </div>
            ) : (
              <>
                {members.length > 0 && (
                  <ListIndicators
                    data={reach.data}
                    creators={total}
                    isLoading={reach.isLoading}
                    isError={reach.isError}
                    onRetry={() => reach.refetch()}
                  />
                )}

                <div className="lst-sh">
                  <h3>
                    Criadores
                    <em>{total}</em>
                  </h3>
                  {canWrite && (
                    <button type="button" className={`btn out${adding ? " on" : ""}`} aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
                      <I n={adding ? "x" : "plus"} cls="sm" />
                      {adding ? "Fechar" : "Adicionar criadores"}
                    </button>
                  )}
                </div>

                {showTools && (
                  <div className="lst-tools">
                    <label className="lst-q">
                      <I n="search" cls="sm" />
                      <input
                        type="search"
                        aria-label="Buscar na lista"
                        placeholder="Buscar por nome ou @"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")}>
                          <I n="x" cls="sm" />
                        </button>
                      )}
                    </label>
                    <label className="lst-s">
                      <span className="sr-only">Ordenar por</span>
                      <select value={sort} onChange={(e) => setSort(e.target.value as MemberSort)}>
                        {MEMBER_SORTS.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {adding && canWrite && <AddCreators listId={list.id} memberIds={new Set(members.map((m) => m.id))} />}

                {members.length === 0 ? (
                  !adding && (
                    <div className="lst-empty">
                      <span>
                        <I n="user" />
                      </span>
                      <b>Esta lista ainda não tem criadores</b>
                      <small>Adicione por aqui ou use o coração nos cartões do catálogo.</small>
                      {canWrite && (
                        <button type="button" className="btn" onClick={() => setAdding(true)}>
                          <I n="plus" cls="sm" />
                          Adicionar criadores
                        </button>
                      )}
                    </div>
                  )
                ) : rows.length === 0 ? (
                  <div className="lst-empty small">
                    <b>Nenhum criador encontrado</b>
                    <small>Nada na lista combina com “{query}”.</small>
                    <button type="button" className="btn out" onClick={() => setQuery("")}>
                      Limpar busca
                    </button>
                  </div>
                ) : (
                  <ul className="lst-rows" aria-label="Criadores da lista">
                    {rows.map((m) => {
                      const st = stats.get(m.id);
                      const primary = st?.primary;
                      const confirming = removingId === m.id;
                      return (
                        <li key={m.id} className={`lst-row${confirming ? " rm" : ""}`}>
                          <Av name={m.name} src={m.photo ?? undefined} size={40} />
                          <div className="lst-id">
                            <b title={m.name}>{m.name}</b>
                            {primary ? (
                              <span>@{primary.username}</span>
                            ) : accountsLoading && !accounts.get(m.id) ? (
                              <span className="mute">carregando…</span>
                            ) : (
                              <span className="mute">{m.email || "Sem redes sociais"}</span>
                            )}
                          </div>
                          <span className="lst-net" title={primary ? (NET_LABEL[primary.type.toLowerCase()] ?? primary.type_label ?? primary.type) : undefined}>
                            {primary ? (
                              <>
                                <I n={NET_ICON[primary.type.toLowerCase()] ?? "video"} cls="sm" />
                                <span className="sr-only">{NET_LABEL[primary.type.toLowerCase()] ?? primary.type_label ?? primary.type}</span>
                                {st && st.networks.length > 1 ? <em>+{st.networks.length - 1}</em> : null}
                              </>
                            ) : null}
                          </span>
                          <span className="lst-fol" title="Seguidores somados nas redes sociais">
                            {st && st.followers > 0 ? (
                              <>
                                <b>{fmtCompact(st.followers)}</b>
                                <small>seguidores</small>
                              </>
                            ) : (
                              <span className="mute">—</span>
                            )}
                          </span>
                          {confirming ? (
                            <div className="lst-rmq" role="group" aria-label={`Remover ${m.name} da lista`}>
                              <span>Remover da lista?</span>
                              <button type="button" className="btn out" onClick={() => setRemovingId(null)}>
                                Cancelar
                              </button>
                              <button type="button" className="btn dng lst-del" disabled={removeMutation.isPending} onClick={() => remove(m.id)}>
                                {removeMutation.isPending ? "Removendo…" : "Remover"}
                              </button>
                            </div>
                          ) : (
                            <div className="lst-act">
                              <button
                                type="button"
                                className="lst-ib"
                                aria-label={`Ver perfil de ${m.name}`}
                                title="Ver perfil"
                                onClick={() => navigate({ to: "/influencer/$influencerId", params: { influencerId: String(m.id) } })}
                              >
                                <I n="external" cls="sm" />
                              </button>
                              {canWrite && (
                                <button type="button" className="lst-ib dng" aria-label={`Remover ${m.name} da lista`} title="Remover da lista" onClick={() => setRemovingId(m.id)}>
                                  <I n="trash" cls="sm" />
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {total > members.length && (
                  <p className="lst-foot center">
                    Mostrando os primeiros {members.length} de {total} criadores.
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

/** Busca no catálogo (mesma fonte da aba Explorar) e adiciona à lista sem sair do modal. */
function AddCreators({ listId, memberIds }: { listId: string; memberIds: Set<number> }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <section className="lst-add" aria-label="Adicionar criadores">
      <label className="lst-q">
        <I n="search" cls="sm" />
        <input autoFocus type="search" aria-label="Buscar criador no catálogo" placeholder="Buscar no catálogo por nome ou @" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {q.length >= 2 ? (
        <AddResults listId={listId} q={q} memberIds={memberIds} />
      ) : (
        <small className="lst-hint">Digite ao menos 2 letras para buscar criadores do catálogo.</small>
      )}
    </section>
  );
}

function AddResults({ listId, q, memberIds }: { listId: string; q: string; memberIds: Set<number> }) {
  const { data, isLoading, isError } = useCreatorsCatalog({ q, per_page: 12 });
  const addMutation = useAddToInfluencerList();
  const [busyId, setBusyId] = useState<number | null>(null);
  const groups = useMemo(() => groupCreators(data?.pages.flatMap((p) => p.items) ?? []).slice(0, 8), [data]);

  if (isLoading) return <Skeleton className="h-28 w-full rounded-2xl" />;
  if (isError) return <small className="lst-hint">Não foi possível buscar agora. Tente de novo.</small>;
  if (groups.length === 0) return <small className="lst-hint">Nenhum criador encontrado para “{q}”.</small>;

  return (
    <ul className="lst-res">
      {groups.map((g) => {
        const inList = memberIds.has(g.user.id);
        const acc = g.accounts[0]?.social_network;
        return (
          <li key={g.key}>
            <Av name={g.user.name} src={g.user.photo ?? acc?.photo ?? undefined} size={32} />
            <div>
              <b>{g.user.name}</b>
              {acc && <span>@{acc.username}</span>}
            </div>
            {inList ? (
              <span className="lst-in">
                <I n="check" cls="sm" />
                Na lista
              </span>
            ) : (
              <button
                type="button"
                className="btn out"
                disabled={busyId === g.user.id}
                onClick={async () => {
                  setBusyId(g.user.id);
                  try {
                    await addMutation.mutateAsync({ listId, userId: g.user.id });
                  } finally {
                    setBusyId(null);
                  }
                }}
              >
                {busyId === g.user.id ? "Adicionando…" : "Adicionar"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

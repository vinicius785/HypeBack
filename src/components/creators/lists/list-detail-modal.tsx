import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";

import { NET_ICON, NET_LABEL } from "@/components/creators/creator-accounts";
import { Av, I } from "@/components/prototype/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { CreatorCard } from "@/components/creators/creator-card";
import type { CreatorGroup } from "@/shared/utils/group-creators";
import { CampaignPickerModal } from "@/components/influencer-lists/campaign-picker-modal";
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
  const [bulkInvite, setBulkInvite] = useState(false);
  const [inviteFor, setInviteFor] = useState<{ id: number; name: string; photo: string | null } | null>(null);

  useEffect(() => {
    // Com o convite aberto, o Esc fecha só o convite (ele tem o próprio tratamento).
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !inviteFor && !bulkInvite && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, inviteFor, bulkInvite]);

  const handles = (m: { id: number }) => (accounts.get(m.id) ?? []).map((p) => p.username);
  const rows = filterAndSortMembers(members, stats, query, sort, handles);
  const socialOf = (id: number) =>
    (accounts.get(id) ?? [])
      .filter((p) => p.type.toLowerCase() !== "ugc")
      .sort((a, b) => (b.members || 0) - (a.members || 0));
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
                </div>

                <div className="lst-tools">
                  {showTools && (
                    <>
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
                      <SortMenu value={sort} onChange={setSort} />
                    </>
                  )}
                  <div className="lst-tr">
                    {canWrite && (
                      <button type="button" className={`lst-add-b${adding ? " on" : ""}`} aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
                        <I n={adding ? "x" : "plus"} cls="sm" />
                        <span>{adding ? "Fechar" : "Adicionar criadores"}</span>
                      </button>
                    )}
                    <button type="button" className="lst-bulk" onClick={() => setBulkInvite(true)} disabled={rows.length === 0}>
                      <I n="send" cls="sm" />
                      <span>Convidar</span>
                    </button>
                  </div>
                </div>

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
                  <ul className="crg lst-cards" aria-label="Criadores da lista">
                    {rows.map((m, k) => {
                      const confirming = removingId === m.id;
                      const group: CreatorGroup = {
                        key: String(m.id),
                        user: { id: m.id, name: m.name, photo: m.photo ?? null, gender: null },
                        accounts: [],
                        niches: [],
                        distance_km: null,
                      };
                      return (
                        <li key={m.id}>
                          <CreatorCard
                            group={group}
                            k={k}
                            selected={false}
                            near={false}
                            saved
                            onOpen={() => navigate({ to: "/influencer/$influencerId", params: { influencerId: String(m.id) } })}
                            onInvite={() => setInviteFor({ id: m.id, name: m.name, photo: m.photo ?? null })}
                            onSave={canWrite ? () => setRemovingId(m.id) : undefined}
                            overlay={
                              confirming ? (
                                <div className="lst-cov" role="group" aria-label={`Remover ${m.name} da lista`}>
                                  <b>Remover da lista?</b>
                                  <small>{m.name} sai de “{list.name}”.</small>
                                  <div>
                                    <button type="button" className="btn out" onClick={() => setRemovingId(null)}>
                                      Cancelar
                                    </button>
                                    <button type="button" className="btn dng" disabled={removeMutation.isPending} onClick={() => remove(m.id)}>
                                      {removeMutation.isPending ? "Removendo…" : "Remover"}
                                    </button>
                                  </div>
                                </div>
                              ) : null
                            }
                          />
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
      {bulkInvite && (
        <CampaignPickerModal
          mode="invite"
          influencerId="bulk"
          influencerName={`${rows.length} criadores`}
          bulk={{ creators: rows.map((m) => ({ id: m.id, name: m.name, photo: m.photo ?? null })) }}
          onClose={() => setBulkInvite(false)}
        />
      )}
      {inviteFor && (
        <CampaignPickerModal
          mode="invite"
          influencerId={String(inviteFor.id)}
          influencerName={inviteFor.name}
          influencerPhoto={inviteFor.photo}
          networks={{
            userId: inviteFor.id,
            known: socialOf(inviteFor.id).map((p) => ({
              id: p.id,
              type: p.type.toLowerCase(),
              label: NET_LABEL[p.type.toLowerCase()] ?? p.type_label ?? p.type,
              username: p.username,
              members: p.members,
            })),
          }}
          onClose={() => setInviteFor(null)}
        />
      )}
    </div>,
    document.body,
  );
}

/** Ordenação em um botão de ícone com menu (no lugar do select). */
function SortMenu({ value, onChange }: { value: MemberSort; onChange: (v: MemberSort) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return (
    <div className="lst-sort" ref={ref}>
      <button
        type="button"
        className={`lst-sb${open ? " on" : ""}`}
        aria-label="Ordenar"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Ordenar: ${MEMBER_SORTS.find(([v]) => v === value)?.[1]}`}
        onClick={() => setOpen((v) => !v)}
      >
        <I n="sort" cls="sm" />
      </button>
      {open && (
        <div className="lst-sm" role="menu">
          {MEMBER_SORTS.map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="menuitemradio"
              aria-checked={v === value}
              className={v === value ? "on" : ""}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
            >
              {l}
              {v === value ? <I n="check" cls="sm" /> : null}
            </button>
          ))}
        </div>
      )}
    </div>
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

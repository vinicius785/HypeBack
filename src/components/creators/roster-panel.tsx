import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PageControls, PageToolbar, SearchInput, SelectControl, SortControl } from "@/components/page/page-kit";
import { I, Av } from "@/components/prototype/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspacePermissions } from "@/contexts/workspace-context";
import { rosterErrorMessage, useAgencyRoster, useRemoveFromRoster, useSetRosterExclusive } from "@/hooks/use-agency-roster";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import type { RosterMember } from "@/shared/services/agency-roster";

import "@/styles/agency-roster.css";

/** Filtro de situação dentro do elenco: todos, quem já aceitou e os convites que ainda esperam resposta. */
export type RosterStatus = "all" | "active" | "invited";
type Sort = "pending" | "recent" | "followers" | "name";

const SORTS: [Sort, string][] = [
  ["pending", "Pendentes primeiro"],
  ["recent", "Mais recentes"],
  ["followers", "Mais seguidores"],
  ["name", "Nome (A–Z)"],
];

const NET_ICON: Record<string, string> = { instagram: "instagram", tiktok: "tiktok", youtube: "youtube" };

const fmtFollowers = (n: number) => n.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** No elenco: quando aceitou; convite: quando foi enviado. */
const memberDate = (m: RosterMember) => (m.status === "active" ? (m.responded_at ?? m.invited_at) : m.invited_at);
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
};

const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function MemberRow({
  member,
  canWrite,
  busy,
  confirming,
  onToggleExclusive,
  onAskRemove,
  onCancelRemove,
  onRemove,
}: {
  member: RosterMember;
  canWrite: boolean;
  busy: boolean;
  confirming: boolean;
  onToggleExclusive: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
}) {
  const c = member.creator;
  const active = member.status === "active";
  const date = fmtDate(memberDate(member));
  const dateLabel = date ? `${active ? "Desde" : "Convidado em"} ${date}` : "";

  if (confirming) {
    return (
      <li className="rst-row cf">
        <Av name={c.name} src={c.photo ?? undefined} size={44} />
        <div className="rst-cf">
          <p role="alert">
            {active ? `Tirar ${c.name} do elenco? Ele volta a aparecer para outros workspaces.` : `Cancelar o convite para ${c.name}?`}
          </p>
          <div className="rst-cfb">
            <button type="button" className="btn out" onClick={onCancelRemove} disabled={busy}>
              Voltar
            </button>
            <button type="button" className="btn out dng" onClick={onRemove} disabled={busy}>
              {active ? "Confirmar remoção" : "Cancelar convite"}
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="rst-row">
      <span className="rst-av">
        <Av name={c.name} src={c.photo ?? undefined} size={44} />
      </span>
      <div className="rst-id">
        <b title={c.name}>{c.name}</b>
        <small>{c.username ? `@${c.username}` : "Sem usuário"}</small>
        {dateLabel ? <small className="rst-dm">{dateLabel}</small> : null}
      </div>
      <div className="rst-nt">
        {c.networks.length > 0 ? (
          <ul aria-label="Redes sociais">
            {c.networks.map((n) => (
              <li key={`${n.type}-${n.username}`} title={`${getNetworkLabel(n.type, n.type)} · @${n.username}`}>
                <I n={NET_ICON[n.type.toLowerCase()] ?? "video"} cls="sm" />
                <span className="sr-only">{getNetworkLabel(n.type, n.type)}</span>
                <small className={n.members > 0 ? undefined : "z"}>{n.members > 0 ? fmtFollowers(n.members) : "—"}</small>
              </li>
            ))}
          </ul>
        ) : (
          <span className="rst-no">Sem redes conectadas</span>
        )}
      </div>
      <div className="rst-fl" title="Seguidores somados nas redes">
        {c.followers_total > 0 ? (
          <>
            <b>{fmtFollowers(c.followers_total)}</b>
            <small>seguidores</small>
          </>
        ) : (
          <b className="rst-nil">—</b>
        )}
      </div>
      <div className="rst-dt">
        {date ? (
          <>
            <small>{active ? "Desde" : "Convidado em"}</small>
            <b>{date}</b>
          </>
        ) : null}
      </div>
      <div className="rst-ex">
        {active ? (
          <>
            <span>
              <b>{member.exclusive ? "Exclusivo da agência" : "Aberto a outros workspaces"}</b>
              <small>{member.exclusive ? "Só a sua agência vê e convida." : "Também aparece para outros workspaces."}</small>
            </span>
            {canWrite ? (
              <button
                type="button"
                role="switch"
                className="rst-sw"
                aria-checked={member.exclusive}
                aria-label={`Exclusividade de ${c.name}`}
                disabled={busy}
                onClick={onToggleExclusive}
              />
            ) : null}
          </>
        ) : (
          <span className="rst-pend">
            <i aria-hidden="true" />
            Aguardando resposta
          </span>
        )}
      </div>
      <div className="rst-ac">
        {canWrite ? (
          <button
            type="button"
            className="rst-ib"
            aria-label={active ? "Remover do elenco" : "Cancelar convite"}
            title={active ? "Remover do elenco" : "Cancelar convite"}
            disabled={busy}
            onClick={onAskRemove}
          >
            <I n="trash" cls="sm" />
          </button>
        ) : null}
      </div>
    </li>
  );
}


interface RosterPanelProps {
  /** Subaba escolhida em "Meu elenco" (as subabas ficam ao lado da aba, no cabeçalho da página). */
  status: RosterStatus;
  onStatusChange: (s: RosterStatus) => void;
  /** As abas da página (Todos, No elenco, Convites, Favoritos): ficam acima da barra, como em todos os recortes. */
  tabs: ReactNode;
  onFindCreators: () => void;
}

/**
 * Elenco dentro de Criadores: "No elenco" (quem aceitou, com exclusividade e remoção) e "Convites" (enviados e
 * aguardando resposta, com cancelamento). A barra de pesquisa, filtro de rede e ordenação é a mesma do catálogo.
 */
export function RosterPanel({ status, onStatusChange, tabs, onFindCreators }: RosterPanelProps) {
  const permissions = useWorkspacePermissions();
  const canWrite = permissions.influencers_invite;
  const { data: members = [], isLoading, error, refetch } = useAgencyRoster();
  const remove = useRemoveFromRoster();
  const setExclusive = useSetRosterExclusive();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [network, setNetwork] = useState("all");
  const [sort, setSort] = useState<Sort>("pending");

  const roster = useMemo(() => members.filter((m) => m.status === "active" || m.status === "invited"), [members]);
    const inTab = useMemo(() => (status === "all" ? roster : roster.filter((m) => m.status === status)), [roster, status]);
  const networks = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of inTab) for (const n of m.creator.networks) seen.set(n.type.toLowerCase(), getNetworkLabel(n.type, n.type));
    return [...seen.entries()];
  }, [inTab]);
  const shown = useMemo(() => {
    const q = norm(query.trim().replace(/^@/, ""));
    const rows = inTab.filter((m) => {
      if (network !== "all" && !m.creator.networks.some((n) => n.type.toLowerCase() === network)) return false;
      if (!q) return true;
      const c = m.creator;
      return [c.name, c.username ?? "", ...c.networks.map((n) => n.username)].some((t) => norm(t).includes(q));
    });
    return [...rows].sort((a, b) => {
      if (sort === "pending" && a.status !== b.status) return a.status === "invited" ? -1 : 1;
      if (sort === "followers") return b.creator.followers_total - a.creator.followers_total;
      if (sort === "name") return a.creator.name.localeCompare(b.creator.name, "pt-BR");
      return new Date(memberDate(b)).getTime() - new Date(memberDate(a)).getTime();
    });
  }, [inTab, network, query, sort]);
  const filtering = query.trim() !== "" || network !== "all";

  const onRemove = (m: RosterMember) =>
    remove.mutate(m.id, {
      onSuccess: () => {
        setConfirmId(null);
        toast.success(m.status === "active" ? "Criador removido do elenco" : "Convite cancelado");
      },
      onError: (e) => toast.error(rosterErrorMessage(e, "Não foi possível concluir.")),
    });

  const onToggle = (m: RosterMember) =>
    setExclusive.mutate(
      { rosterId: m.id, exclusive: !m.exclusive },
      {
        onSuccess: () => toast.success(m.exclusive ? "Criador aberto a outros workspaces" : "Criador exclusivo da agência"),
        onError: (e) => toast.error(rosterErrorMessage(e, "Não foi possível alterar a exclusividade.")),
      },
    );

  return (
    <>
      <PageControls>
        {tabs}
        {roster.length > 0 && (
          <PageToolbar>
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar criador por nome ou @" label="Buscar no elenco" />
            {networks.length > 1 && (
              <SelectControl label="Filtrar por rede social" value={network} onChange={(e) => setNetwork(e.target.value)}>
                <option value="all">Todas as redes</option>
                {networks.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </SelectControl>
            )}
            <SortControl options={SORTS} value={sort} onChange={setSort} />
          </PageToolbar>
        )}
      </PageControls>

      {isLoading ? (
        <div className="rst-list" aria-busy="true" aria-label="Carregando o elenco">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rst-sk">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-4 w-48 rounded-md" />
              <Skeleton className="ml-auto h-4 w-24 rounded-md" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rst-state" role="alert">
          <span className="rst-si">
            <I n="alert" />
          </span>
          <div>
            <b>Erro ao carregar o elenco</b>
            <p>{error instanceof Error ? error.message : "Tente novamente."}</p>
          </div>
          <button type="button" className="btn out" onClick={() => void refetch?.()}>
            Tentar de novo
          </button>
        </div>
      ) : roster.length === 0 ? (
        <div className="rst-state fade">
          <span className="rst-si">
            <I n="star" />
          </span>
          <div>
            <b>Seu elenco começa aqui</b>
            <p>Os criadores que você convidar passam a integrar o elenco quando aceitam o convite pelo app. Até lá, o convite fica aqui como pendente.</p>
          </div>
          <button type="button" className="btn" onClick={onFindCreators}>
            <I n="search" cls="sm" />
            Encontrar criadores
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="rst-state">
          <span className="rst-si">
            <I n="search" />
          </span>
          <div>
            <b>Nenhum criador encontrado</b>
            <p>{filtering ? "Ajuste a busca ou o filtro de rede para ver mais resultados." : "Nenhum criador nesta situação."}</p>
          </div>
          <button
            type="button"
            className="btn out"
            onClick={() => {
              setQuery("");
              setNetwork("all");
              onStatusChange("all");
            }}
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="rst-list fade">
          {status === "invited" && (
            <p className="rst-note">
              <I n="clock" cls="sm" />
              Eles entram no elenco quando aceitarem o convite pelo app.
            </p>
          )}
          <div className="rst-hd" aria-hidden="true">
            <span>Criador</span>
            <span>Redes</span>
            <span className="r">Seguidores</span>
            <span>Entrada</span>
            <span>Situação</span>
          </div>
          <ul aria-label="Meu elenco">
            {shown.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                canWrite={canWrite}
                busy={remove.isPending || setExclusive.isPending}
                confirming={confirmId === m.id}
                onToggleExclusive={() => onToggle(m)}
                onAskRemove={() => setConfirmId(m.id)}
                onCancelRemove={() => setConfirmId(null)}
                onRemove={() => onRemove(m)}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

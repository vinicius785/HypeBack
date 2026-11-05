import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { I, Av } from "@/components/prototype/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspacePermissions } from "@/contexts/workspace-context";
import { useIsAgencyWorkspace } from "@/hooks/use-agency-brands";
import { rosterErrorMessage, useAgencyRoster, useRemoveFromRoster, useSetRosterExclusive } from "@/hooks/use-agency-roster";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import type { RosterMember } from "@/shared/services/agency-roster";

import "@/styles/agency-roster.css";

export const Route = createFileRoute("/(private)/(app)/roster")({
  component: RosterPage,
});

type Tab = "active" | "invited";
type Sort = "recent" | "followers" | "name";

const SORTS: [Sort, string][] = [
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
                <small>{fmtFollowers(n.members)}</small>
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
      <div className="rst-dt">{dateLabel}</div>
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
          <span className="rst-pend">Aguardando resposta</span>
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

function RosterPage() {
  const isAgency = useIsAgencyWorkspace();
  const permissions = useWorkspacePermissions();
  const canWrite = permissions.influencers_invite;
  const navigate = useNavigate();
  const { data: members = [], isLoading, error, refetch } = useAgencyRoster();
  const remove = useRemoveFromRoster();
  const setExclusive = useSetRosterExclusive();
  const [tab, setTab] = useState<Tab>("active");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [network, setNetwork] = useState("all");
  const [sort, setSort] = useState<Sort>("recent");

  const active = useMemo(() => members.filter((m) => m.status === "active"), [members]);
  const invited = useMemo(() => members.filter((m) => m.status === "invited"), [members]);
  const inTab = tab === "active" ? active : invited;
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
      if (sort === "followers") return b.creator.followers_total - a.creator.followers_total;
      if (sort === "name") return a.creator.name.localeCompare(b.creator.name, "pt-BR");
      return new Date(memberDate(b)).getTime() - new Date(memberDate(a)).getTime();
    });
  }, [inTab, network, query, sort]);

  const wrap = (children: React.ReactNode) => (
    <div className="pv">
      <div className="wrap" style={{ maxWidth: "none" }}>
        {children}
      </div>
    </div>
  );

  if (!isAgency) {
    return wrap(
      <div className="ov-empty big">
        <span>
          <I n="lock" />
        </span>
        <b>O elenco é exclusivo de agências</b>
        <small>Este workspace não é de agência. Fale com a equipe Hype para ativar o acesso de agência.</small>
      </div>,
    );
  }

  const findCreators = () => void navigate({ to: "/creators" });
  const switchTab = (t: Tab) => {
    setTab(t);
    setConfirmId(null);
    setNetwork("all");
  };

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

  return wrap(
    <>
      <div className="head fade">
        <div>
          <h1>Elenco</h1>
          <p>Criadores que aceitaram fazer parte da sua agência. Por padrão, só vocês veem e convidam esses criadores.</p>
        </div>
        <div className="btns">
          <button type="button" className="btn" onClick={findCreators}>
            <I n="search" cls="sm" />
            Encontrar criadores
          </button>
        </div>
      </div>

      <div className="rst-bar fade">
        <div className="seg rst-tabs" role="tablist" aria-label="Estado do elenco">
          <button type="button" role="tab" aria-selected={tab === "active"} className={tab === "active" ? "on" : ""} onClick={() => switchTab("active")}>
            No elenco
            <em>{active.length}</em>
          </button>
          <button type="button" role="tab" aria-selected={tab === "invited"} className={tab === "invited" ? "on" : ""} onClick={() => switchTab("invited")}>
            Convites
            <em>{invited.length}</em>
          </button>
        </div>
        {inTab.length > 0 && (
          <div className="rst-tools">
            <label className="rst-q">
              <I n="search" cls="sm" />
              <input type="search" aria-label="Buscar no elenco" placeholder="Buscar por nome ou @" value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && (
                <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")}>
                  <I n="x" cls="sm" />
                </button>
              )}
            </label>
            {networks.length > 1 && (
              <label className="rst-s">
                <span className="sr-only">Filtrar por rede social</span>
                <select value={network} onChange={(e) => setNetwork(e.target.value)}>
                  <option value="all">Todas as redes</option>
                  {networks.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="rst-s">
              <span className="sr-only">Ordenar por</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

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
      ) : inTab.length === 0 ? (
        <div className="rst-state fade">
          <span className="rst-si">
            <I n="star" />
          </span>
          <div>
            <b>{tab === "active" ? "Seu elenco começa aqui" : "Nenhum convite pendente"}</b>
            <p>
              {tab === "active"
                ? "Os criadores que você convidar passam a integrar o elenco quando aceitam o convite pelo app."
                : "Os convites que você enviar aparecem aqui até o criador responder."}
            </p>
          </div>
          <button type="button" className="btn" onClick={findCreators}>
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
            <p>Ajuste a busca ou o filtro de rede para ver mais resultados.</p>
          </div>
          <button
            type="button"
            className="btn out"
            onClick={() => {
              setQuery("");
              setNetwork("all");
            }}
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="rst-list fade">
          {tab === "invited" && <p className="rst-note">Eles entram no elenco quando aceitarem o convite pelo app.</p>}
          <div className="rst-hd" aria-hidden="true">
            <span>Criador</span>
            <span>Redes</span>
            <span className="r">Seguidores</span>
            <span>{tab === "active" ? "No elenco" : "Convite"}</span>
            <span>{tab === "active" ? "Exclusividade" : "Situação"}</span>
          </div>
          <ul aria-label={tab === "active" ? "Criadores no elenco" : "Convites enviados"}>
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
    </>,
  );
}

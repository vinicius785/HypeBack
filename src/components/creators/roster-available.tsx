import { useMemo, useState, type ReactNode } from "react";

import { PageControls, PageToolbar, SearchInput } from "@/components/page/page-kit";
import { I, Av } from "@/components/prototype/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspacePermissions } from "@/contexts/workspace-context";
import { useAvailableCreators } from "@/hooks/use-agency-roster";
import { useDebounce } from "@/hooks/use-debounce";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import type { AvailableCreator } from "@/shared/services/agency-roster";

import { RosterInviteDialog, type RosterInviteCreator } from "./roster-invite-dialog";

import "@/styles/agency-roster.css";

const NET_ICON: Record<string, string> = { instagram: "instagram", tiktok: "tiktok", youtube: "youtube" };
const fmtFollowers = (n: number) => n.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtDate = (iso: string | null) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR") : "";
};

function AvailableCard({ creator, canInvite, onInvite }: { creator: AvailableCreator; canInvite: boolean; onInvite: () => void }) {
  const since = fmtDate(creator.available_since);
  return (
    <li className="rav-card">
      <div className="rav-top">
        <Av name={creator.name} src={creator.photo ?? undefined} size={52} />
        <div className="rav-id">
          <b title={creator.name}>{creator.name}</b>
          <small>{creator.username ? `@${creator.username}` : "Sem usuário"}</small>
        </div>
        <div className="rav-fl" title="Seguidores somados nas redes">
          {creator.followers_total > 0 ? (
            <>
              <b>{fmtFollowers(creator.followers_total)}</b>
              <small>seguidores</small>
            </>
          ) : (
            <b className="rst-nil">—</b>
          )}
        </div>
      </div>

      {creator.niches.length > 0 ? (
        <ul className="rav-nc" aria-label="Nichos">
          {creator.niches.map((niche) => (
            <li key={niche}>{niche}</li>
          ))}
        </ul>
      ) : null}

      {creator.networks.length > 0 ? (
        <div className="rst-nt">
          <ul aria-label="Redes sociais">
            {creator.networks.map((n) => (
              <li key={`${n.type}-${n.username}`} title={`${getNetworkLabel(n.type, n.type)} · @${n.username}`}>
                <I n={NET_ICON[n.type.toLowerCase()] ?? "video"} cls="sm" />
                <span className="sr-only">{getNetworkLabel(n.type, n.type)}</span>
                <small className={n.members > 0 ? undefined : "z"}>{n.members > 0 ? fmtFollowers(n.members) : "—"}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <span className="rst-no">Sem redes conectadas</span>
      )}

      <div className="rav-ft">
        <small>{since ? `Disponível desde ${since}` : "Disponível"}</small>
        {creator.invite ? (
          <span className="rst-pend">
            <i aria-hidden="true" />
            Convite enviado
          </span>
        ) : canInvite ? (
          <button type="button" className="btn" aria-label={`Convidar ${creator.name} para o elenco`} onClick={onInvite}>
            <I n="send" cls="sm" />
            Convidar
          </button>
        ) : null}
      </div>
    </li>
  );
}

/** "Querendo agência": criadores que marcaram que querem uma agência. O convite é o mesmo do elenco (comissão obrigatória). */
export function RosterAvailable({ tabs }: { tabs: ReactNode }) {
  const canInvite = !!useWorkspacePermissions().influencers_invite;
  const [query, setQuery] = useState("");
  const term = useDebounce(query, 400);
  const { data, isLoading, isFetching, isFetchingNextPage, error, refetch, fetchNextPage, hasNextPage } = useAvailableCreators(term);
  const [target, setTarget] = useState<RosterInviteCreator | null>(null);

  const creators = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
  const unavailable = !!data?.pages[0]?.unavailable;
  const total = data?.pages[0]?.meta.total ?? creators.length;
  const searching = term.trim() !== "";

  return (
    <>
      <PageControls>
        {tabs}
        <PageToolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar criador por nome ou @" label="Buscar criadores querendo agência" />
        </PageToolbar>
      </PageControls>

      {isLoading ? (
        <ul className="rav-grid" aria-busy="true" aria-label="Carregando criadores">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="rav-card">
              <Skeleton className="h-[52px] w-[52px] rounded-full" />
              <Skeleton className="h-4 w-40 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="rst-state" role="alert">
          <span className="rst-si">
            <I n="alert" />
          </span>
          <div>
            <b>Erro ao carregar os criadores</b>
            <p>{error instanceof Error ? error.message : "Tente novamente."}</p>
          </div>
          <button type="button" className="btn out" onClick={() => void refetch()}>
            Tentar de novo
          </button>
        </div>
      ) : unavailable ? (
        <div className="rst-state">
          <span className="rst-si">
            <I n="clock" />
          </span>
          <div>
            <b>Ainda não disponível</b>
            <p>A lista de criadores querendo agência ainda não está ativa. Volte em breve.</p>
          </div>
        </div>
      ) : creators.length === 0 ? (
        <div className="rst-state fade">
          <span className="rst-si">
            <I n="search" />
          </span>
          <div>
            <b>{searching ? "Nenhum criador encontrado" : "Ninguém querendo agência agora"}</b>
            <p>{searching ? "Tente outro nome ou @." : "Quando um criador marcar que quer uma agência, ele aparece aqui para você convidar."}</p>
          </div>
        </div>
      ) : (
        <div className="fade">
          <p className="rst-note">
            <I n="star" cls="sm" />
            {total === 1 ? "1 criador quer uma agência." : `${total.toLocaleString("pt-BR")} criadores querem uma agência.`} O convite leva a sua comissão; ele entra no elenco quando aceitar.
          </p>
          <ul className="rav-grid" aria-label="Criadores querendo agência" aria-busy={isFetching && !isFetchingNextPage ? true : undefined}>
            {creators.map((creator) => (
              <AvailableCard
                key={creator.user_id}
                creator={creator}
                canInvite={canInvite}
                onInvite={() => setTarget({ userId: creator.user_id, name: creator.name, username: creator.username, photo: creator.photo })}
              />
            ))}
          </ul>
          {hasNextPage ? (
            <div className="rav-more">
              <button type="button" className="btn out" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                {isFetchingNextPage ? "Carregando…" : "Carregar mais"}
              </button>
            </div>
          ) : null}
        </div>
      )}
      {target ? <RosterInviteDialog creator={target} onClose={() => setTarget(null)} /> : null}
    </>
  );
}

import { Av, I } from "@/components/prototype/ui";
import { SocialHandle } from "@/components/social-handle";
import { useInfluencerProfile } from "@/hooks/use-influencer-profile";
import type { ExtendedInfluencer } from "../management-kanban-config";

interface Props {
  inf: ExtendedInfluencer;
  /** Id usado pela API de perfil (o do usuário, não o da linha da campanha). */
  influencerId: string;
  onProfile: () => void;
  onChat: () => void;
}

const ratingFmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/**
 * Resumo do perfil do criador, à esquerda do painel: foto, nome, avaliação, nicho e localização, com os
 * atalhos para o chat e o perfil completo. Avaliação e localização vêm do perfil completo (carregado sob demanda); o resto já está no cartão.
 */
export function PanelProfile({ inf, influencerId, onProfile, onChat }: Props) {
  const { data } = useInfluencerProfile(influencerId, 1);
  const p = data?.influencer;
  const niche = p?.niche_name || inf.nicheName || null;
  const place =
    p?.location && typeof p.location === "object"
      ? [p.location.city, p.location.state].filter(Boolean).join(", ")
      : "";
  const hasRating = p?.rating != null;

  return (
    <aside className="mgp-prof" aria-label="Resumo do perfil">
      <div className="mgp-ptop">
        <div className="mgp-ph">
          <Av name={inf.name} src={p?.avatar || inf.avatar} size={100} />
        </div>
        <div className="mgp-pid">
          <div className="mgp-pn">
            <strong>{inf.name}</strong>
            {inf.isExternal ? <em className="ext">Externo</em> : null}
          </div>
          <p className="mgp-pu" title={inf.username ? `@${inf.username}` : undefined}>
            {inf.username ? <SocialHandle username={inf.username} network={inf.socialNetwork ?? inf.social_networks?.[0]?.type} /> : "Sem usuário"}
          </p>
        </div>
      </div>
      <ul className="mgp-pc" aria-label="Destaques do perfil">
        <li className={hasRating ? "rt" : "rt none"}>
          <I n="star" cls="sm" />
          {hasRating ? (
            <>
              <b>{ratingFmt(p.rating as number)}</b>
              <span>de {ratingFmt(p.rating_max ?? 5)}</span>
            </>
          ) : (
            <span>Sem avaliação</span>
          )}
        </li>
        {niche ? <li>{niche}</li> : null}
        {place ? (
          <li>
            <I n="pin" cls="sm" />
            {place}
          </li>
        ) : null}
      </ul>
      <div className="mgp-pbtns">
        <button type="button" className="btn out" onClick={onChat}>
          <I n="msg" cls="sm" />
          Abrir chat
        </button>
        <button type="button" className="btn out mgp-pbtn" onClick={onProfile}>
          <I n="user" cls="sm" />
          Perfil completo
        </button>
      </div>
    </aside>
  );
}

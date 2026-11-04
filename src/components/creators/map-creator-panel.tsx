import { Av, I } from "@/components/prototype/ui";
import type { CreatorGroup } from "@/shared/utils/group-creators";

import { NET_ICON, groupPhoto, useAccountRows } from "./creator-accounts";
import { ROSTER_LABEL } from "./creator-card";
import { followersLabel, fmtDistance } from "./creator-metrics";

export interface MapCreatorPanelProps {
  group: CreatorGroup;
  /** Há filtro geográfico (a distância só existe nele). */
  near: boolean;
  saved: boolean;
  onClose: () => void;
  onOpen: () => void;
  onSave: () => void;
  /** Agência: estado no elenco e ação de convidar (ausente = sem a ação). */
  rosterStatus?: "invited" | "active" | null;
  onRoster?: () => void;
  rosterBusy?: boolean;
}

/**
 * Resumo do criador aberto no mapa: o suficiente para decidir sem sair dele.
 * Cidade e estado não vêm no catálogo (só a posição aproximada), então não aparecem aqui.
 */
export function MapCreatorPanel({ group, near, saved, onClose, onOpen, onSave, rosterStatus, onRoster, rosterBusy }: MapCreatorPanelProps) {
  const { networks, ugc } = useAccountRows(group);
  const labels = [...(ugc ? ["UGC"] : []), ...group.niches.map((n) => n.name).filter((s) => s.trim().length > 0)];

  return (
    <aside className="nm-pan" aria-label={`Resumo de ${group.user.name}`}>
      <button type="button" className="nm-pan-x" aria-label="Fechar resumo" onClick={onClose}>
        <I n="x" cls="sm" />
      </button>

      <header>
        <Av name={group.user.name} src={groupPhoto(group)} size={56} />
        <div>
          <b title={group.user.name}>{group.user.name}</b>
          {networks[0] && <span>@{networks[0].username}</span>}
          {near && group.distance_km != null && (
            <small>
              <I n="flag" cls="sm" />a {fmtDistance(group.distance_km)} do centro · local aproximado
            </small>
          )}
        </div>
      </header>

      {rosterStatus && (
        <span className={`ccd-rs ${rosterStatus} nm-pan-rs`}>
          <I n="star" cls="sm" />
          {ROSTER_LABEL[rosterStatus]}
        </span>
      )}

      {networks.length > 0 && (
        <ul className="nm-pan-nets" aria-label="Redes sociais">
          {networks.map((n) => {
            const fol = followersLabel(n.members);
            return (
              <li key={n.id}>
                <I n={NET_ICON[n.type] ?? "video"} cls="sm" />
                <span>{n.label}</span>
                <b>{fol ? `${fol} seguidores` : "—"}</b>
              </li>
            );
          })}
        </ul>
      )}

      {labels.length > 0 && (
        <div className="nm-pan-tags" aria-label="Categorias">
          {labels.slice(0, 6).map((t) => (
            <span key={t} className={t === "UGC" ? "ugc" : undefined}>
              {t}
            </span>
          ))}
          {labels.length > 6 && <span className="more">+{labels.length - 6}</span>}
        </div>
      )}

      <div className="nm-pan-a">
        <button type="button" className="btn" onClick={onOpen}>
          Ver perfil
        </button>
        <button type="button" className={`btn out${saved ? " on" : ""}`} aria-pressed={saved} onClick={onSave}>
          <I n="heart" cls="sm" />
          {saved ? "Salvo em lista" : "Salvar em lista"}
        </button>
        {onRoster && !rosterStatus && (
          <button type="button" className="btn out" disabled={rosterBusy} onClick={onRoster}>
            <I n="star" cls="sm" />
            {rosterBusy ? "Convidando…" : "Convidar para o elenco"}
          </button>
        )}
      </div>
    </aside>
  );
}

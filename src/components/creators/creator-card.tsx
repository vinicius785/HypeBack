import { useState, type CSSProperties, type MouseEvent } from "react";

import { Av, I } from "@/components/prototype/ui";
import { Skeleton } from "@/components/ui/skeleton";
import type { CreatorGroup } from "@/shared/utils/group-creators";

import { NET_ICON, groupPhoto, useAccountRows } from "./creator-accounts";
import { engagementLabel, fmtDistance, followersLabel, splitCategories } from "./creator-metrics";
import "@/styles/creator-cards.css";

export const ROSTER_LABEL = { active: "No elenco", invited: "Convite enviado" } as const;

/** Redes visíveis de cara no cartão; as demais ficam atrás de "+N redes". */
const VISIBLE_NETWORKS = 2;

export interface CreatorCardProps {
  group: CreatorGroup;
  /** Posição, para escalonar a entrada. */
  k: number;
  selected: boolean;
  near: boolean;
  saved: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onInvite: () => void;
  onSave: () => void;
  /** Agência: estado do criador no elenco (`invited` | `active`), ou null. */
  rosterStatus?: "invited" | "active" | null;
  /** Agência com permissão de convidar: convida o criador para o elenco. Ausente = sem a ação. */
  onRoster?: () => void;
  /** O convite ao elenco deste criador está sendo enviado. */
  rosterBusy?: boolean;
}

const stop = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  fn();
};

/**
 * Cartão do catálogo de criadores. Ordem de leitura: quem é (foto, nome, @, redes) → o que faz (categorias) →
 * quanto alcança (métricas por rede, só as confiáveis) → o que fazer (ver perfil, convidar, elenco).
 * Favoritar fica no canto, sempre no mesmo lugar; elenco é um estado à parte (selo), não se confunde com "salvo".
 */
export function CreatorCard({
  group,
  k,
  selected,
  near,
  saved,
  onSelect,
  onOpen,
  onInvite,
  onSave,
  rosterStatus,
  onRoster,
  rosterBusy,
}: CreatorCardProps) {
  const { networks: rows, ugc } = useAccountRows(group);
  const [expanded, setExpanded] = useState(false);
  const name = group.user.name;

  const labels = [...(ugc ? ["UGC"] : []), ...group.niches.map((n) => n.name).filter((s) => s.trim().length > 0)];
  const { shown: tags, extra: extraTags } = splitCategories(labels, 2);
  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE_NETWORKS);
  const hiddenCount = rows.length - VISIBLE_NETWORKS;
  const handle = rows[0]?.username;
  const netTypes = [...new Set(rows.map((r) => r.type))];
  const canRoster = !!onRoster && !rosterStatus;

  return (
    <article
      className={`ccd${selected ? " sel" : ""}${rosterStatus === "active" ? " in-roster" : ""}`}
      style={{ "--k": Math.min(k, 14) } as CSSProperties}
      onClick={onOpen}
    >
      <header className="ccd-top">
        <div className="ccd-av">
          <Av name={name} src={groupPhoto(group)} size={56} />
          <button
            type="button"
            className={`ccd-ck${selected ? " on" : ""}`}
            aria-label={`Selecionar ${name}`}
            aria-pressed={selected}
            onClick={stop(onSelect)}
          >
            <I n="check" cls="sm" />
          </button>
        </div>
        <div className="ccd-id">
          <b title={name}>{name}</b>
          {handle ? <span className="ccd-h">@{handle}</span> : <span className="ccd-h mute">Sem redes sociais</span>}
          {netTypes.length > 0 && (
            <span className="ccd-nets" aria-label={`Redes: ${rows.map((r) => r.label).join(", ")}`}>
              {netTypes.map((t) => (
                <I key={t} n={NET_ICON[t] ?? "video"} cls="sm" />
              ))}
            </span>
          )}
        </div>
        <button
          type="button"
          className={`ccd-fav${saved ? " on" : ""}`}
          aria-label="Salvar em lista"
          aria-pressed={saved}
          title={saved ? "Salvo em lista" : "Salvar em lista"}
          onClick={stop(onSave)}
        >
          <I n="heart" cls="sm" />
        </button>
      </header>

      {(rosterStatus || (near && group.distance_km != null) || tags.length > 0) && (
        <div className="ccd-tags">
          {rosterStatus && (
            <span className={`ccd-rs ${rosterStatus}`}>
              <I n="star" cls="sm" />
              {ROSTER_LABEL[rosterStatus]}
            </span>
          )}
          {near && group.distance_km != null && (
            <span className="ccd-d">
              <I n="flag" cls="sm" />
              {fmtDistance(group.distance_km)}
            </span>
          )}
          {tags.map((t) => (
            <span key={t} className={t === "UGC" ? "ugc" : undefined}>
              {t}
            </span>
          ))}
          {extraTags > 0 && <span className="more" title={labels.slice(2).join(", ")}>+{extraTags}</span>}
        </div>
      )}

      {rows.length > 0 ? (
        <div className="ccd-m">
          <ul aria-label="Métricas por rede social">
            {visibleRows.map((a) => {
              const followers = followersLabel(a.members);
              const eng = engagementLabel(a.members, a.engagement);
              return (
                <li key={a.id}>
                  <span className="ccd-ni" title={a.label}>
                    <I n={NET_ICON[a.type] ?? "video"} cls="sm" />
                  </span>
                  <span className="ccd-nu">
                    <b>{a.label}</b>
                    <small>@{a.username}</small>
                  </span>
                  <span className="ccd-nv">
                    <b className={followers ? undefined : "mute"}>{followers ?? "—"}</b>
                    <small>{followers ? (eng ? `seguidores · ${eng} eng.` : "seguidores") : "sem dados"}</small>
                  </span>
                </li>
              );
            })}
          </ul>
          {hiddenCount > 0 && (
            <button
              type="button"
              className="ccd-more"
              aria-expanded={expanded}
              onClick={stop(() => setExpanded((v) => !v))}
            >
              {expanded ? "Mostrar menos" : `+${hiddenCount} ${hiddenCount === 1 ? "rede" : "redes"}`}
            </button>
          )}
        </div>
      ) : (
        <div className="ccd-m empty" role="note">
          <I n="video" cls="sm" />
          <span>Nenhuma rede social conectada ainda</span>
        </div>
      )}

      <footer className="ccd-a">
        <button type="button" className="btn" onClick={stop(onOpen)}>
          Ver perfil
        </button>
        <button type="button" className="btn out" onClick={stop(onInvite)}>
          Convidar
        </button>
        {canRoster && (
          <button
            type="button"
            className="ccd-roster"
            aria-label={`Convidar ${name} para o elenco`}
            title="Convidar para o elenco"
            disabled={rosterBusy}
            aria-busy={rosterBusy || undefined}
            onClick={stop(onRoster)}
          >
            <I n="star" cls="sm" />
            {rosterBusy ? "Enviando…" : "Adicionar ao elenco"}
          </button>
        )}
      </footer>
    </article>
  );
}

/** Esqueleto com a mesma estrutura do cartão, para a lista não pular ao carregar. */
export function CreatorCardSkeleton({ k }: { k: number }) {
  return (
    <div className="ccd" aria-hidden="true" style={{ "--k": k, cursor: "default" } as CSSProperties}>
      <div className="ccd-top">
        <Skeleton className="size-[56px] rounded-full" />
        <div style={{ flex: 1 }}>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-7 w-2/3 rounded-full" />
      <Skeleton className="h-[104px] w-full rounded-[20px]" />
      <Skeleton className="h-11 w-full rounded-full" />
    </div>
  );
}

import { useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";

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
  /** Ausente = sem a caixa de seleção (ex.: dentro de uma lista). */
  onSelect?: () => void;
  onOpen: () => void;
  onInvite: () => void;
  /** Ausente = sem o coração. */
  onSave?: () => void;
  /** Painel sobre o cartão (ex.: confirmar a remoção da lista). */
  overlay?: ReactNode;
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
  overlay,
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
  const canRoster = !!onRoster && !rosterStatus;

  return (
    <article
      className={`ccd${selected ? " sel" : ""}${rosterStatus === "active" ? " in-roster" : ""}`}
      style={{ "--k": Math.min(k, 14) } as CSSProperties}
      onClick={onOpen}
    >
      <div className="ccd-hero">
        <div className="ccd-photo">
          <Av name={name} src={groupPhoto(group)} size={320} />
        </div>
        {onSelect ? (
        <button
          type="button"
          className={`ccd-ck${selected ? " on" : ""}`}
          aria-label={`Selecionar ${name}`}
          aria-pressed={selected}
          onClick={stop(onSelect)}
        >
          <I n="check" cls="sm" />
        </button>
        ) : null}
        {onSave ? (
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
        ) : null}
        <div className="ccd-shade">
          <div className="ccd-id">
            <b title={name}>{name}</b>
            {handle ? null : <span className="ccd-h mute">Sem redes sociais</span>}
          </div>
          {((near && group.distance_km != null) || tags.length > 0) && (
            <div className="ccd-tags">
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
        </div>
      </div>

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
          <span>Ver perfil</span>
          <I n="chev" cls="sm ccd-ar" />
        </button>
        <button type="button" className="btn out" onClick={stop(onInvite)}>
          <I n="send" cls="sm ccd-ic" />
          <span>Convidar</span>
        </button>
        {rosterStatus ? (
          <span className={`ccd-roster st ${rosterStatus}`}>
            <I n="star" cls="sm" />
            {ROSTER_LABEL[rosterStatus]}
          </span>
        ) : null}
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
            {rosterBusy ? "Enviando…" : "Convidar para o elenco"}
          </button>
        )}
      </footer>
      {overlay}
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

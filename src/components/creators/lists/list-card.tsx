import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";

import { Av, I } from "@/components/prototype/ui";
import { useInfluencerList } from "@/hooks/use-influencer-lists";
import type { InfluencerList } from "@/shared/services/influencer-lists";
import "@/styles/creator-lists.css";

import { countLabel, listDateLabel } from "./list-format";

const AVATARS = 5;

interface Props {
  list: InfluencerList;
  k: number;
  /** Sem permissão de escrita, o menu só tem o que não altera nada. */
  canWrite: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  duplicating?: boolean;
}

/**
 * Cartão de lista: nome e menu em cima, descrição (se houver), fotos dos primeiros criadores com o total,
 * e embaixo a data e a ação de abrir. Editar, duplicar e excluir ficam no menu para o cartão ficar baixo.
 */
export function ListCard({ list, k, canWrite, onOpen, onEdit, onDuplicate, onDelete, duplicating }: Props) {
  const { data } = useInfluencerList(list.id);
  const members = data?.influencers ?? [];
  const extra = Math.max(0, list.influencer_count - AVATARS);
  const date = listDateLabel(list);
  const [menu, setMenu] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    setMenu(false);
    fn();
  };

  return (
    <article className={`lst-card${menu ? " menu-open" : ""}`} style={{ "--k": Math.min(k, 14) } as CSSProperties} onClick={onOpen}>
      <header>
        <h3 title={list.name}>{list.name}</h3>
        <div className={`cfw${menu ? " open" : ""}`} ref={wrap} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="lst-more"
            aria-label={`Ações da lista ${list.name}`}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <I n="more" cls="sm" />
          </button>
          <div className="cfm right" role="menu">
            {canWrite && (
              <button type="button" role="menuitem" onClick={stop(onEdit)}>
                Editar informações
                <I n="notepad" cls="sm" />
              </button>
            )}
            {canWrite && (
              <button type="button" role="menuitem" disabled={duplicating} onClick={stop(onDuplicate)}>
                {duplicating ? "Duplicando…" : "Duplicar lista"}
                <I n="copy" cls="sm" />
              </button>
            )}
            <button type="button" role="menuitem" onClick={stop(onOpen)}>
              Abrir lista
              <I n="list" cls="sm" />
            </button>
            {canWrite && (
              <button type="button" role="menuitem" className="dng" onClick={stop(onDelete)}>
                Excluir lista
                <I n="trash" cls="sm" />
              </button>
            )}
          </div>
        </div>
      </header>

      {list.description ? <p className="lst-desc">{list.description}</p> : null}

      <div className="lst-who">
        {members.length > 0 ? (
          <span className="lst-st" aria-hidden="true">
            {members.slice(0, AVATARS).map((m) => (
              <Av key={m.id} name={m.name} src={m.photo ?? undefined} size={32} />
            ))}
            {extra > 0 && <em>+{extra}</em>}
          </span>
        ) : null}
        <b>{countLabel(list.influencer_count)}</b>
      </div>

      <footer>
        {date && <small>{date}</small>}
        <button type="button" className="btn out" onClick={stop(onOpen)}>
          Abrir lista
        </button>
      </footer>
    </article>
  );
}

export function ListCardSkeleton({ k }: { k: number }) {
  return (
    <div className="lst-card sk" aria-hidden="true" style={{ "--k": k } as CSSProperties}>
      <i style={{ width: "60%", height: 20 }} />
      <i style={{ width: "40%", height: 32 }} />
      <i style={{ width: "100%", height: 38, marginTop: 8 }} />
    </div>
  );
}

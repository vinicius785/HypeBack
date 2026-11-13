import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Av, I } from "@/components/prototype/ui";
import {
  ACTION_LABEL,
  LATE_AFTER_DAYS,
  LATE_COLUMNS,
  WAITING,
  formatFollowers,
  CREATOR_ADJUSTING,
  CREATOR_ADJUSTING_TAG,
  NEEDS_YOU_TAG,
} from "../campaign-flow";
import type { ExtendedInfluencer } from "../management-kanban-config";
import { SocialHandle } from "@/components/social-handle";
import { canRejectFromMenu, cardNote, networkRows } from "./card-info";
import { isNegotiationColumn, waitBadgeText, waitDays, waitText, waitTone } from "./negotiation-wait";

/** Dias desde a última mudança de status de um criador. */
export function idleDaysOf(inf: ExtendedInfluencer): number | undefined {
  const last = inf.statusHistory?.length ? inf.statusHistory[inf.statusHistory.length - 1] : null;
  if (!last) return undefined;
  const t = new Date(last.timestamp).getTime();
  return Number.isNaN(t) ? undefined : Math.floor((Date.now() - t) / 86_400_000);
}

export interface CardHandlers {
  onSelect: (inf: ExtendedInfluencer) => void;
  onAction: (inf: ExtendedInfluencer, column: string) => void;
  onChat: (inf: ExtendedInfluencer) => void;
  onProfile: (inf: ExtendedInfluencer) => void;
  onReject: (inf: ExtendedInfluencer) => void;
}

function CardMenu({
  inf,
  column,
  handlers,
}: {
  inf: ExtendedInfluencer;
  column: string;
  handlers: CardHandlers;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".kmenu, .kc-m")) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  const run = (fn: () => void) => () => {
    setPos(null);
    fn();
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="kc-m"
        aria-label={`Mais ações de ${inf.name}`}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={(e) => {
          e.stopPropagation();
          const r = btn.current?.getBoundingClientRect();
          if (r) setPos(pos ? null : { top: r.bottom + 6, right: window.innerWidth - r.right });
        }}
      >
        <I n="more" cls="sm" />
      </button>
      {pos
        ? createPortal(
            <div className="pv">
              <div className="kmenu" role="menu" style={{ top: pos.top, right: pos.right }}>
                <button type="button" role="menuitem" onClick={run(() => handlers.onSelect(inf))}>
                  <I n="grid" cls="sm" />
                  Abrir painel
                </button>
                <button type="button" role="menuitem" onClick={run(() => handlers.onChat(inf))}>
                  <I n="msg" cls="sm" />
                  Abrir chat
                </button>
                <button type="button" role="menuitem" onClick={run(() => handlers.onProfile(inf))}>
                  <I n="user" cls="sm" />
                  Ver perfil
                </button>
                {canRejectFromMenu(column) ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="d"
                    onClick={run(() => handlers.onReject(inf))}
                  >
                    <I n="ban" cls="sm" />
                    Recusar
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

interface ViewProps {
  influencer: ExtendedInfluencer;
  column: string;
  dim?: boolean;
  selected?: boolean;
  moving?: boolean;
  /** Cartão do arrasto: sem menu nem botão de ação. */
  overlay?: boolean;
  handlers?: CardHandlers;
}

/** Cartão do criador: identificação, métricas com rótulo, uma linha de contexto e a ação da etapa. */
export function InfluencerCardView({ influencer, column, moving, overlay, handlers }: ViewProps) {
  const action = ACTION_LABEL[column];
  const idle = idleDaysOf(influencer);
  const late = LATE_COLUMNS.includes(column) && (idle ?? 0) >= LATE_AFTER_DAYS;
  const note = cardNote(influencer, column, idle, late);
  const nets = networkRows(influencer);
  const waiting = WAITING[column];
  // Roteiro e Revisão do conteúdo reúnem "aguardando aprovação" (vez do gestor) e "criador ajustando": a etiqueta diz qual é.
  const adjusting = CREATOR_ADJUSTING.includes(column);
  const needsYou = column === "script_pending" || column === "pending_approval";
  const roleTag = adjusting ? CREATOR_ADJUSTING_TAG : needsYou ? NEEDS_YOU_TAG : null;
  // Negociação de valor: há quanto tempo a marca ou o criador não responde (só com histórico; sem ele não mostra nada).
  const wait = isNegotiationColumn(column) ? waitDays(influencer) : undefined;
  const waitToneOf = waitTone(wait);

  return (
    <>
      <div className="kc-h">
        <Av name={influencer.name} src={influencer.avatar} size={56} />
        <div className="kc-n">
          <b title={influencer.name}>{influencer.name}</b>
          <small>
            {influencer.username ? <SocialHandle className="kc-at" username={influencer.username} network={influencer.socialNetwork ?? influencer.social_networks?.[0]?.type} /> : "Sem usuário"}
          </small>
        </div>
        {!overlay && handlers ? <CardMenu inf={influencer} column={column} handlers={handlers} /> : null}
      </div>
      <ul className="kc-nets" aria-label="Redes em que se inscreveu">
        {nets.map((n) => (
          <li key={n.key}>
            <span className="kc-nl">{n.label}</span>
            <b>{formatFollowers(n.members)}</b>
            <small>seguidores</small>
          </li>
        ))}
      </ul>
      {note || influencer.isExternal || roleTag || wait !== undefined ? (
        <div className="kc-ft">
          {influencer.isExternal ? <em className="ext">Externo</em> : null}
          {roleTag ? <em className={`kc-tag ${adjusting ? "adj" : "need"}`}>{roleTag}</em> : null}
          {wait !== undefined ? (
            waitToneOf === "none" ? (
              <span className="kc-since">{waitText(wait)}</span>
            ) : (
              <em className={`kc-wait ${waitToneOf}`} title={waitText(wait)}>
                <I n="clock" cls="sm" />
                {waitBadgeText(wait)}
              </em>
            )
          ) : null}
          {note ? (
            <p className={`kc-cx ${note.tone}`}>
              {note.tone === "warn" ? <I n="clock" cls="sm" /> : null}
              {note.text}
            </p>
          ) : null}
        </div>
      ) : null}
      {overlay ? null : action ? (
        <button
          type="button"
          className="kc-a"
          disabled={moving}
          onClick={(e) => {
            e.stopPropagation();
            handlers?.onAction(influencer, column);
          }}
        >
          <span>{action}</span>
          <I n="chev" cls="sm kc-ar" />
        </button>
      ) : waiting ? (
        <div className="kc-w">{waiting}</div>
      ) : null}
      {moving ? (
        <span className="kc-mv" role="status">
          <I n="refresh" cls="sm spin" />
          Movendo…
        </span>
      ) : null}
    </>
  );
}

/** Cartão arrastável (`.kc`). */
export function SortableInfluencerCard({
  influencer,
  column,
  dim,
  selected,
  moving,
  handlers,
}: Omit<ViewProps, "overlay">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: influencer.id,
  });
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : undefined,
      }}
      {...attributes}
      {...listeners}
      data-inf={String(influencer.id)}
      aria-current={selected ? "true" : undefined}
      aria-busy={moving || undefined}
      className={`kc kc2 ${dim ? "dim" : ""} ${selected ? "sel" : ""} ${moving ? "moving" : ""}`}
      onClick={() => handlers?.onSelect(influencer)}
    >
      <InfluencerCardView influencer={influencer} column={column} handlers={handlers} moving={moving} />
    </article>
  );
}

/** Cartão exibido durante o arrasto. */
export function DragOverlayCard({ influencer, column }: { influencer: ExtendedInfluencer; column: string }) {
  return (
    <article className="kc kc2 drag">
      <InfluencerCardView influencer={influencer} column={column} overlay />
    </article>
  );
}

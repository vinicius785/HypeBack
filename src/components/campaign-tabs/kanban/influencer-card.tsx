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
  formatEngagement,
  formatFollowers,
} from "../campaign-flow";
import type { ExtendedInfluencer } from "../management-kanban-config";
import { canRejectFromMenu, cardNote, networkSummary } from "./card-info";

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
  const net = networkSummary(influencer);
  const waiting = WAITING[column];

  return (
    <>
      <div className="kc-h">
        <Av name={influencer.name} src={influencer.avatar} size={40} />
        <div className="kc-n">
          <b title={influencer.name}>{influencer.name}</b>
          <small>
            {influencer.username ? `@${influencer.username}` : "Sem usuário"}
            {net ? <span className="kc-net"> · {net}</span> : null}
          </small>
        </div>
        {!overlay && handlers ? <CardMenu inf={influencer} column={column} handlers={handlers} /> : null}
      </div>
      <dl className="kc-mt">
        <div>
          <dt>Seguidores</dt>
          <dd>{formatFollowers(influencer.followers)}</dd>
        </div>
        <div>
          <dt>Engajamento</dt>
          <dd>{influencer.engagement ? formatEngagement(influencer.engagement) : "—"}</dd>
        </div>
      </dl>
      {note || influencer.isExternal ? (
        <div className="kc-ft">
          {influencer.isExternal ? <em className="ext">Externo</em> : null}
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
          {action}
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

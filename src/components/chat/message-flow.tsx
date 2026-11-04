import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Av, I } from "@/components/prototype/ui";
import { MessageAttachments } from "@/components/team-chat/message-attachments";
import { clockTime, fullStamp } from "@/shared/utils/chat-time";

import { buildFlow, type ChatLine, type FlowItem, type LineStatus } from "./flow";
import { linkify } from "./linkify";

const STATUS_LABEL: Record<LineStatus, string> = {
  sending: "Enviando",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falha no envio",
};

/** Marca de estado do balão próprio: relógio, um check (enviada), dois (entregue) ou dois em destaque (lida). */
function StatusMark({ status }: { status: LineStatus }) {
  const icon = status === "sending" ? "clock" : status === "failed" ? "alert" : status === "sent" ? "check" : "checks";
  return (
    <span className={`cx-st ${status}`} role="img" aria-label={STATUS_LABEL[status]} title={STATUS_LABEL[status]}>
      <I n={icon} cls="sm" />
    </span>
  );
}

function copyText(text: string) {
  const done = () => toast.success("Mensagem copiada");
  if (navigator.clipboard?.writeText)
    navigator.clipboard.writeText(text).then(done, () => toast.error("Não foi possível copiar."));
  else toast.error("Não foi possível copiar.");
}

/** Menu da mensagem (abre por hover/foco ou toque): hoje só "Copiar", o único recurso que existe no backend. */
function MessageMenu({ line }: { line: ChatLine }) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".cx-menu, .cx-more")) close();
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

  if (line.body.trim() === "") return null;
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="cx-more"
        aria-label="Ações da mensagem"
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={() => {
          const r = btn.current?.getBoundingClientRect();
          if (!r) return;
          if (pos) return setPos(null);
          const below = window.innerHeight - r.bottom;
          setPos({
            ...(below < 120 ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
            ...(line.mine ? { right: window.innerWidth - r.right } : { left: r.left }),
          });
        }}
      >
        <I n="more" cls="sm" />
      </button>
      {pos
        ? createPortal(
            <div className="pv">
              <div className="cx-menu" role="menu" style={pos}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPos(null);
                    copyText(line.body);
                  }}
                >
                  <I n="copy" cls="sm" />
                  Copiar texto
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export interface BubbleHandlers {
  onRetry?: (line: ChatLine) => void;
  onDiscard?: (line: ChatLine) => void;
  onMediaLoad?: () => void;
}

/** Balão: remetente (1ª do grupo), texto com links, anexos e rodapé com hora (tooltip com data completa) e estado. */
export function MessageBubble({
  line,
  first,
  last,
  showSender,
  handlers,
}: {
  line: ChatLine;
  first: boolean;
  last: boolean;
  showSender: boolean;
  handlers: BubbleHandlers;
}) {
  const failed = line.status === "failed";
  const hasText = line.body.trim() !== "";
  return (
    <div
      className={`cx ${line.mine ? "me" : "them"}${first ? " cx-first" : ""}${last ? " cx-last" : ""}${line.status === "sending" ? " cx-pend" : ""}${failed ? " cx-fail" : ""}`}
    >
      {!line.mine && (
        <span className="cx-av" aria-hidden={!showSender}>
          {showSender ? <Av name={line.senderName} src={line.senderAvatar ?? undefined} size={32} /> : null}
        </span>
      )}
      <div className="cx-col">
        {showSender && <small className="cx-who">{line.senderName}</small>}
        <div className="cx-bw">
          <div className="cx-b">
            {hasText && <div className="cx-t">{linkify(line.body)}</div>}
            <MessageAttachments attachments={line.attachments} onMediaLoad={handlers.onMediaLoad} />
            <span className="cx-m">
              <time dateTime={line.createdAt} title={fullStamp(line.createdAt)}>
                {clockTime(line.createdAt)}
              </time>
              {line.mine && line.status === "sending" ? <span className="cx-sd">Enviando...</span> : null}
              {line.mine && line.status ? <StatusMark status={line.status} /> : null}
            </span>
          </div>
          {!failed && line.status !== "sending" ? <MessageMenu line={line} /> : null}
        </div>
        {failed && (
          <p className="cx-err" role="alert">
            {line.error || "Não foi possível enviar."}
            <button type="button" onClick={() => handlers.onRetry?.(line)}>
              <I n="refresh" cls="sm" />
              Tentar de novo
            </button>
            <button type="button" onClick={() => handlers.onDiscard?.(line)}>
              Descartar
            </button>
          </p>
        )}
        {line.seen && <small className="cx-seen">Visto</small>}
      </div>
    </div>
  );
}

/** Histórico: separadores de data, divisor de novas mensagens, grupos por remetente. */
export function MessageFlow({
  lines,
  unreadFromId,
  handlers,
}: {
  lines: readonly ChatLine[];
  unreadFromId?: string | null;
  handlers: BubbleHandlers;
}) {
  const items: FlowItem[] = buildFlow(lines, { unreadFromId });
  return (
    <>
      {items.map((it) =>
        it.kind === "day" ? (
          <div key={it.key} className="cx-day" role="separator" aria-label={it.label}>
            <span>{it.label}</span>
          </div>
        ) : it.kind === "new" ? (
          <div key={it.key} className="cx-new" role="separator" data-new-divider>
            <span>Novas mensagens</span>
          </div>
        ) : (
          <MessageBubble
            key={it.line.localId ?? it.line.id}
            line={it.line}
            first={it.first}
            last={it.last}
            showSender={it.showSender}
            handlers={handlers}
          />
        ),
      )}
    </>
  );
}

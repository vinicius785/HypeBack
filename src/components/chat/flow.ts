import type { TeamChatAttachment } from "@/shared/services/team-chat";
import { dayKey, dayLabel } from "@/shared/utils/chat-time";

/** Estados que o backend realmente informa; "entregue" só entra quando uma API passar a devolvê-lo. */
export type LineStatus = "sending" | "sent" | "delivered" | "read" | "failed";

/** Mensagem já normalizada, igual para o chat da equipe e o dos criadores. */
export interface ChatLine {
  id: string;
  mine: boolean;
  senderKey: string;
  senderName: string;
  senderAvatar?: string | null;
  body: string;
  attachments: TeamChatAttachment[];
  createdAt: string;
  status?: LineStatus;
  /** Falha: motivo mostrado ao lado de "Tentar de novo". */
  error?: string;
  /** "Visto" por escrito (1 a 1): só na última mensagem própria lida. */
  seen?: boolean;
  /** Envio local (ainda não é mensagem do histórico): tem retry/descartar. */
  localId?: string;
}

export type FlowItem =
  | { kind: "day"; key: string; label: string }
  | { kind: "new"; key: string }
  | { kind: "msg"; line: ChatLine; first: boolean; last: boolean; showSender: boolean };

/** Mensagens seguidas do mesmo remetente, no mesmo dia e até 5 minutos uma da outra, formam um grupo. */
export const GROUP_GAP_MS = 5 * 60_000;

export function buildFlow(
  lines: readonly ChatLine[],
  opts: { unreadFromId?: string | null; now?: Date } = {},
): FlowItem[] {
  const items: FlowItem[] = [];
  let prev: ChatLine | null = null;
  let prevItemWasMsg = false;
  for (const line of lines) {
    const day = dayKey(line.createdAt);
    const newDay = !prev || day !== dayKey(prev.createdAt);
    if (newDay) {
      items.push({ kind: "day", key: `d-${day}-${line.id}`, label: dayLabel(line.createdAt, opts.now) });
      prevItemWasMsg = false;
    }
    if (opts.unreadFromId && line.id === opts.unreadFromId && !line.mine) {
      items.push({ kind: "new", key: `n-${line.id}` });
      prevItemWasMsg = false;
    }
    const grouped =
      prevItemWasMsg &&
      prev !== null &&
      prev.senderKey === line.senderKey &&
      new Date(line.createdAt).getTime() - new Date(prev.createdAt).getTime() <= GROUP_GAP_MS;
    items.push({ kind: "msg", line, first: !grouped, last: true, showSender: !line.mine && !grouped });
    if (grouped) {
      for (let i = items.length - 2; i >= 0; i--) {
        const it = items[i];
        if (it.kind === "msg") {
          it.last = false;
          break;
        }
      }
    }
    prev = line;
    prevItemWasMsg = true;
  }
  return items;
}

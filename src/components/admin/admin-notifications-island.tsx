

import { AdminIsland } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import type { AdminNotificationListItem } from "@/shared/types";

import "@/styles/admin-notifications.css";

export interface NotificationIslandSegment {
  id: string;
  label: string;
  /** `null` enquanto a primeira carga não chegou. */
  count: number | null;
  tone?: "ok" | "warn" | "bad";
}

interface Props {
  segments: readonly NotificationIslandSegment[];
  value: string;
  onChange: (id: string) => void;
  /** Todas as notificações (para o resumo da folha branca). */
  items: readonly AdminNotificationListItem[];
}

/** Entregues, leituras no app e a próxima agendada: o que a folha da ilha mostra aberta. */
function summarize(items: readonly AdminNotificationListItem[]) {
  let recipients = 0;
  let delivered = 0;
  let inApp = 0;
  let read = 0;
  for (const n of items) {
    recipients += n.stats?.total_recipients ?? 0;
    delivered += n.stats?.delivered ?? 0;
    inApp += n.stats?.in_app?.total ?? 0;
    read += n.stats?.in_app?.read ?? 0;
  }
  const next = items
    .filter((n) => n.status === "scheduled" && n.scheduled_at)
    .sort((a, b) => Date.parse(a.scheduled_at as string) - Date.parse(b.scheduled_at as string))[0];
  const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : null);
  return { recipients, delivered, deliveredPct: pct(delivered, recipients), inApp, read, readPct: pct(read, inApp), next };
}

/** "Enviando 'título'…": três bolinhas que pulsam em sequência até o ícone de criador. Só anuncia, não tem ação. */
function SendingPulse({ sending }: { sending: readonly AdminNotificationListItem[] }) {
  const first = sending[0];
  const stats = first.stats;
  const progress = stats && stats.total_recipients > 0 ? `${formatInt(stats.delivered)} de ${formatInt(stats.total_recipients)}` : "";
  const extra = sending.length > 1 ? ` e mais ${sending.length - 1}` : "";
  return (
    <div className="isl-send" role="status" aria-label={`Enviando “${first.title}”${extra}${progress ? `, ${progress} entregues` : ""}`}>
      <span className="isl-send-t">
        <b>Enviando</b>
        <small>
          {first.title}
          {extra}
          {progress ? ` · ${progress}` : ""}
        </small>
      </span>
      <span className="isl-send-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="isl-send-who" aria-hidden="true">
        <I n="user" cls="sm" />
      </span>
    </div>
  );
}

/**
 * "Ilha" (padrão Dynamic Island do Gerenciamento) das Notificações: uma pílula preta no topo da página. Fechada, traz
 * os filtros de situação (cada segmento mostra quantas há e filtra a lista); aberta (mola), revela por baixo uma
 * folha branca com o resumo dos envios.
 */
export function AdminNotificationsIsland({ segments, value, onChange, items }: Props) {
  const sum = summarize(items);
  // O que está saindo agora: aparece na pílula (fechada) com as bolinhas indo até o criador.
  const sending = items.filter((n) => n.status === "sending");
  return (
    <AdminIsland
      ariaLabel="Resumo das notificações"
      className="isl-n"
      sheetLabel="Resumo dos envios"
      chevronLabel={{ open: "Abrir o resumo", close: "Fechar o resumo" }}
      start={
        <div className="isl-segs" role="group" aria-label="Situação das notificações">
          {segments.map((segment) => (
            <button
              key={segment.id}
              type="button"
              className="isl-seg"
              data-tone={segment.tone}
              aria-pressed={segment.id === value}
              onClick={() => onChange(segment.id)}
            >
              <i aria-hidden="true" />
              {segment.label}
              <em>{segment.count ?? "—"}</em>
            </button>
          ))}
        </div>
      }
      end={sending.length > 0 ? <SendingPulse sending={sending} /> : null}
      sheet={
        <div className="adm-ntf-sheet">
          <div>
            <small>Entregues</small>
            <b>{sum.deliveredPct === null ? "—" : `${sum.deliveredPct}%`}</b>
            <span>{sum.recipients > 0 ? `${formatInt(sum.delivered)} de ${formatInt(sum.recipients)} destinatários` : "Nada enviado ainda"}</span>
          </div>
          <div>
            <small>Leram no app</small>
            <b>{sum.readPct === null ? "—" : `${sum.readPct}%`}</b>
            <span>{sum.inApp > 0 ? `${formatInt(sum.read)} de ${formatInt(sum.inApp)} avisos no sino` : "Sem leitura para medir"}</span>
          </div>
          <div>
            <small>Próxima agendada</small>
            <b>{sum.next ? formatDateTime(sum.next.scheduled_at) : "—"}</b>
            <span>{sum.next ? sum.next.title : "Nenhuma agendada"}</span>
          </div>
        </div>
      }
    />
  );
}

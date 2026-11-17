import { AdminIsland } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import { clickRate } from "@/lib/admin/popup-form";
import type { Popup } from "@/shared/popups.types";

import "@/styles/admin-notifications.css";

export interface PopupIslandSegment {
  id: string;
  label: string;
  /** `null` enquanto a primeira carga não chegou. */
  count: number | null;
  tone?: "ok" | "warn" | "bad";
}

interface Props {
  segments: readonly PopupIslandSegment[];
  value: string;
  onChange: (id: string) => void;
  /** Todos os pop-ups (para o resumo da folha branca e para o que está no ar). */
  items: readonly Popup[];
}

/** Vistos, taxa de clique e o próximo agendado: o que a folha da ilha mostra aberta. */
function summarize(items: readonly Popup[]) {
  let views = 0;
  let clicks = 0;
  for (const popup of items) {
    views += popup.views;
    clicks += popup.clicks;
  }
  const next = items.filter((popup) => popup.status === "scheduled").sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  return { views, clicks, rate: clickRate(views, clicks), next };
}

/** "No ar 'título'…": a mesma animação do envio das notificações (três bolinhas até o ícone da pessoa): o pop-up chegando a quem abre o app. */
function LivePulse({ live }: { live: readonly Popup[] }) {
  const first = live[0];
  const extra = live.length > 1 ? ` e mais ${live.length - 1}` : "";
  const progress = `${formatInt(first.views)} ${first.views === 1 ? "visto" : "vistos"}`;
  return (
    <div className="isl-send" role="status" aria-label={`No ar: “${first.title}”${extra}, ${progress}`}>
      <span className="isl-send-t">
        <b>No ar</b>
        <small>
          {first.title}
          {extra} · {progress}
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
 * "Ilha" (padrão Dynamic Island, igual à das Notificações) dos Pop-ups: uma pílula preta no topo. Fechada, traz os
 * filtros de situação (cada segmento mostra quantos há e filtra a lista) e, havendo pop-up no ar, a animação de chegada
 * até a pessoa; aberta (mola), revela uma folha branca com o resumo.
 */
export function AdminPopupsIsland({ segments, value, onChange, items }: Props) {
  const sum = summarize(items);
  const live = items.filter((popup) => popup.status === "live");
  return (
    <AdminIsland
      ariaLabel="Resumo dos pop-ups"
      className="isl-n"
      sheetLabel="Números dos pop-ups"
      chevronLabel={{ open: "Abrir o resumo", close: "Fechar o resumo" }}
      start={
        <div className="isl-segs" role="group" aria-label="Situação dos pop-ups">
          {segments.map((segment) => (
            <button key={segment.id} type="button" className="isl-seg" data-tone={segment.tone} aria-pressed={segment.id === value} onClick={() => onChange(segment.id)}>
              <i aria-hidden="true" />
              {segment.label}
              <em>{segment.count ?? "—"}</em>
            </button>
          ))}
        </div>
      }
      end={live.length > 0 ? <LivePulse live={live} /> : null}
      sheet={
        <div className="adm-ntf-sheet">
          <div>
            <small>Vistos</small>
            <b>{sum.views > 0 ? formatInt(sum.views) : "—"}</b>
            <span>{live.length > 0 ? `${live.length} ${live.length === 1 ? "pop-up no ar" : "pop-ups no ar"} agora` : "Nenhum no ar agora"}</span>
          </div>
          <div>
            <small>Taxa de clique</small>
            <b>{sum.rate}</b>
            <span>{sum.views > 0 ? `${formatInt(sum.clicks)} cliques de ${formatInt(sum.views)} vistos` : "Sem visualização para medir"}</span>
          </div>
          <div>
            <small>Próximo agendado</small>
            <b>{sum.next ? formatDateTime(sum.next.starts_at) : "—"}</b>
            <span>{sum.next ? sum.next.title : "Nenhum agendado"}</span>
          </div>
        </div>
      }
    />
  );
}

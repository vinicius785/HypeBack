import { AdminIsland } from "@/components/admin/platform";
import { formatInt } from "@/lib/admin/format";

import type { ServiceQueue } from "./service-search";

import "@/styles/admin-service.css";

export interface ServiceCounts {
  /** Suporte */
  supportActive: number | null;
  supportDone: number | null;
  unassigned: number | null;
  mine: number | null;
  inProgress: number | null;
  waiting: number | null;
  /** Solicitações de tipo de conta */
  requestsPending: number | null;
  requestsDone: number | null;
}

interface Props {
  /** Recebe o elemento onde a fila pendura a sua barra (busca, filtros, atualizar), dentro da ilha. */
  toolsRef?: (element: HTMLDivElement | null) => void;
  value: ServiceQueue;
  onChange: (queue: ServiceQueue) => void;
  counts: ServiceCounts;
}

const n = (value: number | null) => (value === null ? "—" : formatInt(value));

/** Um grupo de pílulas da ilha (Suporte, Solicitações): o escolhido fica branco; cada uma mostra quantas há. */
function Group({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: ReadonlyArray<{ id: ServiceQueue; label: string; count: number | null; tone?: "warn" }>;
  value: ServiceQueue;
  onChange: (queue: ServiceQueue) => void;
}) {
  return (
    <div className="isl-sgrp" role="group" aria-label={label}>
      <span className="isl-sgrp-k" aria-hidden="true">
        {label}
      </span>
      {items.map((item) => (
        <button key={item.id} type="button" className="isl-seg" data-tone={item.tone} aria-pressed={item.id === value} onClick={() => onChange(item.id)}>
          <i aria-hidden="true" />
          {item.label}
          <em>{n(item.count)}</em>
        </button>
      ))}
    </div>
  );
}

/**
 * "Ilha" (padrão Dynamic Island do Gerenciamento) do Atendimento: a única navegação da página. À esquerda, as filas:
 * Suporte (ativos, resolvidos) e Solicitações de conta (pendentes, histórico), cada pílula com a sua contagem. À direita,
 * "Aguardando você" com bolinhas que pulsam enquanto há pedido sem responsável ou solicitação pendente. A seta abre uma
 * folha com o andamento do suporte.
 */
export function ServiceIsland({ value, onChange, counts, toolsRef }: Props) {
  const waiting = (counts.unassigned ?? 0) + (counts.requestsPending ?? 0);
  const known = counts.unassigned !== null && counts.requestsPending !== null;
  const state = !known ? "checking" : waiting > 0 ? "warn" : "ok";
  const label = !known ? "Verificando a fila…" : waiting > 0 ? `Aguardando você: ${formatInt(waiting)}` : "Tudo em dia";

  return (
    <AdminIsland
      ariaLabel="Filas do atendimento"
      className="isl-svc-w"
      sheetLabel="Andamento do suporte"
      chevronLabel={{ open: "Abrir o andamento do suporte", close: "Fechar o andamento do suporte" }}
      toolsRef={toolsRef}
      start={
        <>
          <Group
            label="Suporte"
            value={value}
            onChange={onChange}
            items={[
              { id: "support", label: "Ativos", count: counts.supportActive },
              { id: "support-done", label: "Resolvidos", count: counts.supportDone },
            ]}
          />
          <Group
            label="Solicitações"
            value={value}
            onChange={onChange}
            items={[
              { id: "requests", label: "Pendentes", count: counts.requestsPending, tone: (counts.requestsPending ?? 0) > 0 ? "warn" : undefined },
              { id: "requests-done", label: "Histórico", count: counts.requestsDone },
            ]}
          />
        </>
      }
      end={
        <span className="isl-wait" data-state={state} role="status" aria-label={label}>
          <b>{known ? (waiting > 0 ? "Aguardando você" : "Tudo em dia") : "Verificando…"}</b>
          <span className="isl-wait-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {known && waiting > 0 ? <em>{formatInt(waiting)}</em> : null}
        </span>
      }
      sheet={
        <div className="adm-svc-sheet">
          <div>
            <small>Sem responsável</small>
            <b>{n(counts.unassigned)}</b>
            <span>pedidos esperando alguém assumir</span>
          </div>
          <div>
            <small>Atribuídos a mim</small>
            <b>{n(counts.mine)}</b>
            <span>pedidos sob a sua responsabilidade</span>
          </div>
          <div>
            <small>Em andamento</small>
            <b>{n(counts.inProgress)}</b>
            <span>sendo atendidos agora</span>
          </div>
          <div>
            <small>Aguardando retorno</small>
            <b>{n(counts.waiting)}</b>
            <span>esperando resposta de quem pediu</span>
          </div>
        </div>
      }
    />
  );
}

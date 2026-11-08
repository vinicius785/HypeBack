import { useEffect, useRef, useState, type ReactNode } from "react";

import { Av, I } from "@/components/prototype/ui";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import {
  ACTION_LABEL,
  COLUMN_LABEL,
  HOT_COLUMNS,
  STAGE_SHORT,
  formatFollowers,
  stageOf,
} from "../campaign-flow";
import { idToString, type ExtendedInfluencer } from "../management-kanban-config";
import { ContentPanelActions, isContentColumn } from "../shared/content-panel-actions";
import { PriceNegotiationSection } from "../shared/price-negotiation-section";
import type { CampaignPhaseForCost } from "../shared/prices-utils";
import { ScriptPanelActions, isScriptColumn } from "../shared/script-panel-actions";
import { SelectionPanelActions, isSelectionColumn, type SelectionColumn } from "../shared/selection-panel-actions";
import { ShipmentPanelActions, isShipmentColumn } from "../shared/shipment-panel-actions";
import { fullDate } from "./card-info";
import { PanelProfile } from "./panel-profile";
import {
  NEGOTIATION_INLINE_COLUMNS,
  historyActor,
  panelNeighbours,
  recentHistory,
  rejectionReason,
} from "./panel-nav";


interface Props {
  /** O criador foi desselecionado: a ilha se recolhe (e some) antes de dar lugar ao resumo. */
  closing?: boolean;
  /** Barra de etapas/filtros do quadro, mostrada dentro da ilha, abaixo da pílula. */
  dock?: ReactNode;
  inf: ExtendedInfluencer;
  /** Coluna atual do criador (a etapa do fluxo real). */
  column: string;
  late: boolean;
  idle?: number;
  /** Ids dos criadores na ordem do quadro (para anterior/próximo). */
  orderedIds: readonly string[];
  onSelect: (id: string) => void;
  onClose: () => void;
  campaignId: string;
  paymentType?: string | null;
  phasesWithFormats: ReadonlyArray<CampaignPhaseForCost>;
  highlightContentId: string | null;
  onChat: () => void;
  onProfile: () => void;
  /** Ação principal da etapa que não tem tela própria no painel (ex.: ver contrato). */
  onStageAction: () => void;
  onReject: () => void;
  onReconsider: () => void;
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${fullDate(d)} · ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Inspector do criador selecionado, acima do quadro: compacto por padrão (identificação | informações e decisão | últimas
 * movimentações) e com "Expandir" para o que não cabe (todas as redes, negociação completa, histórico inteiro).
 * Faz parte do layout (sem modal nem gaveta). A lógica de cada ação continua nos componentes de `shared/`.
 */
export function ManagementPanel({
  closing = false,
  dock,
  inf,
  column,
  late,
  idle,
  orderedIds,
  onSelect,
  onClose,
  campaignId,
  paymentType,
  phasesWithFormats,
  highlightContentId,
  onChat,
  onProfile,
  onStageAction,
  onReject,
  onReconsider,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const histRef = useRef<HTMLDivElement>(null);
  // Ao abrir o histórico, leva o olhar até ele se estiver fora da área visível (ex.: com uma confirmação aberta acima).
  useEffect(() => {
    if (!histOpen) return;
    const t = window.setTimeout(() => histRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 260);
    return () => window.clearTimeout(t);
  }, [histOpen]);
  // O corpo nasce fechado e abre no quadro seguinte: a altura "desdobra" em vez de aparecer de uma vez.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);
  const open = mounted && !collapsed && !closing;
  const id = idToString(inf.id);
  const influencerId = String(inf.user_id ?? inf.id);
  const nav = panelNeighbours(orderedIds, id);
  // Direção da troca (+1 = próximo, -1 = anterior), derivada da posição no quadro: o conteúdo novo entra do lado certo.
  const [prevPos, setPrevPos] = useState(nav.position);
  const [dir, setDir] = useState(0);
  if (nav.position !== prevPos) {
    setPrevPos(nav.position);
    setDir(Math.sign(nav.position - prevPos));
  }
  const stage = stageOf(column);
  const rejected = column === "rejected";
  const reason = rejected ? rejectionReason(inf.statusHistory) : null;
  const hot = HOT_COLUMNS.includes(column);
  const nets = inf.social_networks ?? [];
  const all = recentHistory(inf.statusHistory, Number.MAX_SAFE_INTEGER);
  const total = all.length;
  const negotiation = inf.price_negotiation
    ? (
        <PriceNegotiationSection
          campaignId={campaignId}
          userId={inf.user_id}
          status={inf.status}
          negotiation={inf.price_negotiation}
        />
      )
    : null;
  const negotiationInline = !!negotiation && NEGOTIATION_INLINE_COLUMNS.includes(column);

  return (
    <section
      className={`isl isl-c mgp${open ? " isl-open" : ""}${closing ? " isl-out" : ""}`}
      aria-label={`Detalhes de ${inf.name}`}
      data-testid="management-panel"
      style={{ ["--dir" as string]: dir }}
    >
      {/* a "ilha": a pílula é sempre visível (quem é, etapa, navegação e controles); o corpo abre e fecha por baixo */}
      <header className="isl-h">
        <div className="isl-who isl-sw" key={`w${inf.id}`}>
          <Av name={inf.name} src={inf.avatar} size={40} />
          <div className="isl-t">
            <h2>
              {inf.name}
              {inf.isExternal ? <em className="ext">Externo</em> : null}
            </h2>
            <p>{inf.username ? `@${inf.username}` : "Sem usuário"}</p>
          </div>
        </div>
        <div className="isl-st isl-sw" key={`s${inf.id}`} data-hot={hot ? "" : undefined}>
          <i aria-hidden />
          <span>{COLUMN_LABEL[column] ?? column}</span>
          {stage ? <small>{STAGE_SHORT[stage[0]]}</small> : null}
        </div>
        {late ? <span className="isl-late">{idle} dias parado</span> : null}
        {nets.length > 0 && !collapsed ? (
          <ul className="isl-nets" aria-label="Redes sociais">
            {nets.map((n) => (
              <li key={n.id}>
                <b>{getNetworkLabel(n.type, n.type)}</b>
                {typeof n.members === "number" && n.members > 0 ? <span>{formatFollowers(n.members)}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="isl-nav" role="group" aria-label="Navegar entre criadores">
          <button
            type="button"
            className="isl-ib"
            aria-label="Criador anterior"
            disabled={!nav.prevId}
            onClick={() => nav.prevId && onSelect(nav.prevId)}
          >
            <I n="chevl" cls="sm" />
          </button>
          <span aria-live="polite">{nav.position > 0 ? `${nav.position} de ${nav.total}` : `${nav.total} no quadro`}</span>
          <button
            type="button"
            className="isl-ib"
            aria-label="Próximo criador"
            disabled={!nav.nextId}
            onClick={() => nav.nextId && onSelect(nav.nextId)}
          >
            <I n="chev" cls="sm" />
          </button>
        </div>
        <div className="isl-ctl">
          {collapsed ? null : (
            <button
              type="button"
              className={`isl-ib${histOpen ? " isl-ib-on" : ""}`}
              aria-label={histOpen ? "Ocultar histórico" : "Ver histórico"}
              aria-expanded={histOpen}
              title={histOpen ? "Ocultar histórico" : `Histórico (${total})`}
              onClick={() => setHistOpen((v) => !v)}
            >
              <I n="clock" cls="sm" />
            </button>
          )}
          <button
            type="button"
            className="isl-ib"
            aria-label={collapsed ? "Abrir painel" : "Minimizar painel"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
          >
            <I n={collapsed ? "chevdown" : "chevup"} cls="sm" />
          </button>
          <button type="button" className="isl-ib isl-x" aria-label="Fechar detalhes" onClick={onClose}>
            <I n="x" cls="sm" />
          </button>
        </div>
      </header>

      <div className="isl-b" inert={!open}>
       <div className="isl-bi">
        <div className="isl-sheet side2">
      <div className="mgp-row isl-sw" key={`r${inf.id}`}>
        {/* ---------- esquerda: resumo do perfil; direita: redes e decisão ---------- */}
        <PanelProfile inf={inf} influencerId={influencerId} onProfile={onProfile} onChat={onChat} />
        {/* ---------- centro: indicadores, informação da etapa e decisão ---------- */}
        <div className="mgp-mid">
          {rejected ? (
            <div className="mgp-why">
              <b>Motivo da recusa</b>
              <p>{reason ? reason.notes : "Nenhum motivo foi registrado."}</p>
            </div>
          ) : null}

          {negotiationInline ? <div className="mgp-neg">{negotiation}</div> : null}

          <div className="mgp-dec">
            {isSelectionColumn(column) ? (
              <SelectionPanelActions
                key={inf.id}
                campaignId={campaignId}
                influencerId={influencerId}
                column={column as SelectionColumn}
                paymentType={paymentType}
                phasesWithFormats={phasesWithFormats}
              />
            ) : isScriptColumn(column) ? (
              <ScriptPanelActions
                key={inf.id}
                campaignId={campaignId}
                influencerId={influencerId}
                influencer={{ id, name: inf.name, username: inf.username, avatar: inf.avatar }}
              />
            ) : isContentColumn(column) ? (
              <ContentPanelActions
                key={inf.id}
                campaignId={campaignId}
                influencerId={influencerId}
                highlightContentId={highlightContentId}
              />
            ) : isShipmentColumn(column) ? (
              <ShipmentPanelActions key={inf.id} campaignId={campaignId} userId={influencerId} />
            ) : ACTION_LABEL[column] ? (
              <button type="button" className="btn" onClick={onStageAction}>
                {ACTION_LABEL[column]}
              </button>
            ) : null}
          </div>
        </div>

      </div>

      {/* Recusar/Reconsiderar ficam fora da grade (o resumo do perfil e os cartões das redes têm a mesma altura) */}
      {rejected || !isSelectionColumn(column) ? (
        <div className="mgp-btns mgp-btns-row">
          {rejected ? (
            <button type="button" className="btn out" onClick={onReconsider}>
              <I n="refresh" cls="sm" />
              Reconsiderar
            </button>
          ) : (
            <button type="button" className="btn out dng" onClick={onReject}>
              <I n="ban" cls="sm" />
              Recusar
            </button>
          )}
        </div>
      ) : null}

      {/* histórico: fica atrás do ícone do relógio no cabeçalho; abre aqui, em largura total, só quando pedido */}
      <div ref={histRef} className={`mgp-fold${histOpen ? " open" : ""}`} inert={!histOpen} aria-hidden={!histOpen}>
        <div className="mgp-fold-i">
            <aside className="mgp-hist" aria-label="Histórico de movimentações">
              <div className="mgp-hh">
                <h5>Histórico ({total})</h5>
              </div>
              {all.length === 0 ? (
                <p className="mgp-empty">Sem movimentações registradas.</p>
              ) : (
                <ol className="mgp-log mgp-logf">
                  {all.map((h, k) => {
                    const actor = historyActor(h.source);
                    return (
                      <li key={h.id} className={k === 0 ? "cur" : ""}>
                        <b>{COLUMN_LABEL[h.status] ?? h.status}</b>
                        <small>
                          {when(h.timestamp)}
                          {actor ? ` · ${actor}` : ""}
                        </small>
                        {h.notes ? <span>{h.notes}</span> : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </aside>
        </div>
      </div>

        </div>
       </div>
      </div>
      {/* etapas ficam ABAIXO do criador: são outra coisa (navegar o quadro), não parte do criador */}
      {dock}
    </section>
  );
}

import { useState } from "react";

import { Av, I } from "@/components/prototype/ui";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import {
  ACTION_LABEL,
  COLUMN_LABEL,
  HOT_COLUMNS,
  STAGE_SHORT,
  formatEngagement,
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
import { enrolledAt, fullDate } from "./card-info";
import {
  NEGOTIATION_INLINE_COLUMNS,
  historyActor,
  panelNeighbours,
  recentHistory,
  rejectionReason,
} from "./panel-nav";

/** Quantas movimentações o painel compacto mostra; o resto fica no histórico completo (painel expandido). */
const RECENT = 3;

interface Props {
  inf: ExtendedInfluencer;
  /** Coluna atual do criador (a etapa do fluxo real). */
  column: string;
  late: boolean;
  idle?: number;
  /** Ids dos criadores na ordem do quadro (para anterior/próximo). */
  orderedIds: readonly string[];
  expanded: boolean;
  onToggleExpanded: () => void;
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
  inf,
  column,
  late,
  idle,
  orderedIds,
  expanded,
  onToggleExpanded,
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
  const id = idToString(inf.id);
  const influencerId = String(inf.user_id ?? inf.id);
  const nav = panelNeighbours(orderedIds, id);
  const stage = stageOf(column);
  const rejected = column === "rejected";
  const reason = rejected ? rejectionReason(inf.statusHistory) : null;
  const hot = HOT_COLUMNS.includes(column);
  const nets = inf.social_networks ?? [];
  const since = enrolledAt(inf);
  const recent = recentHistory(inf.statusHistory, RECENT);
  const all = recentHistory(inf.statusHistory, Number.MAX_SAFE_INTEGER);
  const older = all.slice(RECENT);
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
      className={`isl isl-c mgp${collapsed ? "" : " isl-open"}${expanded ? " mgp-open" : ""}`}
      aria-label={`Detalhes de ${inf.name}`}
      data-testid="management-panel"
    >
      {/* a "ilha": a pílula é sempre visível (quem é, etapa, navegação e controles); o corpo abre e fecha por baixo */}
      <header className="isl-h">
        <div className="isl-who">
          <Av name={inf.name} src={inf.avatar} size={40} />
          <div className="isl-t">
            <h2>
              {inf.name}
              {inf.isExternal ? <em className="ext">Externo</em> : null}
            </h2>
            <p>{inf.username ? `@${inf.username}` : "Sem usuário"}</p>
          </div>
        </div>
        <div className="isl-st" data-hot={hot ? "" : undefined}>
          <i aria-hidden />
          <span>{COLUMN_LABEL[column] ?? column}</span>
          {stage ? <small>{STAGE_SHORT[stage[0]]}</small> : null}
        </div>
        {late && collapsed ? <span className="isl-late">{idle} dias parado</span> : null}
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
              className="isl-ib"
              aria-label={expanded ? "Recolher detalhes" : "Expandir detalhes"}
              aria-expanded={expanded}
              onClick={onToggleExpanded}
            >
              <I n={expanded ? "shrink" : "expand"} cls="sm" />
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

      <div className="isl-b" inert={collapsed}>
       <div className="isl-bi">
        <div className="isl-sheet">
      <div className="mgp-row">
        {/* ---------- centro: indicadores, informação da etapa e decisão ---------- */}
        <div className="mgp-mid">
          <dl className="mgp-kpi">
            <div>
              <dt>Seguidores</dt>
              <dd>{formatFollowers(inf.followers)}</dd>
            </div>
            <div>
              <dt>Engajamento</dt>
              <dd>{inf.engagement ? formatEngagement(inf.engagement) : "—"}</dd>
            </div>
            {inf.nicheName ? (
              <div>
                <dt>Nicho</dt>
                <dd>{inf.nicheName}</dd>
              </div>
            ) : null}
            {since ? (
              <div>
                <dt>Inscrito em</dt>
                <dd>{fullDate(since)}</dd>
              </div>
            ) : null}
            {late ? (
              <div className="late">
                <dt>Atraso</dt>
                <dd>{idle} dias sem avanço</dd>
              </div>
            ) : null}
          </dl>

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
            <div className="mgp-btns">
              {rejected ? (
                <button type="button" className="btn out" onClick={onReconsider}>
                  <I n="refresh" cls="sm" />
                  Reconsiderar
                </button>
              ) : isSelectionColumn(column) ? null : (
                <button type="button" className="btn out dng" onClick={onReject}>
                  <I n="ban" cls="sm" />
                  Recusar
                </button>
              )}
              <button type="button" className="btn out" onClick={onChat}>
                <I n="msg" cls="sm" />
                Abrir chat
              </button>
              <button type="button" className="btn out" onClick={onProfile}>
                <I n="user" cls="sm" />
                Perfil completo
              </button>
            </div>
          </div>
        </div>

        {/* ---------- direita: últimas movimentações e controles do painel ---------- */}
        <aside className="mgp-hist" aria-label="Últimas movimentações">
          <div className="mgp-hh">
            <h5>Últimas movimentações</h5>
          </div>
          {recent.length === 0 ? (
            <p className="mgp-empty">Sem movimentações registradas.</p>
          ) : (
            <ol className="mgp-log">
              {recent.map((h, k) => {
                const actor = historyActor(h.source);
                return (
                  <li key={h.id} className={k === 0 ? "cur" : ""}>
                    <b>{COLUMN_LABEL[h.status] ?? h.status}</b>
                    <small>
                      {when(h.timestamp)}
                      {actor ? ` · ${actor}` : ""}
                    </small>
                  </li>
                );
              })}
            </ol>
          )}
          {total > RECENT && !expanded ? (
            <button type="button" className="lnk" onClick={onToggleExpanded}>
              Ver histórico completo ({total})
            </button>
          ) : null}
        </aside>
      </div>

      {expanded ? (
        <div className="mgp-more">
          {nets.length > 0 ? (
            <section className="mgp-ms" aria-label="Redes e perfis">
              <h5>Redes e perfis</h5>
              <ul>
                {nets.map((n) => (
                  <li key={n.id}>
                    <b>{getNetworkLabel(n.type, n.type)}</b>
                    {n.username ? <span>@{n.username}</span> : null}
                    {typeof n.members === "number" && n.members > 0 ? <span>{formatFollowers(n.members)} seguidores</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {negotiation && !negotiationInline ? (
            <section className="mgp-ms" aria-label="Proposta e financeiro">
              <h5>Proposta e financeiro</h5>
              {negotiation}
            </section>
          ) : null}
          {older.length > 0 ? (
            <section className="mgp-ms mgp-full" aria-label="Histórico anterior">
              <h5>Histórico anterior ({older.length})</h5>
              <ol className="mgp-log mgp-logf">
                {older.map((h) => {
                  const actor = historyActor(h.source);
                  return (
                    <li key={h.id}>
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
            </section>
          ) : null}
        </div>
      ) : null}
        </div>
       </div>
      </div>
    </section>
  );
}

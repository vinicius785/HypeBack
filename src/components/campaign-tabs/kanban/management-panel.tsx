import { Av, I } from "@/components/prototype/ui";
import { ACTION_LABEL, COLUMN_LABEL, HOT_COLUMNS, STAGE_SHORT, stageOf } from "../campaign-flow";
import type { ExtendedInfluencer } from "../management-kanban-config";
import { ContentPanelActions, isContentColumn } from "../shared/content-panel-actions";
import { PriceNegotiationSection } from "../shared/price-negotiation-section";
import type { CampaignPhaseForCost } from "../shared/prices-utils";
import { ScriptPanelActions, isScriptColumn } from "../shared/script-panel-actions";
import { SelectionPanelActions, isSelectionColumn, type SelectionColumn } from "../shared/selection-panel-actions";
import { ShipmentPanelActions, isShipmentColumn } from "../shared/shipment-panel-actions";
import { fullDate } from "./card-info";
import { idToString } from "../management-kanban-config";
import { panelNeighbours, rejectionReason } from "./panel-nav";
import { PanelFinancial, PanelHistory, PanelNetworks, PanelPerformance, PanelSection } from "./panel-sections";

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

/**
 * Painel superior do Gerenciamento: faz parte do layout (acima do quadro, sem sobrepor), mostra o criador selecionado e
 * muda o que mostra e as ações conforme a etapa em que ele está. A lógica de cada ação continua nos componentes de
 * `shared/` (seleção, roteiro, conteúdo, envio, negociação); aqui só se organiza a tela.
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
  const id = idToString(inf.id);
  const influencerId = String(inf.user_id ?? inf.id);
  const nav = panelNeighbours(orderedIds, id);
  const stage = stageOf(column);
  const rejected = column === "rejected";
  const reason = rejected ? rejectionReason(inf.statusHistory) : null;
  const hot = HOT_COLUMNS.includes(column);

  return (
    <section
      className={`side2 mgp pf${expanded ? " big" : ""}`}
      aria-label={`Detalhes de ${inf.name}`}
      data-testid="management-panel"
    >
      <header className="mgp-h">
        <Av name={inf.name} src={inf.avatar} size={44} />
        <div className="mgp-t">
          <h2>
            {inf.name}
            {inf.isExternal ? <em className="ext">Externo</em> : null}
          </h2>
          <p>
            {inf.username ? `@${inf.username}` : "Sem usuário"}
            {stage ? <span> · {STAGE_SHORT[stage[0]]}</span> : null}
          </p>
        </div>
        <span className={`pill ${hot ? "" : "p"}`}>{COLUMN_LABEL[column] ?? column}</span>
        <div className="mgp-act">
          <button type="button" className="btn out sm" onClick={onChat}>
            <I n="msg" cls="sm" />
            <span>Abrir chat</span>
          </button>
          <button type="button" className="btn out sm" onClick={onProfile}>
            <I n="user" cls="sm" />
            <span>Perfil completo</span>
          </button>
        </div>
        <div className="mgp-nav" role="group" aria-label="Navegar entre criadores">
          <button
            type="button"
            className="round"
            aria-label="Criador anterior"
            disabled={!nav.prevId}
            onClick={() => nav.prevId && onSelect(nav.prevId)}
          >
            <I n="chevl" cls="sm" />
          </button>
          <span aria-live="polite">{nav.position > 0 ? `${nav.position} de ${nav.total}` : `${nav.total} no quadro`}</span>
          <button
            type="button"
            className="round"
            aria-label="Próximo criador"
            disabled={!nav.nextId}
            onClick={() => nav.nextId && onSelect(nav.nextId)}
          >
            <I n="chev" cls="sm" />
          </button>
          <button
            type="button"
            className="round"
            aria-label={expanded ? "Recolher detalhes" : "Expandir detalhes"}
            aria-expanded={expanded}
            onClick={onToggleExpanded}
          >
            <I n={expanded ? "shrink" : "expand"} cls="sm" />
          </button>
          <button type="button" className="round" aria-label="Fechar detalhes" onClick={onClose}>
            <I n="x" cls="sm" />
          </button>
        </div>
      </header>

      <div className="mgp-b">
        <div className="mgp-c">
          <PanelPerformance inf={inf} />
          <PanelNetworks inf={inf} late={late} idle={idle} />
        </div>

        {inf.price_negotiation ? (
          <div className="mgp-c">
            <PanelFinancial inf={inf}>
              <PriceNegotiationSection
                campaignId={campaignId}
                userId={inf.user_id}
                status={inf.status}
                negotiation={inf.price_negotiation}
              />
            </PanelFinancial>
          </div>
        ) : null}

        <div className="mgp-c mgp-dec">
          <PanelSection title={rejected ? "Recusa" : "Decisão"}>
            <div className="drw-b">
              {rejected ? (
                <div className="mgp-why">
                  <b>Motivo da recusa</b>
                  <p>{reason ? reason.notes : "Nenhum motivo foi registrado."}</p>
                  {reason ? <small>{fullDate(new Date(reason.timestamp))}</small> : null}
                </div>
              ) : null}
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
                  influencer={{ id: id, name: inf.name, username: inf.username, avatar: inf.avatar }}
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
            </div>
          </PanelSection>
        </div>

        <div className="mgp-c">
          <PanelHistory inf={inf} />
        </div>
      </div>
    </section>
  );
}

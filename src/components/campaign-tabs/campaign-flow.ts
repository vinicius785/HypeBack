import type { CampaignManagementParticipant } from "@/shared/services/campaign-management";
import { boardColumnOf, mapUserStatusToKanbanColumn } from "./management-status-map";

/**
 * Rótulos por STATUS do cartão (granularidade fina: painel do card, histórico). Nomeados por função: o status `script_pending` é
 * a aprovação do ROTEIRO e o `pending_approval` é a revisão do CONTEÚDO (ver `boardColumnOf` em management-status-map.ts).
 * O título das COLUNAS do quadro está em `BOARD_LABEL`.
 */
export const COLUMN_LABEL: Record<string, string> = {
  applications: "Inscrições",
  pre_selection: "Pré-seleção",
  pre_selection_curation: "Curadoria pré-seleção",
  curation: "Curadoria",
  invited: "Convidados",
  price_proposed: "Proposta enviada",
  price_countered: "Contraproposta recebida",
  contract_pending: "Contrato pendente",
  approved: "Aprovado / Em andamento",
  script_pending: "Roteiro: aguardando aprovação",
  script_correction: "Roteiro em correção",
  awaiting_shipment: "Aguardando envio",
  awaiting_receipt: "Aguardando recebimento",
  content_pending: "Aguardando conteúdo",
  pending_approval: "Revisão do conteúdo: aguardando aprovação",
  in_correction: "Conteúdo em correção",
  content_approved: "Conteúdo aprovado",
  payment_pending: "Aguardando pagamento",
  published: "Publicado",
  rejected: "Recusados",
};

/** Título de cada coluna do QUADRO (as que reúnem vários status têm nome de função). */
export const BOARD_LABEL: Record<string, string> = {
  applications: "Inscrições",
  pre_selection: "Pré-seleção",
  curation: "Curadoria",
  invited: "Convidados",
  price_proposed: "Proposta enviada",
  price_countered: "Contraproposta recebida",
  contract_pending: "Contrato pendente",
  approved: "Aprovado (aguardando roteiro)",
  script_pending: "Roteiro",
  awaiting_shipment: "Aguardando envio",
  awaiting_receipt: "Aguardando recebimento",
  content_pending: "Gravando",
  pending_approval: "Revisão do conteúdo",
  content_approved: "Pronto para publicar",
  payment_pending: "Aguardando pagamento",
  published: "Concluído",
  rejected: "Recusados",
};

/** Status em que a vez é do criador ajustar (roteiro ou conteúdo recusado): são "secundários" das colunas Roteiro e Revisão. */
export const CREATOR_ADJUSTING = ["script_correction", "in_correction"];

export const HOT_COLUMNS = [
  "price_countered",
  "rejected",
  "script_correction",
  "in_correction",
];

/**
 * A coluna do quadro chama atenção? `price_countered` e `rejected` sempre; Roteiro e Revisão do conteúdo quando há criador
 * ajustando. `statuses` são os status finos dos cartões que estão na coluna.
 */
export function isHotBoardColumn(columnId: string, statuses: readonly string[]): boolean {
  if (columnId === "price_countered" || columnId === "rejected") return true;
  if (columnId === "script_pending" || columnId === "pending_approval") {
    return statuses.some((s) => CREATOR_ADJUSTING.includes(s));
  }
  return false;
}

export type StageKey = "sel" | "con" | "rot" | "env" | "cont" | "pag" | "rec";

/** Grupos de colunas por etapa da campanha. */
export const STAGES: Array<[StageKey, string, string[]]> = [
  ["sel", "Seleção", ["applications", "pre_selection", "curation", "invited"]],
  ["con", "Proposta e contrato", ["price_proposed", "price_countered", "contract_pending"]],
  ["rot", "Roteiros", ["approved", "script_pending"]],
  ["env", "Envio", ["awaiting_shipment", "awaiting_receipt"]],
  ["cont", "Conteúdo", ["content_pending", "pending_approval", "content_approved"]],
  ["pag", "Pagamento", ["payment_pending", "published"]],
  ["rec", "Recusados", ["rejected"]],
];

export const STAGE_SHORT: Record<StageKey, string> = {
  sel: "Seleção",
  con: "Proposta",
  rot: "Roteiros",
  env: "Envio",
  cont: "Conteúdo",
  pag: "Pagamento",
  rec: "Recusados",
};

/** Colunas em que a próxima ação é do gestor. */
export const NEEDME = [
  "applications",
  "pre_selection_curation",
  "curation",
  "price_countered",
  "script_pending",
  "pending_approval",
  "awaiting_shipment",
  "payment_pending",
];

/** Colunas em que o criador pode estar atrasado. */
export const LATE_COLUMNS = ["script_correction", "content_pending", "awaiting_receipt"];
export const LATE_AFTER_DAYS = 3;

/** Etiquetas de quem tem a vez em Roteiro e Revisão do conteúdo (colunas que reúnem "aguardando aprovação" e "criador ajustando"). */
export const NEEDS_YOU_TAG = "Precisa de você";
export const CREATOR_ADJUSTING_TAG = "Criador ajustando";

export const WAITING: Record<string, string> = {
  pre_selection: "Aguardando decisão",
  invited: "Aguardando resposta",
  price_proposed: "Aguardando criador",
  contract_pending: "Aguardando assinatura",
  approved: "Preparando roteiro",
  script_correction: "Criador ajustando",
  awaiting_receipt: "Aguardando criador",
  content_pending: "Gravando",
  in_correction: "Criador ajustando",
  content_approved: "Pronto para publicar",
  published: "Publicado e pago",
  rejected: "Recusado",
};

/** Texto do botão de ação do card, por coluna. */
export const ACTION_LABEL: Record<string, string> = {
  applications: "Pré-selecionar",
  pre_selection_curation: "Curar",
  curation: "Convidar",
  price_countered: "Responder",
  contract_pending: "Ver contrato",
  script_pending: "Revisar roteiro",
  awaiting_shipment: "Marcar enviado",
  pending_approval: "Revisar conteúdo",
};

/** Fluxos (telas de trabalho) que existem fora do quadro. */
export type FlowId = "selection";

/** Para onde cada ação do card leva. `contracts` é uma sub-aba de Gestão. */
export const ACTION_TARGET: Record<string, FlowId | "contracts"> = {
  contract_pending: "contracts",
};

export const STAGE_OF_TILE: Record<string, StageKey> = {
  scr: "rot",
  cont: "cont",
  cur: "sel",
  prop: "con",
  apps: "sel",
  ship: "env",
  pay: "pag",
};

export interface FlowParticipant {
  raw: CampaignManagementParticipant;
  column: string;
  /** Dias desde a última mudança de status (undefined se sem histórico). */
  idleDays?: number;
}

export function toFlowParticipants(
  participants: CampaignManagementParticipant[],
): FlowParticipant[] {
  const now = Date.now();
  return participants.map((raw) => {
    const last = (raw.status_history ?? [])
      .map((h) => new Date(h.timestamp).getTime())
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => b - a)[0];
    return {
      raw,
      column: mapUserStatusToKanbanColumn(raw.status || "applications"),
      idleDays:
        last === undefined ? undefined : Math.floor((now - last) / 86_400_000),
    };
  });
}

export const isLate = (p: FlowParticipant) =>
  LATE_COLUMNS.includes(p.column) && (p.idleDays ?? 0) >= LATE_AFTER_DAYS;

export const lateLabel = (p: FlowParticipant) =>
  `${p.idleDays} ${p.idleDays === 1 ? "dia" : "dias"} sem avanço`;

/** Etapa de uma coluna do quadro OU de um status fino (um status secundário cai na etapa da coluna que o reúne). */
export const stageOf = (column: string) =>
  STAGES.find((s) => s[2].includes(boardColumnOf(column)));

export function formatFollowers(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

export function formatEngagement(n: number): string {
  return `${(n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

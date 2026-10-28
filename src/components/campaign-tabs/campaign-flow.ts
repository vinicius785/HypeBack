import type { CampaignManagementParticipant } from "@/shared/services/campaign-management";
import { mapUserStatusToKanbanColumn } from "./management-status-map";

/** Rótulos das colunas do kanban (idênticos ao protótipo). */
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
  script_pending: "Aguardando aprovação do roteiro",
  script_correction: "Roteiro em correção",
  awaiting_shipment: "Aguardando envio",
  awaiting_receipt: "Aguardando recebimento",
  content_pending: "Aguardando conteúdo",
  pending_approval: "Aguardando aprovação do conteúdo",
  in_correction: "Em correção",
  content_approved: "Conteúdo aprovado",
  payment_pending: "Aguardando pagamento",
  published: "Publicado",
  rejected: "Recusados",
};

export const HOT_COLUMNS = [
  "price_countered",
  "rejected",
  "script_correction",
  "in_correction",
];

export type StageKey = "sel" | "con" | "rot" | "env" | "cont" | "pag" | "rec";

/** Grupos de colunas por etapa da campanha. */
export const STAGES: Array<[StageKey, string, string[]]> = [
  ["sel", "Seleção", ["applications", "pre_selection", "pre_selection_curation", "curation", "invited"]],
  ["con", "Proposta e contrato", ["price_proposed", "price_countered", "contract_pending"]],
  ["rot", "Roteiros", ["approved", "script_pending", "script_correction"]],
  ["env", "Envio", ["awaiting_shipment", "awaiting_receipt"]],
  ["cont", "Conteúdo", ["content_pending", "pending_approval", "in_correction", "content_approved"]],
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
  payment_pending: "Pagar",
};

/** Fluxos (telas de trabalho) que existem fora do quadro. */
export type FlowId =
  | "selection"
  | "proposals"
  | "applications"
  | "curation"
  | "script-approval"
  | "shipment"
  | "approval";

/** Para onde cada ação do card leva. `contracts` é uma sub-aba de Gestão. */
export const ACTION_TARGET: Record<string, FlowId | "contracts"> = {
  applications: "applications",
  pre_selection_curation: "curation",
  curation: "curation",
  price_countered: "proposals",
  contract_pending: "contracts",
  script_pending: "script-approval",
  awaiting_shipment: "shipment",
  pending_approval: "approval",
  payment_pending: "approval",
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

export const stageOf = (column: string) =>
  STAGES.find((s) => s[2].includes(column));

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

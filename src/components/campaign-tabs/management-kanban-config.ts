import type { Influencer } from "@/shared/types";
import type { CampaignManagementParticipant } from "@/shared/services/campaign-management";
import { mapUserStatusToKanbanColumn } from "./management-status-map";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface StatusHistory {
  id: string;
  status: string;
  timestamp: string;
  notes?: string;
}

export interface ExtendedInfluencer extends Omit<Influencer, "id" | "user_id"> {
  id: string | number;
  /** ID do usuário na plataforma (rota /influencer/$influencerId) */
  user_id?: string | number;
  /** Criador externo (pré-cadastro via link público / link de premiação) — badge "Externo" (#17/#31). */
  isExternal?: boolean;
  socialNetwork?: string;
  social_networks?: Array<{
    id: number | string;
    type: string;
    name: string;
    username?: string;
    members?: number;
  }>;
  statusHistory?: StatusHistory[];
  /** Fase atual do influenciador na campanha, quando a API informa (#6). */
  phase?: string;
}

// ---------------------------------------------------------------------------
// Configuração das colunas do Kanban
// ---------------------------------------------------------------------------

export const kanbanColumns = [
  { id: "applications", label: "Inscrições", color: "bg-[#f5f5f5]" },
  { id: "pre_selection", label: "Pré-seleção", color: "bg-[#faf5ff]" },
  { id: "pre_selection_curation", label: "Curadoria pré-seleção", color: "bg-[#f2e2ff]" },
  { id: "curation", label: "Curadoria", color: "bg-[#f0f6ff]" },
  { id: "invited", label: "Convidados", color: "bg-[#fdfce9]" },
  { id: "price_proposed", label: "Proposta enviada", color: "bg-[#f5f3ff]" },
  { id: "price_countered", label: "Contraproposta recebida", color: "bg-[#fff1f2]", highlight: true },
  { id: "contract_pending", label: "Contrato Pendente", color: "bg-[#f1fdfa]" },
  { id: "approved", label: "Aprovado / Em Andamento", color: "bg-[#f1fdf4]" },
  { id: "script_pending", label: "Aguardando Aprovação Roteiro", color: "bg-[#eff2ff]" },
  { id: "script_correction", label: "Roteiro em Correção", color: "bg-[#fdeeea]" },
  { id: "awaiting_shipment", label: "Aguardando Envio", color: "bg-[#fff7ed]" },
  { id: "awaiting_receipt", label: "Aguardando Recebimento", color: "bg-[#fef3c7]" },
  { id: "content_pending", label: "Aguardando Conteúdo", color: "bg-[#fefbeb]" },
  { id: "pending_approval", label: "Aguardando Aprovação Conteúdo", color: "bg-[#fef7ed]" },
  { id: "in_correction", label: "Em Correção", color: "bg-[#fcf9c3]" },
  { id: "content_approved", label: "Conteúdo Aprovado", color: "bg-[#faf5ff]" },
  { id: "payment_pending", label: "Aguardando Pagamento", color: "bg-[#eefeff]" },
  { id: "published", label: "Publicado", color: "bg-[#f1fdf5]" },
  { id: "rejected", label: "Recusados", color: "bg-[#fdf2f2]", highlight: true },
] as const;

/** Tipo normalizado de coluna — `highlight` é opcional para evitar erros de union. */
export type KanbanColumn = {
  id: string;
  label: string;
  color: string;
  highlight?: boolean;
};

/**
 * Colunas exclusivas do fluxo de permuta (envio físico de produto).
 * Devem ser ocultadas em campanhas com outras modalidades de pagamento.
 */
const SHIPMENT_COLUMN_IDS: ReadonlySet<string> = new Set([
  "awaiting_shipment",
  "awaiting_receipt",
]);

/**
 * Retorna as colunas do Kanban aplicáveis à modalidade da campanha.
 * Permuta (`swap` / `exchange`) → todas. Demais → sem etapas de envio.
 */
export function getKanbanColumnsForPaymentType(
  paymentType?: string | null,
): readonly KanbanColumn[] {
  const isSwap = paymentType === "swap" || paymentType === "exchange";
  if (isSwap) return kanbanColumns;
  return kanbanColumns.filter((c) => !SHIPMENT_COLUMN_IDS.has(c.id));
}

/**
 * Resolve a coluna do Kanban de um participante a partir do status atual e do
 * histórico — espelha `getCurrentStatus` do ManagementTab, mas de forma pura,
 * para calcular ocupação de colunas sem depender do estado do componente.
 */
export function resolveParticipantColumnId(
  p: Pick<CampaignManagementParticipant, "status" | "status_history">,
): string {
  if (p.status) {
    const mapped = mapUserStatusToKanbanColumn(p.status);
    if (mapped !== "applications" || !p.status_history?.length) {
      return mapped;
    }
  }
  const history = p.status_history;
  if (history?.length) {
    const mostRecent = [...history].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )[0];
    return mapUserStatusToKanbanColumn(mostRecent.status);
  }
  return "applications";
}

/**
 * Garante que nenhum card desapareça do Kanban: parte das colunas da modalidade
 * (`getKanbanColumnsForPaymentType`) e RE-INCLUI qualquer coluna do catálogo
 * completo que tenha ao menos um participante — por exemplo, uma etapa de envio
 * ocupada numa campanha que deixou de ser permuta. Preserva a ordem do catálogo.
 */
export function getVisibleKanbanColumns(
  paymentType: string | null | undefined,
  participants: ReadonlyArray<
    Pick<CampaignManagementParticipant, "status" | "status_history">
  > | null
  | undefined,
): readonly KanbanColumn[] {
  const base = getKanbanColumnsForPaymentType(paymentType);
  if (!participants?.length) return base;

  const baseIds = new Set(base.map((c) => c.id));
  const occupied = new Set(participants.map(resolveParticipantColumnId));
  const hasHiddenOccupied = kanbanColumns.some(
    (c) => !baseIds.has(c.id) && occupied.has(c.id),
  );
  if (!hasHiddenOccupied) return base;

  return kanbanColumns.filter((c) => baseIds.has(c.id) || occupied.has(c.id));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const idToString = (id: string | number): string =>
  typeof id === "number" ? String(id) : id;

export function participantToExtended(p: CampaignManagementParticipant): ExtendedInfluencer {
  const chronological = [...(p.status_history || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const statusHistory = chronological.map((h) => ({
    id: String(h.id),
    status: mapUserStatusToKanbanColumn(h.status),
    timestamp: h.timestamp,
    notes: h.notes,
  }));
  const primaryNetwork = p.social_network || p.social_networks?.[0]?.type;
  return {
    id: p.id,
    user_id: p.user_id,
    name: p.name,
    username: p.username || "",
    avatar: p.avatar || "",
    followers: p.followers ?? 0,
    engagement: p.engagement ?? 0,
    niche: p.niche || "",
    nicheName: p.nicheName,
    status: (p.status || "applications") as Influencer["status"],
    isExternal: p.is_external === true,
    price_negotiation: p.price_negotiation ?? null,
    social_networks: p.social_networks,
    socialNetwork: primaryNetwork,
    statusHistory,
    phase: p.phase,
  };
}

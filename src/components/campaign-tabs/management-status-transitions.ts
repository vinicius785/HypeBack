/**
 * Regras de transição de status do kanban de gerenciamento de campanha.
 *
 * Extraído de management-tab.tsx para isolar a lógica de estado
 * do componente de UI.
 */

/** Mapa de transições válidas para influenciadores (não-usuários da campanha). */
const VALID_TRANSITIONS: Record<string, string[]> = {
  applications: ["pre_selection", "curation", "invited", "rejected"],
  pre_selection: ["pre_selection_curation", "curation", "rejected"],
  pre_selection_curation: ["curation", "invited", "approved", "rejected"],
  curation: ["invited", "approved", "rejected"],
  invited: ["contract_pending", "rejected"],
  contract_pending: ["approved", "rejected"],
  approved: ["script_pending", "rejected"],
  script_pending: ["awaiting_shipment", "content_pending", "rejected"],
  script_correction: ["script_pending", "rejected"],
  awaiting_shipment: ["awaiting_receipt", "rejected"],
  awaiting_receipt: ["content_pending", "rejected"],
  content_pending: ["pending_approval", "rejected"],
  pending_approval: ["content_approved", "in_correction"],
  in_correction: ["pending_approval"],
  content_approved: ["payment_pending", "published"],
  payment_pending: ["published"],
  published: [],
  rejected: [],
  // compatibilidade com valores legados da API
  inscriptions: ["curation", "invited", "rejected"],
  approved_progress: ["pending_approval", "rejected"],
  awaiting_approval: ["content_approved", "in_correction"],
};

/** Status que não podem ser movidos manualmente pelo backoffice. */
const AUTOMATIC_STATUSES = new Set([
  "pending_approval",
  // Roteiro reprovado (#29): resolve automaticamente quando o influenciador
  // reenvia o roteiro (volta a "Aguardando Aprovação Roteiro").
  "script_correction",
  "in_correction",
  "content_approved",
  "payment_pending",
  "published",
]);

/** Transições válidas para usuários da campanha (movimento manual pelo backoffice). */
const USER_VALID_TRANSITIONS: Record<string, string[]> = {
  applications: ["pre_selection", "curation", "invited", "rejected"],
  pre_selection: ["pre_selection_curation", "curation", "rejected"],
  pre_selection_curation: ["curation", "invited", "approved", "rejected"],
  curation: ["invited", "approved", "rejected"],
  invited: ["contract_pending", "rejected"],
  contract_pending: ["approved", "rejected"],
  approved: ["script_pending", "curation", "rejected"],
  script_pending: ["awaiting_shipment", "content_pending", "rejected"],
  script_correction: ["rejected"],
  awaiting_shipment: ["awaiting_receipt", "rejected"],
  awaiting_receipt: ["content_pending", "rejected"],
  content_pending: ["rejected"],
  rejected: ["applications", "curation"],
  // compatibilidade
  inscriptions: ["curation", "invited", "rejected"],
  approved_progress: ["curation", "rejected"],
};

/** Notas de auditoria para cada transição de status. */
const TRANSITION_NOTES: Record<string, string> = {
  // applications
  "applications->pre_selection": "Movido para pré-seleção",
  "applications->pre_selection_curation": "Movido para curadoria da pré-seleção",
  "applications->curation": "Movido para curadoria",
  "applications->invited": "Convidado diretamente das inscrições",
  "applications->rejected": "Recusado",
  // pre_selection
  "pre_selection->pre_selection_curation": "Movido para curadoria da pré-seleção",
  "pre_selection->curation": "Movido para curadoria",
  "pre_selection->rejected": "Recusado",
  // pre_selection_curation
  "pre_selection_curation->curation": "Movido para curadoria",
  "pre_selection_curation->invited": "Convidado após curadoria da pré-seleção",
  "pre_selection_curation->approved": "Aprovado após curadoria da pré-seleção",
  "pre_selection_curation->rejected": "Recusado",
  // curation
  "curation->invited": "Convidado após curadoria",
  "curation->approved": "Aprovado após curadoria",
  "curation->rejected": "Recusado após curadoria",
  // invited
  "invited->contract_pending": "Contrato pendente",
  "invited->rejected": "Recusou o convite",
  // contract_pending
  "contract_pending->approved": "Contrato aprovado",
  "contract_pending->rejected": "Contrato recusado",
  // approved
  "approved->script_pending": "Aguardando aprovação de roteiro",
  "approved->rejected": "Removido da campanha",
  "approved->curation": "Movido para curadoria",
  // script_correction (#18: reprovação de roteiro tem coluna própria)
  "script_pending->script_correction": "Roteiro reprovado, aguardando correção",
  "script_correction->script_pending": "Novo roteiro enviado após correção",
  "script_correction->rejected": "Removido da campanha",
  // script_pending
  "script_pending->awaiting_shipment": "Roteiro aprovado, produto sendo enviado ao influenciador",
  "script_pending->content_pending": "Roteiro aprovado, aguardando conteúdo",
  "script_pending->rejected": "Roteiro recusado",
  // awaiting_shipment
  "awaiting_shipment->awaiting_receipt": "Produto enviado, aguardando confirmação de recebimento",
  "awaiting_shipment->rejected": "Removido da campanha",
  // awaiting_receipt
  "awaiting_receipt->content_pending": "Produto recebido, aguardando conteúdo",
  "awaiting_receipt->rejected": "Removido da campanha",
  // content_pending
  "content_pending->pending_approval": "Conteúdo enviado para aprovação",
  "content_pending->rejected": "Recusado",
  // pending_approval
  "pending_approval->content_approved": "Conteúdo aprovado",
  "pending_approval->in_correction": "Conteúdo recusado, aguardando correção",
  // in_correction
  "in_correction->pending_approval": "Novo conteúdo enviado após correção",
  // content_approved
  "content_approved->payment_pending": "Aguardando pagamento",
  "content_approved->published": "Publicação identificada pelo bot",
  // payment_pending
  "payment_pending->published": "Pagamento processado, conteúdo publicado",
  // rejected (reativação)
  "rejected->applications": "Reativado - movido para inscrições",
  "rejected->curation": "Reativado - movido para curadoria",
  // legados
  "inscriptions->approved": "Aprovado",
  "inscriptions->approved_progress": "Aprovado",
  "inscriptions->rejected": "Recusado",
  "inscriptions->curation": "Movido para curadoria",
  "curation->approved_progress": "Aprovado após curadoria",
  "invited->approved_progress": "Aceitou o convite",
  "approved_progress->pending_approval": "Conteúdo enviado para aprovação",
  "approved_progress->awaiting_approval": "Conteúdo enviado para aprovação",
  "awaiting_approval->content_approved": "Conteúdo aprovado",
  "awaiting_approval->in_correction": "Conteúdo recusado, aguardando correção",
  "in_correction->awaiting_approval": "Novo conteúdo enviado",
};

export function validateStatusTransition(fromStatus: string, toStatus: string): boolean {
  return (VALID_TRANSITIONS[fromStatus] ?? []).includes(toStatus);
}

export function validateUserStatusTransition(fromStatus: string, toStatus: string): boolean {
  if (AUTOMATIC_STATUSES.has(toStatus)) return false;
  return (USER_VALID_TRANSITIONS[fromStatus] ?? []).includes(toStatus);
}

export function getTransitionNote(fromStatus: string, toStatus: string): string {
  return TRANSITION_NOTES[`${fromStatus}->${toStatus}`]
    ?? `Movido de ${fromStatus} para ${toStatus}`;
}

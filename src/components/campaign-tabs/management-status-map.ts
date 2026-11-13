/**
 * Mapeia valores de `status` da API para IDs das colunas do Kanban.
 * @see API_CAMPAIGN_MANAGEMENT.md
 */
export function mapUserStatusToKanbanColumn(status: string): string {
  const s = status.toLowerCase();
  const statusMap: Record<string, string> = {
    applications: "applications",
    pre_selection: "pre_selection",
    pre_selection_curation: "pre_selection_curation",
    curation: "curation",
    invited: "invited",
    price_proposed: "price_proposed",
    price_countered: "price_countered",
    contract_pending: "contract_pending",
    approved: "approved",
    pending_approval: "script_pending",
    awaiting_content: "content_pending",
    awaiting_content_approval: "pending_approval",
    in_correction: "in_correction",
    correction_script: "script_correction",
    content_approved: "content_approved",
    contents_confirmed: "content_approved",
    awaiting_publication: "content_approved",
    awaiting_shipment: "awaiting_shipment",
    awaiting_receipt: "awaiting_receipt",
    awaiting_payment: "payment_pending",
    published: "published",
    completed: "published",
    rejected: "rejected",
    contractpending: "contract_pending",
    script_pending: "script_pending",
    content_pending: "content_pending",
    awaitingcontent: "content_pending",
    awaitingcontentapproval: "pending_approval",
    awaitingpublication: "content_approved",
    awaitingpayment: "payment_pending",
    incorrection: "in_correction",
    correctionscript: "script_correction",
    script_correction: "script_correction",
  };
  return statusMap[s] || "applications";
}

/**
 * COLUNAS DO QUADRO x STATUS DA API (só apresentação: nenhum status gravado muda).
 *
 * `mapUserStatusToKanbanColumn` devolve o status "fino" do cartão (ele guia transições, ações do painel e etiquetas). O quadro
 * reúne alguns deles numa coluna só (`boardColumnOf`):
 *
 *   coluna do quadro        status da API que ela reúne
 *   ----------------------  ----------------------------------------------------------------
 *   curation  (Curadoria)   curation + pre_selection_curation
 *   script_pending (Roteiro)            pending_approval  (APROVAÇÃO DE ROTEIRO na API) + correction_script (criador ajustando)
 *   pending_approval (Revisão conteúdo) awaiting_content_approval (aprovação de CONTEÚDO) + in_correction (criador ajustando)
 *   content_pending (Gravando)          awaiting_content
 *   content_approved (Pronto p/ publicar) content_approved + contents_confirmed + awaiting_publication
 *   payment_pending                     awaiting_payment
 *   published (Concluído)               published + completed
 *
 * Atenção ao nome: o status "pending_approval" da API é a aprovação do ROTEIRO (coluna `script_pending`); o id de coluna
 * `pending_approval` é a revisão do CONTEÚDO (status `awaiting_content_approval`). No painel eles se chamam por função
 * (Roteiro / Revisão do conteúdo).
 */
const BOARD_COLUMN_OF_STATUS: Record<string, string> = {
  pre_selection_curation: "curation",
  script_correction: "script_pending",
  in_correction: "pending_approval",
};

/** Coluna do quadro em que um status "fino" aparece. Os status sem coluna própria entram na coluna que os reúne. */
export function boardColumnOf(statusId: string): string {
  return BOARD_COLUMN_OF_STATUS[statusId] ?? statusId;
}

/** O cartão está num status "secundário" (reunido numa coluna que tem outro status como principal)? */
export function isSecondaryStatus(statusId: string): boolean {
  return statusId in BOARD_COLUMN_OF_STATUS;
}

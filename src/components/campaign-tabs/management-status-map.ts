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

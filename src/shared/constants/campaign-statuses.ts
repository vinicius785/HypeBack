import type { CampaignContent, CampaignScript, Influencer } from "@/shared/types";

/** Status de conteúdos de campanha. */
export const CONTENT_STATUS = {
  PENDING: "pending",
  AWAITING_APPROVAL: "awaiting_approval",
  APPROVED: "approved",
  CONTENT_APPROVED: "content_approved",
  CORRECTION: "correction",
  REJECTED: "rejected",
  PUBLISHED: "published",
} as const satisfies Record<string, CampaignContent["status"]>;

/** Status de roteiros de campanha. */
export const SCRIPT_STATUS = {
  PENDING: "pending",
  AWAITING_APPROVAL: "awaiting_approval",
  APPROVED: "approved",
  CORRECTION: "correction",
  REJECTED: "rejected",
} as const satisfies Record<string, CampaignScript["status"]>;

/** Status de influenciadores em campanhas. */
export const INFLUENCER_STATUS = {
  APPLICATIONS: "applications",
  PRE_SELECTION: "pre_selection",
  PRE_SELECTION_CURATION: "pre_selection_curation",
  CURATION: "curation",
  INVITED: "invited",
  PRICE_PROPOSED: "price_proposed",
  PRICE_COUNTERED: "price_countered",
  CONTRACT_PENDING: "contract_pending",
  APPROVED: "approved",
  AWAITING_SHIPMENT: "awaiting_shipment",
  AWAITING_RECEIPT: "awaiting_receipt",
  SCRIPT_PENDING: "script_pending",
  CONTENT_PENDING: "content_pending",
  PENDING_APPROVAL: "pending_approval",
  IN_CORRECTION: "in_correction",
  CONTENT_APPROVED: "content_approved",
  PAYMENT_PENDING: "payment_pending",
  PUBLISHED: "published",
  REJECTED: "rejected",
} as const satisfies Record<string, NonNullable<Influencer["status"]>>;

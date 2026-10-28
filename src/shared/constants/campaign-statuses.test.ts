import { describe, it, expect } from "vitest";
import { CONTENT_STATUS, SCRIPT_STATUS, INFLUENCER_STATUS } from "./campaign-statuses";

describe("CONTENT_STATUS", () => {
  it("contém todos os 7 status esperados", () => {
    expect(CONTENT_STATUS.PENDING).toBe("pending");
    expect(CONTENT_STATUS.AWAITING_APPROVAL).toBe("awaiting_approval");
    expect(CONTENT_STATUS.APPROVED).toBe("approved");
    expect(CONTENT_STATUS.CONTENT_APPROVED).toBe("content_approved");
    expect(CONTENT_STATUS.CORRECTION).toBe("correction");
    expect(CONTENT_STATUS.REJECTED).toBe("rejected");
    expect(CONTENT_STATUS.PUBLISHED).toBe("published");
  });

  it("os valores são strings literais (não modificáveis)", () => {
    expect(typeof CONTENT_STATUS.PENDING).toBe("string");
  });
});

describe("SCRIPT_STATUS", () => {
  it("contém todos os 5 status esperados", () => {
    expect(SCRIPT_STATUS.PENDING).toBe("pending");
    expect(SCRIPT_STATUS.AWAITING_APPROVAL).toBe("awaiting_approval");
    expect(SCRIPT_STATUS.APPROVED).toBe("approved");
    expect(SCRIPT_STATUS.CORRECTION).toBe("correction");
    expect(SCRIPT_STATUS.REJECTED).toBe("rejected");
  });
});

describe("INFLUENCER_STATUS", () => {
  it("contém o status applications", () => {
    expect(INFLUENCER_STATUS.APPLICATIONS).toBe("applications");
  });

  it("contém approved e rejected", () => {
    expect(INFLUENCER_STATUS.APPROVED).toBe("approved");
    expect(INFLUENCER_STATUS.REJECTED).toBe("rejected");
  });

  it("contém todos os 19 status esperados", () => {
    expect(Object.values(INFLUENCER_STATUS)).toEqual([
      "applications",
      "pre_selection",
      "pre_selection_curation",
      "curation",
      "invited",
      "price_proposed",
      "price_countered",
      "contract_pending",
      "approved",
      "awaiting_shipment",
      "awaiting_receipt",
      "script_pending",
      "content_pending",
      "pending_approval",
      "in_correction",
      "content_approved",
      "payment_pending",
      "published",
      "rejected",
    ]);
  });
});

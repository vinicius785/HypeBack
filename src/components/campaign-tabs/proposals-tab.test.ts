import { describe, it, expect } from "vitest";
import { bucketOf } from "./proposals-tab";
import type { CampaignManagementParticipant } from "@/shared/services/campaign-management";

function make(
  partial: Partial<CampaignManagementParticipant>,
): CampaignManagementParticipant {
  return {
    id: "1",
    name: "Ana",
    username: "ana",
    avatar: "",
    followers: 0,
    engagement: 0,
    status_history: [],
    ...partial,
  } as CampaignManagementParticipant;
}

const neg = (price_status: string | null) => ({
  proposed_price_cents: 1000,
  counter_price_cents: null,
  agreed_price_cents: null,
  price_status,
  origin: "invite",
});

describe("bucketOf", () => {
  it("contraproposta do criador → ação da marca", () => {
    expect(bucketOf(make({ status: "price_countered", price_negotiation: neg("countered") }))).toBe(
      "action",
    );
  });

  it("proposta enviada → aguardando o criador", () => {
    expect(bucketOf(make({ status: "price_proposed", price_negotiation: neg("proposed") }))).toBe(
      "waiting",
    );
  });

  it("aceita ou recusada → finalizada", () => {
    expect(bucketOf(make({ status: "approved", price_negotiation: neg("accepted") }))).toBe("closed");
    expect(bucketOf(make({ status: "rejected", price_negotiation: neg("rejected") }))).toBe("closed");
  });

  it("cai no price_status quando o status do participante não é de preço", () => {
    // Ex.: já aprovado no kanban, mas a bola estava com a marca.
    expect(bucketOf(make({ status: "approved", price_negotiation: neg("countered") }))).toBe(
      "action",
    );
  });
});

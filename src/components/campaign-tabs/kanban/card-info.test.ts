import { describe, expect, it } from "vitest";

import type { ExtendedInfluencer } from "../management-kanban-config";
import { canRejectFromMenu, cardNote, enrolledAt, networkSummary } from "./card-info";

const base = {
  id: "1",
  name: "Ana",
  username: "ana",
  avatar: "",
  followers: 1000,
  engagement: 3,
  niche: "",
  status: "applications",
} as unknown as ExtendedInfluencer;

describe("cardNote", () => {
  it("atraso tem prioridade e pede atenção", () => {
    expect(cardNote(base, "content_pending", 5, true)).toEqual({ text: "5 dias sem avanço", tone: "warn" });
    expect(cardNote(base, "content_pending", 1, true)?.text).toBe("1 dia sem avanço");
  });
  it("mostra o valor em negociação só com dado da API", () => {
    const pn = {
      proposed_price_cents: 150000,
      counter_price_cents: 200000,
      agreed_price_cents: null,
      price_status: "countered",
      origin: null,
    };
    expect(cardNote({ ...base, price_negotiation: pn }, "price_countered", undefined, false)?.text).toMatch(
      /Contraproposta R\$\s?2\.000,00/,
    );
    expect(cardNote({ ...base, price_negotiation: pn }, "price_proposed", undefined, false)?.text).toMatch(
      /Proposta R\$\s?1\.500,00/,
    );
    expect(cardNote(base, "price_proposed", undefined, false)).toBeNull();
  });
  it("sinaliza métricas ausentes sem inventar números", () => {
    expect(cardNote({ ...base, followers: 0, engagement: 0 }, "applications", undefined, false)).toEqual({
      text: "Métricas ainda não disponíveis",
      tone: "warn",
    });
  });
  it("nas inscrições mostra a data de inscrição", () => {
    const inf = {
      ...base,
      statusHistory: [{ id: "a", status: "applications", timestamp: "2026-03-05T15:00:00Z" }],
    };
    expect(cardNote(inf, "applications", 2, false)?.text).toMatch(/^Inscrito em 05\/03$/);
    expect(enrolledAt(inf)).toBeInstanceOf(Date);
    expect(enrolledAt(base)).toBeNull();
  });
});

describe("networkSummary", () => {
  it("soma as redes extras", () => {
    expect(
      networkSummary({
        socialNetwork: "instagram",
        social_networks: [
          { id: 1, type: "instagram", name: "a" },
          { id: 2, type: "tiktok", name: "b" },
        ],
      }),
    ).toBe("Instagram +1");
    expect(networkSummary({ socialNetwork: "tiktok", social_networks: undefined })).toBe("TikTok");
    expect(networkSummary({ socialNetwork: undefined, social_networks: undefined })).toBe("");
  });
});

describe("menu do cartão", () => {
  it("não oferece Recusar onde a decisão é no painel, nem para quem já foi recusado", () => {
    expect(canRejectFromMenu("curation")).toBe(false);
    expect(canRejectFromMenu("applications")).toBe(false);
    expect(canRejectFromMenu("rejected")).toBe(false);
    expect(canRejectFromMenu("script_pending")).toBe(true);
  });
});

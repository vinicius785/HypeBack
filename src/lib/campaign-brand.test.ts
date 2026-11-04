import { describe, expect, it } from "vitest";

import { brandsByCampaignId, campaignBrand } from "./campaign-brand";

const agency = { name: "Você no Hype", photo: "/uploads/agencia.png" };

describe("campaignBrand", () => {
  it("campanha com marca usa o nome e a logo da marca, não os da agência", () => {
    expect(campaignBrand({ brand: { name: "Speediance", photo: "/uploads/speediance.png" } }, agency)).toEqual({
      name: "Speediance",
      photo: "/uploads/speediance.png",
    });
  });

  it("marca sem logo fica sem foto (o cartão mostra a inicial), nunca com a foto da agência", () => {
    expect(campaignBrand({ brand: { name: "Rodonaves", photo: null } }, agency)).toEqual({ name: "Rodonaves", photo: undefined });
  });

  it("campanha sem marca (ou fora de agência) mostra o workspace", () => {
    expect(campaignBrand({}, agency)).toBe(agency);
    expect(campaignBrand({ brand: null }, agency)).toBe(agency);
    expect(campaignBrand({ brand: { name: "", photo: "/x.png" } }, agency)).toBe(agency);
  });

  it("sem marca e sem workspace não há marca", () => {
    expect(campaignBrand({}, undefined)).toBeUndefined();
  });
});

describe("brandsByCampaignId", () => {
  it("indexa a marca de cada campanha pelo id e ignora as sem marca", () => {
    const map = brandsByCampaignId([
      { id: "c1", brand: { id: "b1", name: "Speediance", photo: "/s.png" } },
      { id: "c2", brand: null },
      { id: "c3" },
      { id: "c4", brand: { id: "b4", name: "", photo: null } },
    ]);
    expect([...map.keys()]).toEqual(["c1"]);
    expect(map.get("c1")).toEqual({ id: "b1", name: "Speediance", photo: "/s.png" });
  });
});

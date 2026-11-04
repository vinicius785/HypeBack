import { describe, expect, it } from "vitest";

import type { CampaignFormData } from "@/shared/types";

import { stepOk, wizardMissing } from "./config";

const base = {
  title: "T",
  description: "D",
  whatToDo: ["a"],
  whatNotToDo: ["b"],
  banner: "x.png",
  influencersCount: "5",
  paymentType: "fixed",
  phases: [{ id: "1", objective: "o", postDate: "2026-12-01", formats: ["reels"] }],
} as unknown as CampaignFormData;

describe("wizardMissing: marca da agência", () => {
  it("workspace de marca (sem brandRequired): nada pede marca", () => {
    expect(wizardMissing(base)).toEqual([]);
  });

  it("agência sem marca escolhida: pede 'Marca' no passo 1", () => {
    expect(wizardMissing({ ...base, brandRequired: true })).toEqual([{ step: 1, field: "brandId", label: "Marca" }]);
    expect(stepOk({ ...base, brandRequired: true }, 1)).toBe(false);
    expect(stepOk({ ...base, brandRequired: true }, 2)).toBe(true);
  });

  it("agência com marca escolhida: completo", () => {
    expect(wizardMissing({ ...base, brandRequired: true, brandId: "b1" })).toEqual([]);
  });

  it("marca só com espaços não vale", () => {
    expect(wizardMissing({ ...base, brandRequired: true, brandId: "  " })).toHaveLength(1);
  });
});

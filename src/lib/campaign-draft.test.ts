import { afterEach, describe, expect, it } from "vitest";

import { CAMPAIGN_DRAFT_KEY, discardCampaignDraft, readCampaignDraftSummary } from "./campaign-draft";

const save = (v: unknown) => localStorage.setItem(CAMPAIGN_DRAFT_KEY, typeof v === "string" ? v : JSON.stringify(v));

describe("rascunho da nova campanha", () => {
  afterEach(() => localStorage.clear());

  it("sem rascunho ou com JSON inválido devolve null", () => {
    expect(readCampaignDraftSummary("1")).toBeNull();
    save("{nope");
    expect(readCampaignDraftSummary("1")).toBeNull();
  });

  it("lê título e data do rascunho", () => {
    save({ savedAt: "2026-11-04T12:00:00Z", workspaceId: "w1", step: 4, data: { title: " Verão " } });
    expect(readCampaignDraftSummary("w1")).toEqual({ title: "Verão", savedAt: "2026-11-04T12:00:00Z", workspaceId: "w1" });
  });

  it("não mostra rascunho de outro workspace, mas aceita o antigo sem workspace", () => {
    save({ workspaceId: "w1", data: { title: "A" } });
    expect(readCampaignDraftSummary("w2")).toBeNull();
    save({ data: { title: "B" } });
    expect(readCampaignDraftSummary("w2")?.title).toBe("B");
  });

  it("descartar remove", () => {
    save({ data: { title: "C" } });
    discardCampaignDraft();
    expect(readCampaignDraftSummary()).toBeNull();
  });
});

import { afterEach, describe, expect, it } from "vitest";

import {
  CAMPAIGN_DRAFT_KEY,
  CAMPAIGN_DRAFTS_KEY,
  discardCampaignDraft,
  listCampaignDrafts,
  readCampaignDraft,
  saveCampaignDraft,
} from "./campaign-draft";

describe("rascunhos da nova campanha", () => {
  afterEach(() => localStorage.clear());

  it("sem rascunho ou com JSON inválido a lista vem vazia", () => {
    expect(listCampaignDrafts("1")).toEqual([]);
    localStorage.setItem(CAMPAIGN_DRAFTS_KEY, "{nope");
    expect(listCampaignDrafts("1")).toEqual([]);
  });

  it("pode haver vários: cada um com o seu id, e salvar de novo com o id atualiza em vez de duplicar", () => {
    const a = saveCampaignDraft({ workspaceId: "w1", step: 2, data: { title: " Verão " } });
    const b = saveCampaignDraft({ workspaceId: "w1", step: 3, data: { title: "Inverno" } });
    expect(a && b && a !== b).toBe(true);
    expect(listCampaignDrafts("w1").map((d) => d.title).sort()).toEqual(["Inverno", "Verão"]);

    saveCampaignDraft({ id: a, workspaceId: "w1", step: 4, data: { title: "Verão 2" } });
    expect(listCampaignDrafts("w1")).toHaveLength(2);
    expect(readCampaignDraft(a!)).toMatchObject({ title: "Verão 2", step: 4, data: { title: "Verão 2" } });
  });

  it("só mostra os rascunhos do workspace, mas aceita o antigo sem workspace", () => {
    saveCampaignDraft({ workspaceId: "w1", step: 1, data: { title: "A" } });
    saveCampaignDraft({ workspaceId: null, step: 1, data: { title: "B" } });
    expect(listCampaignDrafts("w2").map((d) => d.title)).toEqual(["B"]);
  });

  it("descartar remove só o indicado", () => {
    const a = saveCampaignDraft({ workspaceId: "w1", step: 1, data: { title: "A" } })!;
    saveCampaignDraft({ workspaceId: "w1", step: 1, data: { title: "B" } });
    discardCampaignDraft(a);
    expect(listCampaignDrafts("w1").map((d) => d.title)).toEqual(["B"]);
    expect(readCampaignDraft(a)).toBeNull();
  });

  it("migra o rascunho único antigo para a lista e apaga a chave antiga", () => {
    localStorage.setItem(
      CAMPAIGN_DRAFT_KEY,
      JSON.stringify({ savedAt: "2026-11-04T12:00:00Z", workspaceId: "w1", step: 4, data: { title: "Antigo" } }),
    );
    const [only] = listCampaignDrafts("w1");
    expect(only).toMatchObject({ title: "Antigo", savedAt: "2026-11-04T12:00:00Z", workspaceId: "w1" });
    expect(localStorage.getItem(CAMPAIGN_DRAFT_KEY)).toBeNull();
    expect(readCampaignDraft(only.id)?.step).toBe(4);
    expect(listCampaignDrafts("w1")).toHaveLength(1);
  });
});

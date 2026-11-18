import { describe, expect, it } from "vitest";

import type { PopupOptions } from "@/shared/popups.types";

import { buildPopupBody, clickRate, EMPTY_POPUP_DRAFT, fromInputValue, imageDimensionError, popupDraftErrors, priorityLevel, rewardBadge, rewardRange, toInputValue, validUntil } from "./popup-form";

const OPTIONS: PopupOptions = {
  themes: ["light", "dark"],
  icons: ["gift", "trophy"],
  screens_without_id: ["home", "wallet"],
  screens_with_id: [{ screen: "campaign_detail", id_field: "campaign_id" }],
  external_url_hosts: ["hypeapp.com.br"],
  reward_points: { min: 1, max: 100 },
};

const draft = (patch = {}) => ({ ...EMPTY_POPUP_DRAFT, title: "Bem-vindo", ...patch });

describe("popup-form", () => {
  it("o botão e a página de destino andam juntos (um sem o outro é erro)", () => {
    expect(popupDraftErrors(draft({ buttonLabel: "Ver carteira" }), OPTIONS).screen).toMatch(/página/);
    expect(popupDraftErrors(draft({ screen: "wallet" }), OPTIONS).buttonLabel).toMatch(/botão/);
    expect(popupDraftErrors(draft({ screen: "wallet", buttonLabel: "Ver carteira" }), OPTIONS)).toEqual({});
  });

  it("tela com id pede o item e link externo só aceita https dos domínios da API", () => {
    expect(popupDraftErrors(draft({ screen: "campaign_detail", buttonLabel: "Abrir" }), OPTIONS).targetId).toBeTruthy();
    expect(popupDraftErrors(draft({ screen: "external_url", buttonLabel: "Abrir", url: "http://hypeapp.com.br" }), OPTIONS).url).toMatch(/https/);
    expect(popupDraftErrors(draft({ screen: "external_url", buttonLabel: "Abrir", url: "https://outro.com" }), OPTIONS).url).toMatch(/hypeapp\.com\.br/);
    expect(popupDraftErrors(draft({ screen: "external_url", buttonLabel: "Abrir", url: "https://hypeapp.com.br/promo" }), OPTIONS)).toEqual({});
  });

  it("limites: título, texto, botão, prioridade, público de campanha", () => {
    const errors = popupDraftErrors(draft({ title: "x".repeat(81), body: "y".repeat(401), priority: "101", audience: "campaign" }), OPTIONS);
    expect(Object.keys(errors).sort()).toEqual(["body", "campaignId", "priority", "title"]);
    expect(popupDraftErrors(draft({ title: " " }), OPTIONS).title).toBeTruthy();
  });

  it("o destino sai no contrato (version 1) com o campo de id que a API indica", () => {
    const body = buildPopupBody(draft({ screen: "campaign_detail", targetId: "c1", buttonLabel: "Abrir" }), OPTIONS, "create");
    expect(body.target).toEqual({ version: 1, screen: "campaign_detail", campaign_id: "c1" });
    expect(buildPopupBody(draft({ screen: "external_url", url: "https://hypeapp.com.br/x", buttonLabel: "Abrir" }), OPTIONS, "create").target).toEqual({ version: 1, screen: "external_url", url: "https://hypeapp.com.br/x" });
  });

  it("na criação o vazio nem vai; na edição, ícone, imagem e botão esvaziados vão como null", () => {
    const create = buildPopupBody(draft(), OPTIONS, "create");
    expect(create).toEqual({ title: "Bem-vindo", theme: "light", audience: "all", priority: 50 });
    const edit = buildPopupBody(draft(), OPTIONS, "edit");
    expect(edit).toMatchObject({ icon: null, image_url: null, button_label: null, target: null, body: null, campaign_id: null });
  });

  it("o início é horário de Brasília na tela e UTC no envio; vale 1 dia", () => {
    expect(fromInputValue("2026-11-17T09:00")).toBe("2026-11-17T12:00:00.000Z");
    expect(toInputValue("2026-11-17T12:00:00.000Z")).toBe("2026-11-17T09:00");
    expect(fromInputValue("")).toBeNull();
    expect(validUntil("2026-11-17T09:00").toISOString()).toBe("2026-11-18T12:00:00.000Z");
    expect(buildPopupBody(draft({ startsAt: "2026-11-17T09:00" }), OPTIONS, "create").starts_at).toBe("2026-11-17T12:00:00.000Z");
  });

  it("taxa de clique: cliques ÷ vistos, e traço sem visualização", () => {
    expect(clickRate(120, 31)).toBe("25,8%");
    expect(clickRate(0, 0)).toBe("—");
  });

  it("imagem: só 16:9 (para o app não cortar) e com largura mínima", () => {
    expect(imageDimensionError(1600, 900)).toBeNull();
    expect(imageDimensionError(1280, 720)).toBeNull();
    expect(imageDimensionError(1604, 900)).toBeNull(); // dentro da folga de 2%
    expect(imageDimensionError(1000, 1000)).toMatch(/16:9/);
    expect(imageDimensionError(900, 1600)).toMatch(/16:9/);
    expect(imageDimensionError(800, 450)).toMatch(/pequena/);
    expect(imageDimensionError(0, 0)).toMatch(/dimensões/);
  });

  it("prioridade em três níveis: baixa, normal e alta (faixas do número da API)", () => {
    expect([0, 10, 33].map((n) => priorityLevel(n).key)).toEqual(["low", "low", "low"]);
    expect([34, 50, 66].map((n) => priorityLevel(n).key)).toEqual(["normal", "normal", "normal"]);
    expect([67, 90, 100].map((n) => priorityLevel(n).key)).toEqual(["high", "high", "high"]);
    expect(priorityLevel(EMPTY_POPUP_DRAFT.priority).key).toBe("normal");
  });

  it("Hype Points: faixa vem da API, só com botão e destino, e erro diz o que fazer", () => {
    const withButton = { screen: "wallet", buttonLabel: "Ver carteira" };
    expect(popupDraftErrors(draft({ ...withButton, rewardPoints: "50" }), OPTIONS)).toEqual({});
    expect(popupDraftErrors(draft({ ...withButton, rewardPoints: "0" }), OPTIONS).rewardPoints).toMatch(/1 a 100/);
    expect(popupDraftErrors(draft({ ...withButton, rewardPoints: "101" }), OPTIONS).rewardPoints).toMatch(/1 a 100/);
    expect(popupDraftErrors(draft({ ...withButton, rewardPoints: "5" }), { ...OPTIONS, reward_points: { min: 5, max: 20 } }).rewardPoints).toBeUndefined();
    expect(popupDraftErrors(draft({ ...withButton, rewardPoints: "30" }), { ...OPTIONS, reward_points: { min: 5, max: 20 } }).rewardPoints).toMatch(/5 a 20/);
    expect(popupDraftErrors(draft({ rewardPoints: "50" }), OPTIONS).rewardPoints).toMatch(/botão e página de destino/);
    expect(popupDraftErrors(draft({ ...withButton, rewardPoints: "50", rewardLabel: "x".repeat(31) }), OPTIONS).rewardLabel).toMatch(/30/);
    expect(rewardRange(undefined)).toEqual({ min: 1, max: 100 });
  });

  it("selo: o texto escolhido, ou +N Hype Points", () => {
    expect(rewardBadge("50", "")).toBe("+50 Hype Points");
    expect(rewardBadge(20, "  Ganhe 20  ")).toBe("Ganhe 20");
  });

  it("envio: prêmio vai com o selo; sem prêmio, na criação nem vai e na edição vai null", () => {
    const withButton = { screen: "wallet", buttonLabel: "Ver carteira" };
    expect(buildPopupBody(draft({ ...withButton, rewardPoints: "50", rewardLabel: "+50 Hype Points" }), OPTIONS, "create")).toMatchObject({ reward_points: 50, reward_label: "+50 Hype Points" });
    expect(buildPopupBody(draft({ ...withButton, rewardPoints: "50" }), OPTIONS, "create")).not.toHaveProperty("reward_label");
    const create = buildPopupBody(draft(withButton), OPTIONS, "create");
    expect(create).not.toHaveProperty("reward_points");
    expect(create).not.toHaveProperty("reward_label");
    expect(buildPopupBody(draft(withButton), OPTIONS, "edit")).toMatchObject({ reward_points: null, reward_label: null });
    // texto do selo sem pontos não vai
    expect(buildPopupBody(draft({ ...withButton, rewardLabel: "sobrou" }), OPTIONS, "edit")).toMatchObject({ reward_label: null });
  });
});

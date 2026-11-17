import { describe, expect, it } from "vitest";

import type { PopupOptions } from "@/shared/popups.types";

import { buildPopupBody, clickRate, EMPTY_POPUP_DRAFT, fromInputValue, imageDimensionError, popupDraftErrors, priorityLevel, toInputValue, validUntil } from "./popup-form";

const OPTIONS: PopupOptions = {
  themes: ["light", "dark"],
  icons: ["gift", "trophy"],
  screens_without_id: ["home", "wallet"],
  screens_with_id: [{ screen: "campaign_detail", id_field: "campaign_id" }],
  external_url_hosts: ["hypeapp.com.br"],
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
});

/**
 * Deep link das notificações para a página da campanha.
 *
 * Regressão coberta: ao abrir a campanha "a frio" (sem ela em cache), as abas
 * "Envios" e "Propostas" ainda não existem — dependem do `payment_method`. O
 * link não pode ser consumido nesse momento: antes ele caía em "Curadoria" (via
 * `focusCampaignUser`) e apagava a URL, e o usuário nunca chegava na aba pedida.
 */
import { describe, it, expect } from "vitest";

import type { Notification } from "@/shared/services/notifications";
import {
  decideIncomingCampaignDeepLink,
  resolveNotificationCampaignDeepLink,
  type IncomingCampaignDeepLink,
} from "./notification-navigation";

const ALWAYS_VISIBLE = [
  "dashboard",
  "selection",
  "applications",
  "curation",
  "management",
  "groups",
  "contracts",
  "script-approval",
  "approval",
  "metrics",
];

/** Abas visíveis antes de a campanha carregar: sem "Envios" nem "Propostas". */
const BEFORE_CAMPAIGN = new Set(ALWAYS_VISIBLE);
const SWAP_CAMPAIGN = new Set([...ALWAYS_VISIBLE, "shipment"]);
const INDIVIDUAL_PRICE_CAMPAIGN = new Set([...ALWAYS_VISIBLE, "proposals"]);

const link = (
  over: Partial<IncomingCampaignDeepLink> = {},
): IncomingCampaignDeepLink => ({
  tab: null,
  openChat: null,
  focusCampaignUser: null,
  contentId: null,
  ...over,
});

function notification(over: Partial<Notification>): Notification {
  return {
    id: "n-1",
    type: "unknown",
    title: "",
    message: "",
    boldText: null,
    created_at: "2026-10-30T12:00:00.000Z",
    read_at: null,
    metadata: {},
    ...over,
  };
}

describe("decideIncomingCampaignDeepLink", () => {
  it("espera a campanha carregar antes de abrir Envios (não cai em Curadoria)", () => {
    const decision = decideIncomingCampaignDeepLink({
      link: link({ tab: "shipment", focusCampaignUser: "7" }),
      visibleTabIds: BEFORE_CAMPAIGN,
      campaignReady: false,
    });

    expect(decision).toEqual({ type: "wait" });
  });

  it("abre Envios assim que a campanha carrega e a aba aparece", () => {
    const decision = decideIncomingCampaignDeepLink({
      link: link({ tab: "shipment", focusCampaignUser: "7" }),
      visibleTabIds: SWAP_CAMPAIGN,
      campaignReady: true,
    });

    expect(decision).toEqual({ type: "apply", tab: "shipment" });
  });

  it("vale o mesmo para Propostas", () => {
    const link7 = link({ tab: "proposals", focusCampaignUser: "7" });

    expect(
      decideIncomingCampaignDeepLink({
        link: link7,
        visibleTabIds: BEFORE_CAMPAIGN,
        campaignReady: false,
      }),
    ).toEqual({ type: "wait" });
    expect(
      decideIncomingCampaignDeepLink({
        link: link7,
        visibleTabIds: INDIVIDUAL_PRICE_CAMPAIGN,
        campaignReady: true,
      }),
    ).toEqual({ type: "apply", tab: "proposals" });
  });

  it("campanha carregada sem a aba pedida: segue para o destino alternativo", () => {
    // Campanha que não é de permuta não tem "Envios": comportamento de antes.
    const decision = decideIncomingCampaignDeepLink({
      link: link({ tab: "shipment", focusCampaignUser: "7" }),
      visibleTabIds: BEFORE_CAMPAIGN,
      campaignReady: true,
    });

    expect(decision).toEqual({ type: "apply", tab: "curation" });
  });

  it("abre sem esperar as abas que não dependem da campanha", () => {
    const decision = decideIncomingCampaignDeepLink({
      link: link({ tab: "management", openChat: "7" }),
      visibleTabIds: BEFORE_CAMPAIGN,
      campaignReady: false,
    });

    expect(decision).toEqual({ type: "apply", tab: "management" });
  });

  it("sem aba válida, usa o chat, o conteúdo ou o criador como destino", () => {
    const decide = (over: Partial<IncomingCampaignDeepLink>) =>
      decideIncomingCampaignDeepLink({
        link: link(over),
        visibleTabIds: BEFORE_CAMPAIGN,
        campaignReady: true,
      });

    expect(decide({ openChat: "7" })).toEqual({ type: "apply", tab: "management" });
    expect(decide({ contentId: "c-1" })).toEqual({ type: "apply", tab: "approval" });
    expect(decide({ focusCampaignUser: "7" })).toEqual({
      type: "apply",
      tab: "curation",
    });
  });

  it("ignora a URL quando não há deep link", () => {
    expect(
      decideIncomingCampaignDeepLink({
        link: link(),
        visibleTabIds: BEFORE_CAMPAIGN,
        campaignReady: false,
      }),
    ).toEqual({ type: "ignore" });
  });

  it("não espera por uma aba que não existe", () => {
    expect(
      decideIncomingCampaignDeepLink({
        link: link({ tab: "aba-inventada" }),
        visibleTabIds: BEFORE_CAMPAIGN,
        campaignReady: false,
      }),
    ).toEqual({ type: "ignore" });
  });
});

describe("da notificação até a aba aberta", () => {
  function search(n: Notification) {
    const deep = resolveNotificationCampaignDeepLink(n);
    if (!deep) throw new Error("a notificação deveria ter deep link");
    return link({
      tab: deep.tab,
      openChat: deep.openChat ?? null,
      focusCampaignUser: deep.focusCampaignUser ?? null,
      contentId: deep.contentId ?? null,
    });
  }

  it("shipment_receipt_confirmed chega em Envios mesmo com a campanha fria", () => {
    const incoming = search(
      notification({
        type: "shipment_receipt_confirmed",
        metadata: { campaign_id: "c-1", campaign_user_id: 7 },
      }),
    );

    expect(incoming).toEqual(link({ tab: "shipment", focusCampaignUser: "7" }));
    expect(
      decideIncomingCampaignDeepLink({
        link: incoming,
        visibleTabIds: BEFORE_CAMPAIGN,
        campaignReady: false,
      }),
    ).toEqual({ type: "wait" });
    expect(
      decideIncomingCampaignDeepLink({
        link: incoming,
        visibleTabIds: SWAP_CAMPAIGN,
        campaignReady: true,
      }),
    ).toEqual({ type: "apply", tab: "shipment" });
  });

  it("campaign_price_countered chega em Propostas mesmo com a campanha fria", () => {
    const incoming = search(
      notification({
        type: "campaign_price_countered",
        metadata: { campaign_id: "c-1", influencer_id: 9 },
      }),
    );

    expect(incoming).toEqual(link({ tab: "proposals", focusCampaignUser: "9" }));
    expect(
      decideIncomingCampaignDeepLink({
        link: incoming,
        visibleTabIds: BEFORE_CAMPAIGN,
        campaignReady: false,
      }),
    ).toEqual({ type: "wait" });
    expect(
      decideIncomingCampaignDeepLink({
        link: incoming,
        visibleTabIds: INDIVIDUAL_PRICE_CAMPAIGN,
        campaignReady: true,
      }),
    ).toEqual({ type: "apply", tab: "proposals" });
  });

  it("nova mensagem abre o chat do criador no Gerenciamento, sem esperar", () => {
    const incoming = search(
      notification({
        type: "new_message",
        metadata: { campaign_id: "c-1", influencer_id: 9 },
      }),
    );

    expect(
      decideIncomingCampaignDeepLink({
        link: incoming,
        visibleTabIds: BEFORE_CAMPAIGN,
        campaignReady: false,
      }),
    ).toEqual({ type: "apply", tab: "management" });
    expect(incoming.openChat).toBe("9");
  });
});

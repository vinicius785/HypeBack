/**
 * Deep link das notificações para a página da campanha: Inscrições, Curadoria,
 * Propostas, Roteiros, Envios e Conteúdo não são mais telas — tudo abre o quadro
 * de Gerenciamento, com o painel do criador.
 */
import { describe, it, expect } from "vitest";

import type { Notification } from "@/shared/services/notifications";
import {
  decideIncomingCampaignDeepLink,
  resolveNotificationCampaignDeepLink,
  resolveNotificationTeamChat,
  type IncomingCampaignDeepLink,
} from "./notification-navigation";

const VISIBLE = new Set(["dashboard", "selection", "management", "groups", "contracts", "metrics"]);

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
  it("abre o quadro quando o link traz o criador, o chat ou o conteúdo", () => {
    const decide = (over: Partial<IncomingCampaignDeepLink>) =>
      decideIncomingCampaignDeepLink({
        link: link(over),
        visibleTabIds: VISIBLE,
      });

    expect(decide({ tab: "management", openChat: "7" })).toEqual({ type: "apply", tab: "management" });
    expect(decide({ openChat: "7" })).toEqual({ type: "apply", tab: "management" });
    expect(decide({ contentId: "c-1" })).toEqual({ type: "apply", tab: "management" });
    expect(decide({ focusCampaignUser: "7" })).toEqual({ type: "apply", tab: "management" });
  });

  it("ignora a URL quando não há deep link", () => {
    expect(decideIncomingCampaignDeepLink({ link: link(), visibleTabIds: VISIBLE })).toEqual({
      type: "ignore",
    });
  });

  it("ignora uma aba que não existe", () => {
    expect(
      decideIncomingCampaignDeepLink({
        link: link({ tab: "aba-inventada" }),
        visibleTabIds: VISIBLE,
      }),
    ).toEqual({ type: "ignore" });
  });
});

describe("links antigos de telas removidas", () => {
  it.each(["applications", "curation", "proposals", "script-approval", "shipment", "approval"])(
    "%s abre o quadro de Gerenciamento",
    (tab) => {
      expect(
        decideIncomingCampaignDeepLink({
          link: link({ tab, focusCampaignUser: "7" }),
          visibleTabIds: VISIBLE,
        }),
      ).toEqual({ type: "apply", tab: "management" });
    },
  );
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

  it("shipment_receipt_confirmed abre o painel do criador no quadro", () => {
    const incoming = search(
      notification({
        type: "shipment_receipt_confirmed",
        metadata: { campaign_id: "c-1", campaign_user_id: 7 },
      }),
    );

    expect(incoming).toEqual(link({ tab: "management", focusCampaignUser: "7" }));
    expect(
      decideIncomingCampaignDeepLink({
        link: incoming,
        visibleTabIds: VISIBLE,
      }),
    ).toEqual({ type: "apply", tab: "management" });
  });

  it("campaign_price_countered abre o painel do criador no quadro, sem esperar", () => {
    const incoming = search(
      notification({
        type: "campaign_price_countered",
        metadata: { campaign_id: "c-1", influencer_id: 9 },
      }),
    );

    expect(incoming).toEqual(link({ tab: "management", focusCampaignUser: "9" }));
    expect(
      decideIncomingCampaignDeepLink({
        link: incoming,
        visibleTabIds: VISIBLE,
      }),
    ).toEqual({ type: "apply", tab: "management" });
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
        visibleTabIds: VISIBLE,
      }),
    ).toEqual({ type: "apply", tab: "management" });
    expect(incoming.openChat).toBe("9");
  });
});

describe("resolveNotificationTeamChat", () => {
  it("notificação do chat da equipe aponta para a conversa", () => {
    expect(
      resolveNotificationTeamChat(
        notification({ type: "team_chat_message", metadata: { conversation_id: "c-7", workspace_id: "w1", kind: "direct" } }),
      ),
    ).toEqual({ conversationId: "c-7", workspaceId: "w1" });
  });

  it("sem workspace_id (notificação antiga) devolve só a conversa; id numérico vira texto", () => {
    expect(resolveNotificationTeamChat(notification({ type: "team_chat_message", metadata: { conversation_id: "c-7" } }))).toEqual({
      conversationId: "c-7",
    });
    expect(
      resolveNotificationTeamChat(
        notification({ type: "team_chat_message", metadata: { conversation_id: "c-7", workspace_id: 12 as unknown as string } }),
      ),
    ).toEqual({ conversationId: "c-7", workspaceId: "12" });
  });

  it("outros tipos, ou sem conversa, não são do chat da equipe", () => {
    expect(resolveNotificationTeamChat(notification({ type: "new_message", metadata: { conversation_id: "c-7" } }))).toBeNull();
    expect(resolveNotificationTeamChat(notification({ type: "team_chat_message", metadata: {} }))).toBeNull();
    expect(resolveNotificationTeamChat(notification({ type: "team_chat_message", metadata: { conversation_id: " " } }))).toBeNull();
  });

  it("não vira deep link de campanha", () => {
    expect(resolveNotificationCampaignDeepLink(notification({ type: "team_chat_message", metadata: { conversation_id: "c-7" } }))).toBeNull();
  });
});

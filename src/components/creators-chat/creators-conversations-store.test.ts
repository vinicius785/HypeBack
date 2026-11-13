import { beforeEach, describe, expect, it } from "vitest";

import type { Conversation } from "./creators-conversations";
import { loadStoredConversations, mergeConversations, saveStoredConversations } from "./creators-conversations-store";

const conv = (id: string, at: string, over: Partial<Conversation> = {}): Conversation => ({
  id,
  campaignId: id.split(":")[0],
  influencerId: id.split(":")[1],
  name: `Criador ${id}`,
  campaign: "Verão",
  preview: "oi",
  unread: 0,
  at,
  ...over,
});

beforeEach(() => localStorage.clear());

describe("conversas lembradas", () => {
  it("guarda por workspace e devolve sem não lidas", () => {
    saveStoredConversations("w1", [conv("9:1", "2026-11-01T10:00:00Z", { unread: 3 })]);
    expect(loadStoredConversations("w1")[0].unread).toBe(0);
    expect(loadStoredConversations("w2")).toEqual([]);
  });

  it("uma conversa que saiu das notificações continua na lista", () => {
    const stored = [conv("9:1", "2026-11-01T10:00:00Z")];
    const merged = mergeConversations([], stored);
    expect(merged.map((c) => c.id)).toEqual(["9:1"]);
  });

  it("vale a mais recente; não lido e campanha vêm do que há de novo", () => {
    const stored = [conv("9:1", "2026-11-01T10:00:00Z", { preview: "velha", campaign: "" })];
    const now = [conv("9:1", "2026-11-05T10:00:00Z", { preview: "nova", unread: 2, campaign: "Verão" })];
    const [c] = mergeConversations(now, stored);
    expect(c).toMatchObject({ preview: "nova", unread: 2, campaign: "Verão" });
  });

  it("ordena da mais recente para a mais antiga e ignora lixo no armazenamento", () => {
    localStorage.setItem("hype:chat-convs:v1:w1", "isso não é json");
    expect(loadStoredConversations("w1")).toEqual([]);
    const merged = mergeConversations([conv("9:2", "2026-11-03T10:00:00Z")], [conv("9:1", "2026-11-04T10:00:00Z")]);
    expect(merged.map((c) => c.id)).toEqual(["9:1", "9:2"]);
  });
});

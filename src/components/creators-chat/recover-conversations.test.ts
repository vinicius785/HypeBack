import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  users: vi.fn(),
  messages: vi.fn(),
}));
vi.mock("@/shared/services/campaign-users", () => ({ getCampaignUsers: h.users }));
vi.mock("@/shared/services/chat", () => ({ getInfluencerMessages: h.messages }));

import { recoverConversations } from "./recover-conversations";

beforeEach(() => vi.clearAllMocks());

describe("recoverConversations", () => {
  it("monta a conversa só de quem tem mensagens, com a última como prévia", async () => {
    h.users.mockResolvedValue([
      { user_id: 1, name: "Ana", avatar: "a.png" },
      { user_id: 2, name: "Bia", avatar: "" },
    ]);
    h.messages.mockImplementation(async (_c: string, u: string) =>
      u === "1"
        ? [
            { message: "oi", attachments: [], created_at: "2026-10-01T10:00:00Z" },
            { message: "fechado", attachments: [], created_at: "2026-10-02T10:00:00Z" },
          ]
        : [],
    );
    const found = await recoverConversations([{ id: "c1", title: "Verão" }], vi.fn());
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: "c1:1", name: "Ana", campaign: "Verão", preview: "fechado", at: "2026-10-02T10:00:00Z", unread: 0 });
  });

  it("campanha ou chat com erro não derruba as demais", async () => {
    h.users.mockRejectedValueOnce(new Error("403")).mockResolvedValueOnce([{ user_id: 3, name: "Caio" }]);
    h.messages.mockRejectedValue(new Error("404"));
    const found = await recoverConversations([{ id: "c1", title: "A" }, { id: "c2", title: "B" }], vi.fn());
    expect(found).toEqual([]);
  });

  it("anexo sem texto vira 'Anexo' e o progresso é informado", async () => {
    h.users.mockResolvedValue([{ user_id: 4, name: "Dani" }]);
    h.messages.mockResolvedValue([{ message: "", attachments: ["x.png"], created_at: "2026-10-03T10:00:00Z" }]);
    const progress = vi.fn();
    const found = await recoverConversations([{ id: "c1", title: "A" }], progress);
    expect(found[0].preview).toBe("Anexo");
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: "messages", done: 1, total: 1 }));
  });
});

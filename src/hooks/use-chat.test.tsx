import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "@/shared/types";

type Handler = (...args: unknown[]) => void;
const handlers: Record<string, Handler> = {};
const emit = vi.fn();
const fakeSocket = {
  connected: true,
  on: (event: string, handler: Handler) => {
    handlers[event] = handler;
  },
  emit,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("socket.io-client", () => ({ io: () => fakeSocket }));
vi.mock("@/lib/utils/api", () => ({
  getApiUrl: () => "http://api.test",
  getAuthToken: () => "token",
  getWorkspaceId: () => "ws-1",
}));
vi.mock("@/shared/services/chat", () => ({ getInfluencerMessages: vi.fn().mockResolvedValue([]) }));

let status: "active" | "archived" = "active";
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({ selectedWorkspace: { id: "ws-1", status } }),
}));

import { useChat } from "./use-chat";

const incoming = { id: "m1", sender_id: "creator-9" } as unknown as ChatMessage;

function setup() {
  return renderHook(() => useChat({ campaignId: "11111111-1111-4111-8111-111111111111", influencerId: "creator-9", campaignUserId: 1 }));
}

describe("useChat e o ciclo de vida do workspace", () => {
  beforeEach(() => {
    emit.mockClear();
    status = "active";
  });

  it("marca como lida a mensagem recebida em workspace ativo", () => {
    setup();
    act(() => handlers.new_message({ ...incoming, sender_id: "team-1" }));
    expect(emit).toHaveBeenCalledWith("mark_as_read", { messageId: "m1" });
  });

  it("não marca como lida em workspace arquivado (o servidor trata como escrita)", () => {
    status = "archived";
    setup();
    act(() => handlers.new_message({ ...incoming, sender_id: "team-1" }));
    expect(emit).not.toHaveBeenCalledWith("mark_as_read", expect.anything());
  });

  it("traduz WORKSPACE_SUSPENDED do evento error", () => {
    const { result } = setup();
    act(() => handlers.error({ message: "x", error: "WORKSPACE_SUSPENDED", statusCode: 403 }));
    expect(result.current.error).toMatch(/suspenso/i);
  });

  it("não mostra erro para WORKSPACE_ARCHIVED quando o banner já está visível", () => {
    status = "archived";
    const { result } = setup();
    act(() => handlers.error({ message: "x", error: "WORKSPACE_ARCHIVED", statusCode: 403 }));
    expect(result.current.error).toBeNull();
  });
});

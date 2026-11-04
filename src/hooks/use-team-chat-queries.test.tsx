import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamChatConversation, TeamChatMessage } from "@/shared/services/team-chat";
import { TeamChatUnavailableError } from "@/shared/services/team-chat";

const h = vi.hoisted(() => ({ unread: vi.fn(), messages: vi.fn() }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({ selectedWorkspace: { id: "ws-1", status: "active" } }),
  useWorkspaceIdForQueries: () => "ws-1",
}));
vi.mock("@/shared/services/team-chat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/team-chat")>()),
  getTeamChatUnread: h.unread,
  listTeamChatMessages: h.messages,
}));

import {
  orderedMessages,
  sortConversations,
  teamChatKeys,
  UNAVAILABLE_RECHECK_MS,
  unreadRefetchInterval,
  upsertMessage,
  useTeamChatMessages,
  useTeamChatUnread,
} from "./use-team-chat-queries";

const m = (id: string, over: Partial<TeamChatMessage> = {}): TeamChatMessage => ({
  id,
  conversation_id: "c-1",
  sender_id: 2,
  sender_name: "Ana",
  sender_avatar: null,
  body: `m${id}`,
  attachments: [],
  created_at: "2026-11-03T10:00:00.000Z",
  client_id: null,
  ...over,
});

const c = (id: string, kind: "channel" | "direct", at?: string): TeamChatConversation => ({
  id,
  kind,
  title: id,
  peer: null,
  last_message: at ? { body: "x", sender_id: 1, sender_name: "A", created_at: at, has_attachments: false } : null,
  unread: 0,
  peer_last_read_message_id: null,
});

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children);

beforeEach(() => {
  h.unread.mockReset();
  h.messages.mockReset();
  localStorage.setItem("token", "tok");
  queryClient = new QueryClient();
});

describe("orderedMessages", () => {
  it("junta as páginas (recentes primeiro) em ordem de leitura e descarta ids repetidos", () => {
    const data = {
      pages: [
        { messages: [m("5"), m("4"), m("3")], hasMore: true },
        { messages: [m("3"), m("2"), m("1")], hasMore: false },
      ],
      pageParams: [undefined, "3"],
    };
    expect(orderedMessages(data).map((x) => x.id)).toEqual(["1", "2", "3", "4", "5"]);
    expect(orderedMessages(undefined)).toEqual([]);
  });
});

describe("sortConversations", () => {
  it("canal fixo no topo, depois por última mensagem; sem mensagem vai para o fim", () => {
    const sorted = sortConversations([
      c("d-vazia", "direct"),
      c("d-velha", "direct", "2026-11-01T10:00:00Z"),
      c("canal", "channel", "2026-10-01T10:00:00Z"),
      c("d-nova", "direct", "2026-11-03T10:00:00Z"),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["canal", "d-nova", "d-velha", "d-vazia"]);
  });
});

describe("upsertMessage", () => {
  it("histórico não carregado não é inventado; carregado recebe a mensagem uma vez", () => {
    expect(upsertMessage(queryClient, "ws-1", m("9"))).toBe("uncached");
    queryClient.setQueryData(teamChatKeys.messages("c-1", "ws-1"), {
      pages: [{ messages: [m("8")], hasMore: true }],
      pageParams: [undefined],
    });
    expect(upsertMessage(queryClient, "ws-1", m("9"))).toBe("inserted");
    expect(upsertMessage(queryClient, "ws-1", m("9"))).toBe("duplicate");
    const data = queryClient.getQueryData<any>(teamChatKeys.messages("c-1", "ws-1"));
    expect(orderedMessages(data).map((x) => x.id)).toEqual(["8", "9"]);
    expect(data.pages[0].hasMore).toBe(true);
  });
});

describe("hooks", () => {
  it("não lidas: expõe total e por conversa", async () => {
    h.unread.mockResolvedValue({ total: 4, by_conversation: { "c-1": 4 } });
    const { result } = renderHook(() => useTeamChatUnread(), { wrapper });
    await waitFor(() => expect(result.current.total).toBe(4));
    expect(result.current.byConversation).toEqual({ "c-1": 4 });
    expect(result.current.unavailable).toBe(false);
  });

  it("aba aberta antes de a API ter o chat: reverifica sozinha e passa a funcionar sem recarregar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      h.unread
        .mockRejectedValueOnce(new TeamChatUnavailableError())
        .mockResolvedValue({ total: 2, by_conversation: { "c-1": 2 } });
      const { result } = renderHook(() => useTeamChatUnread(), { wrapper });
      await waitFor(() => expect(result.current.unavailable).toBe(true));
      await vi.advanceTimersByTimeAsync(UNAVAILABLE_RECHECK_MS + 1_000);
      await waitFor(() => expect(result.current.unavailable).toBe(false));
      expect(result.current.total).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("o intervalo é lento (30 s) com o chat indisponível e normal (60 s) quando funciona", () => {
    expect(unreadRefetchInterval(new TeamChatUnavailableError())).toBe(UNAVAILABLE_RECHECK_MS);
    expect(unreadRefetchInterval(null)).toBe(60_000);
    expect(unreadRefetchInterval(new Error("rede"))).toBe(60_000);
  });

  it("API antiga (404): unavailable, sem repetir a chamada", async () => {
    h.unread.mockRejectedValue(new TeamChatUnavailableError());
    const { result } = renderHook(() => useTeamChatUnread(), { wrapper });
    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.total).toBe(0);
    expect(h.unread).toHaveBeenCalledTimes(1);
  });

  it("mensagens: carrega a primeira página e a anterior pelo `before`", async () => {
    h.messages
      .mockResolvedValueOnce({ messages: [m("5"), m("4")], hasMore: true })
      .mockResolvedValueOnce({ messages: [m("3")], hasMore: false });
    const { result } = renderHook(() => useTeamChatMessages("c-1"), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.hasNextPage).toBe(true);
    await result.current.fetchNextPage();
    await waitFor(() => expect(orderedMessages(result.current.data).map((x) => x.id)).toEqual(["3", "4", "5"]));
    expect(h.messages).toHaveBeenLastCalledWith("c-1", { before: "4", limit: 30 });
    expect(result.current.hasNextPage).toBe(false);
  });
});

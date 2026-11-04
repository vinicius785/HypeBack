import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { teamChatKeys, useTeamChatMessages, orderedMessages } from "@/hooks/use-team-chat-queries";
import type { TeamChatConversation, TeamChatMessage, TeamChatUnread } from "@/shared/services/team-chat";

type Handler = (...args: any[]) => void;

/** Socket falso: guarda os ouvintes e deixa o teste "receber" eventos do servidor. */
class FakeSocket {
  connected = true;
  handlers = new Map<string, Handler[]>();
  emitted: { event: string; payload: unknown; ack?: Handler }[] = [];
  disconnect = vi.fn(() => {
    this.connected = false;
  });
  connect = vi.fn();
  on(event: string, fn: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn]);
    return this;
  }
  removeAllListeners() {
    this.handlers.clear();
    return this;
  }
  emit(event: string, payload?: unknown, ack?: Handler) {
    this.emitted.push({ event, payload, ack });
    return this;
  }
  receive(event: string, ...args: unknown[]) {
    for (const fn of this.handlers.get(event) ?? []) fn(...args);
  }
  sent(event: string) {
    return this.emitted.filter((e) => e.event === event);
  }
}

const h = vi.hoisted(() => ({
  sockets: [] as unknown[],
  ioMock: vi.fn(),
  workspace: { id: "ws-1", status: "active" } as { id: string; status: string },
  user: { id: 1 } as { id: number } | undefined,
  sendRest: vi.fn(),
  markReadRest: vi.fn(),
}));

vi.mock("socket.io-client", () => ({ io: h.ioMock }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({ selectedWorkspace: h.workspace }),
  useWorkspaceIdForQueries: () => h.workspace.id,
}));
vi.mock("@/hooks/use-current-user", () => ({ useCurrentUser: () => ({ user: h.user }) }));
vi.mock("@/shared/services/team-chat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/team-chat")>()),
  sendTeamChatMessage: h.sendRest,
  markTeamChatRead: h.markReadRest,
}));

import { useTeamChat } from "./use-team-chat";

const msg = (over: Partial<TeamChatMessage> = {}): TeamChatMessage => ({
  id: "100",
  conversation_id: "c-1",
  sender_id: 2,
  sender_name: "Ana Souza",
  sender_avatar: null,
  body: "oi",
  attachments: [],
  created_at: "2026-11-03T10:00:00.000Z",
  client_id: null,
  ...over,
});

const conv = (over: Partial<TeamChatConversation> = {}): TeamChatConversation => ({
  id: "c-1",
  kind: "direct",
  title: "Ana Souza",
  peer: { user_id: 2, name: "Ana Souza", avatar: null },
  last_message: null,
  unread: 0,
  peer_last_read_message_id: null,
  ...over,
});

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children);

function seed(conversations: TeamChatConversation[], unread: TeamChatUnread, messages?: TeamChatMessage[]) {
  queryClient.setQueryData(teamChatKeys.conversations("ws-1"), conversations);
  queryClient.setQueryData(teamChatKeys.unread("ws-1"), unread);
  if (messages) {
    queryClient.setQueryData(teamChatKeys.messages("c-1", "ws-1"), {
      pages: [{ messages: [...messages].reverse(), hasMore: false }],
      pageParams: [undefined],
    });
  }
}

const socket = () => h.sockets[h.sockets.length - 1] as FakeSocket;
const cachedMessages = () => {
  const { result } = renderHook(() => useTeamChatMessages("c-1", false), { wrapper });
  return orderedMessages(result.current.data);
};
const conversations = () => queryClient.getQueryData<TeamChatConversation[]>(teamChatKeys.conversations("ws-1"))!;
const unread = () => queryClient.getQueryData<TeamChatUnread>(teamChatKeys.unread("ws-1"))!;

beforeEach(() => {
  vi.stubEnv("VITE_SERVER_URL", "http://api.test/api/backoffice");
  localStorage.setItem("token", "tok");
  localStorage.setItem("workspaceId", "ws-1");
  h.sockets.length = 0;
  h.workspace = { id: "ws-1", status: "active" };
  h.user = { id: 1 };
  h.sendRest.mockReset();
  h.markReadRest.mockReset();
  h.ioMock.mockReset();
  h.ioMock.mockImplementation(() => {
    const s = new FakeSocket();
    h.sockets.push(s);
    return s;
  });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("useTeamChat — conexão", () => {
  it("conecta em /team-chat com o mesmo handshake do chat (token + workspaceId)", () => {
    renderHook(() => useTeamChat(), { wrapper });
    const [url, options] = h.ioMock.mock.calls[0];
    expect(url).toBe("ws://api.test/team-chat");
    expect(options.auth).toEqual({ token: "tok", workspaceId: "ws-1" });
    expect(options.extraHeaders).toEqual({ "Workspace-Id": "ws-1" });
  });

  it("não conecta desligado, sem token ou com o workspace suspenso", () => {
    renderHook(() => useTeamChat({ enabled: false }), { wrapper });
    h.workspace = { id: "ws-1", status: "suspended" };
    renderHook(() => useTeamChat(), { wrapper });
    localStorage.removeItem("token");
    h.workspace = { id: "ws-1", status: "active" };
    renderHook(() => useTeamChat(), { wrapper });
    expect(h.ioMock).not.toHaveBeenCalled();
  });

  it("desconecta ao desmontar", () => {
    const { unmount } = renderHook(() => useTeamChat(), { wrapper });
    const s = socket();
    unmount();
    expect(s.disconnect).toHaveBeenCalled();
  });

  it("depois de reconectar, revalida o que pode ter chegado durante a queda", () => {
    seed([conv()], { total: 0, by_conversation: {} });
    renderHook(() => useTeamChat(), { wrapper });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    act(() => socket().receive("connect"));
    expect(spy).not.toHaveBeenCalled();
    act(() => socket().receive("disconnect", "transport close"));
    act(() => socket().receive("connect"));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["team-chat"] });
  });
});

describe("useTeamChat — mensagens recebidas", () => {
  it("não repete a mesma mensagem (id) nem conta duas vezes como não lida", () => {
    seed([conv()], { total: 0, by_conversation: {} }, [msg({ id: "99", body: "antes" })]);
    renderHook(() => useTeamChat(), { wrapper });
    act(() => {
      socket().receive("new_message", msg({ id: "100" }));
      socket().receive("new_message", msg({ id: "100" }));
    });
    expect(cachedMessages().map((m) => m.id)).toEqual(["99", "100"]);
    expect(conversations()[0].unread).toBe(1);
    expect(conversations()[0].last_message).toMatchObject({ body: "oi", sender_name: "Ana Souza" });
    expect(unread()).toEqual({ total: 1, by_conversation: { "c-1": 1 } });
  });

  it("mensagem que já está no histórico (ex.: veio pela página) não duplica", () => {
    seed([conv()], { total: 0, by_conversation: {} }, [msg({ id: "100" })]);
    renderHook(() => useTeamChat(), { wrapper });
    act(() => socket().receive("new_message", msg({ id: "100" })));
    expect(cachedMessages()).toHaveLength(1);
  });

  it("conversa aberta e visível: chega lida (não soma não lidas); com outra aberta, soma", () => {
    seed([conv(), conv({ id: "c-2", title: "Beto" })], { total: 0, by_conversation: {} });
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    act(() => result.current.focusConversation("c-1"));
    act(() => socket().receive("new_message", msg({ id: "1", conversation_id: "c-1" })));
    expect(unread().total).toBe(0);
    act(() => socket().receive("new_message", msg({ id: "2", conversation_id: "c-2" })));
    expect(unread()).toEqual({ total: 1, by_conversation: { "c-2": 1 } });
    act(() => result.current.blurConversation("c-1"));
    act(() => socket().receive("new_message", msg({ id: "3", conversation_id: "c-1" })));
    expect(unread().total).toBe(2);
  });

  it("minha própria mensagem (outra aba) atualiza a prévia, mas não conta como não lida", () => {
    seed([conv()], { total: 0, by_conversation: {} });
    renderHook(() => useTeamChat(), { wrapper });
    act(() => socket().receive("new_message", msg({ id: "5", sender_id: 1, sender_name: "Eu", body: "da outra aba" })));
    expect(conversations()[0].unread).toBe(0);
    expect(conversations()[0].last_message?.body).toBe("da outra aba");
    expect(unread().total).toBe(0);
  });

  it("mensagem que chega com o histórico ainda sendo buscado pede o histórico de novo", async () => {
    seed([conv()], { total: 0, by_conversation: {} });
    renderHook(() => useTeamChat(), { wrapper });
    let release: (v: unknown) => void = () => {};
    void queryClient.fetchQuery({
      queryKey: teamChatKeys.messages("c-1", "ws-1"),
      queryFn: () => new Promise((resolve) => (release = resolve)),
    });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    act(() => socket().receive("new_message", msg({ id: "8" })));
    expect(spy).toHaveBeenCalledWith({ queryKey: teamChatKeys.messages("c-1", "ws-1") });
    release({ pages: [], pageParams: [] });
  });

  it("conversa que não está na lista pede a lista de novo", () => {
    seed([conv()], { total: 0, by_conversation: {} });
    renderHook(() => useTeamChat(), { wrapper });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    act(() => socket().receive("new_message", msg({ id: "7", conversation_id: "c-9" })));
    expect(spy).toHaveBeenCalledWith({ queryKey: teamChatKeys.conversations("ws-1") });
  });

  it("move a conversa para cima da lista, mantendo o canal fixo no topo", () => {
    seed(
      [
        conv({ id: "c-0", kind: "channel", title: "Equipe", peer: null }),
        conv({ id: "c-1", last_message: { body: "a", sender_id: 2, sender_name: "Ana", created_at: "2026-11-01T10:00:00Z", has_attachments: false } }),
        conv({ id: "c-2", title: "Beto", last_message: { body: "b", sender_id: 3, sender_name: "Beto", created_at: "2026-11-02T10:00:00Z", has_attachments: false } }),
      ],
      { total: 0, by_conversation: {} },
    );
    renderHook(() => useTeamChat(), { wrapper });
    act(() => socket().receive("new_message", msg({ id: "8", conversation_id: "c-1" })));
    expect(conversations().map((c) => c.id)).toEqual(["c-0", "c-1", "c-2"]);
  });
});

describe("useTeamChat — leitura (read / mark_read)", () => {
  it("'read' da outra pessoa avança o Visto e nunca recua (ids UUID: a ordem é a do histórico, não a do texto)", () => {
    // Textualmente "z" > "y" > "x", mas a ordem de chegada é z (mais antiga), y, x (mais nova).
    const history = [msg({ id: "z-50" }), msg({ id: "y-55" }), msg({ id: "x-60" })];
    seed([conv({ peer_last_read_message_id: "z-50" })], { total: 0, by_conversation: {} }, history);
    renderHook(() => useTeamChat(), { wrapper });
    act(() => socket().receive("read", { conversationId: "c-1", userId: 2, lastMessageId: "x-60" }));
    expect(conversations()[0].peer_last_read_message_id).toBe("x-60");
    act(() => socket().receive("read", { conversationId: "c-1", userId: 2, lastMessageId: "y-55" }));
    expect(conversations()[0].peer_last_read_message_id).toBe("x-60");
  });

  it("'read' meu (outra aba) zera o contador da conversa", () => {
    seed([conv({ unread: 3 })], { total: 3, by_conversation: { "c-1": 3 } });
    renderHook(() => useTeamChat(), { wrapper });
    act(() => socket().receive("read", { conversationId: "c-1", userId: 1, lastMessageId: "60" }));
    expect(conversations()[0].unread).toBe(0);
    expect(unread().total).toBe(0);
  });

  it("'read' meu com mensagem mais nova no histórico não zera: recarrega as não lidas", () => {
    seed([conv({ unread: 3 })], { total: 3, by_conversation: { "c-1": 3 } }, [msg({ id: "60" }), msg({ id: "70" })]);
    renderHook(() => useTeamChat(), { wrapper });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    act(() => socket().receive("read", { conversationId: "c-1", userId: 1, lastMessageId: "60" }));
    expect(conversations()[0].unread).toBe(3);
    expect(spy).toHaveBeenCalledWith({ queryKey: teamChatKeys.unread("ws-1") });
    act(() => socket().receive("read", { conversationId: "c-1", userId: 1, lastMessageId: "70" }));
    expect(conversations()[0].unread).toBe(0);
  });

  it("markRead zera na hora, avisa o servidor por mark_read e atualiza o sino", () => {
    seed([conv({ unread: 2 })], { total: 2, by_conversation: { "c-1": 2 } });
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    act(() => result.current.markRead("c-1", "100"));
    expect(socket().sent("mark_read")[0].payload).toEqual({ conversationId: "c-1", lastMessageId: "100" });
    expect(conversations()[0].unread).toBe(0);
    expect(unread().total).toBe(0);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  });

  it("sem socket conectado, marca como lida por REST e usa o contador devolvido", async () => {
    h.markReadRest.mockResolvedValue({ unread: 1 });
    seed([conv({ unread: 2 })], { total: 2, by_conversation: { "c-1": 2 } });
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    socket().connected = false;
    act(() => result.current.markRead("c-1", "100"));
    expect(h.markReadRest).toHaveBeenCalledWith("c-1", "100");
    await waitFor(() => expect(conversations()[0].unread).toBe(1));
  });

  it("avisa o servidor da conversa aberta (focus) e a refaz depois de reconectar; blur ao sair", () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    act(() => result.current.focusConversation("c-1"));
    expect(socket().sent("focus_conversation")[0].payload).toEqual({ conversationId: "c-1" });
    act(() => socket().receive("connect"));
    expect(socket().sent("focus_conversation")).toHaveLength(2);
    act(() => result.current.blurConversation("c-1"));
    expect(socket().sent("blur_conversation")[0].payload).toEqual({ conversationId: "c-1" });
  });
});

describe("useTeamChat — envio", () => {
  it("envia por socket com ack e coloca a mensagem no histórico; o new_message do mesmo id não duplica", async () => {
    seed([conv()], { total: 0, by_conversation: {} }, []);
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    let promise!: Promise<TeamChatMessage | null>;
    act(() => {
      promise = result.current.sendMessage("c-1", { body: "olá", attachments: [], clientId: "cid-1" });
    });
    const sent = socket().sent("send_message")[0];
    expect(sent.payload).toEqual({ conversationId: "c-1", body: "olá", attachments: [], client_id: "cid-1" });
    act(() => sent.ack!({ ok: true, message: msg({ id: "200", sender_id: 1, sender_name: "Eu", body: "olá" }) }));
    await expect(promise).resolves.toMatchObject({ id: "200", body: "olá" });
    act(() => socket().receive("new_message", msg({ id: "200", sender_id: 1, sender_name: "Eu", body: "olá" })));
    expect(cachedMessages().map((m) => m.id)).toEqual(["200"]);
    expect(conversations()[0].last_message?.body).toBe("olá");
    expect(conversations()[0].unread).toBe(0);
  });

  it("ack com erro rejeita; erro de estado do workspace bloqueia o envio", async () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    let p!: Promise<unknown>;
    act(() => {
      p = result.current.sendMessage("c-1", { body: "x", attachments: [] });
    });
    const assertion = expect(p).rejects.toThrow("Mensagem muito longa");
    act(() => socket().sent("send_message")[0].ack!({ ok: false, error: "Mensagem muito longa" }));
    await assertion;
    expect(result.current.blocked).toBeNull();

    act(() => {
      p = result.current.sendMessage("c-1", { body: "y", attachments: [] });
    });
    const state = expect(p).rejects.toThrow(/arquivado/);
    act(() => socket().sent("send_message")[1].ack!({ ok: false, error: "WORKSPACE_ARCHIVED" }));
    await state;
    expect(result.current.blocked?.code).toBe("WORKSPACE_ARCHIVED");
    await expect(result.current.sendMessage("c-1", { body: "z", attachments: [] })).rejects.toThrow(/arquivado/);
  });

  it("ack com código da API (RATE_LIMITED, TEAM_CHAT_PEER_UNAVAILABLE) mostra a frase, não o código", async () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    let p!: Promise<unknown>;
    act(() => {
      p = result.current.sendMessage("c-1", { body: "x", attachments: [] });
    });
    const limited = expect(p).rejects.toThrow("Você está enviando muito rápido. Aguarde um instante.");
    act(() => socket().sent("send_message")[0].ack!({ ok: false, error: "RATE_LIMITED" }));
    await limited;
    act(() => {
      p = result.current.sendMessage("c-1", { body: "y", attachments: [] });
    });
    const gone = expect(p).rejects.toThrow("Esta pessoa não faz mais parte deste workspace.");
    act(() => socket().sent("send_message")[1].ack!({ ok: false, error: "TEAM_CHAT_PEER_UNAVAILABLE" }));
    await gone;
    expect(result.current.blocked).toBeNull();
  });

  it("sem conexão usa o REST com o mesmo client_id", async () => {
    h.sendRest.mockResolvedValue(msg({ id: "300", sender_id: 1, body: "rest" }));
    seed([conv()], { total: 0, by_conversation: {} }, []);
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    socket().connected = false;
    await act(async () => {
      await result.current.sendMessage("c-1", { body: "rest", attachments: [], clientId: "k-1" });
    });
    expect(h.sendRest).toHaveBeenCalledWith("c-1", { body: "rest", attachments: [], client_id: "k-1" });
    expect(cachedMessages().map((m) => m.id)).toEqual(["300"]);
  });

  it("ack sem a mensagem devolve null e recarrega o histórico", async () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    let p!: Promise<TeamChatMessage | null>;
    act(() => {
      p = result.current.sendMessage("c-1", { body: "x", attachments: [] });
    });
    act(() => socket().sent("send_message")[0].ack!({ ok: true }));
    await expect(p).resolves.toBeNull();
    expect(spy).toHaveBeenCalledWith({ queryKey: teamChatKeys.messages("c-1", "ws-1") });
  });
});

describe("useTeamChat — estado do workspace", () => {
  it("arquivado: bloqueado com a mensagem de estado, sem mark_read e sem envio", async () => {
    h.workspace = { id: "ws-1", status: "archived" };
    seed([conv({ unread: 1 })], { total: 1, by_conversation: { "c-1": 1 } });
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    expect(result.current.blocked).toMatchObject({ code: "WORKSPACE_ARCHIVED", message: expect.stringMatching(/arquivado/) });
    act(() => result.current.markRead("c-1", "100"));
    expect(socket().sent("mark_read")).toHaveLength(0);
    expect(conversations()[0].unread).toBe(1);
    await expect(result.current.sendMessage("c-1", { body: "x", attachments: [] })).rejects.toThrow(/arquivado/);
    expect(socket().sent("send_message")).toHaveLength(0);
  });

  it("erro WORKSPACE_ARCHIVED do socket bloqueia a escrita e mantém a conexão (leitura segue)", () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    act(() => socket().receive("error", { message: "Workspace arquivado", error: "WORKSPACE_ARCHIVED" }));
    expect(result.current.blocked).toEqual({ code: "WORKSPACE_ARCHIVED", message: "Workspace arquivado" });
    expect(socket().disconnect).not.toHaveBeenCalled();
  });

  it.each(["WORKSPACE_SUSPENDED", "WORKSPACE_DELETED"] as const)("%s: bloqueia e desconecta sem reconectar", (code) => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    const s = socket();
    act(() => s.receive("error", { message: "", error: code }));
    expect(result.current.blocked?.code).toBe(code);
    expect(result.current.blocked?.message).toMatch(/workspace/i);
    expect(s.disconnect).toHaveBeenCalled();
    act(() => s.receive("disconnect", "io server disconnect"));
    expect(s.connect).not.toHaveBeenCalled();
  });

  it("queda por 'io server disconnect' que não é de estado reconecta", () => {
    renderHook(() => useTeamChat(), { wrapper });
    const s = socket();
    act(() => s.receive("disconnect", "io server disconnect"));
    expect(s.connect).toHaveBeenCalled();
  });

  it("trocar de workspace reconecta no novo e limpa o bloqueio do socket", () => {
    const { result, rerender } = renderHook(() => useTeamChat(), { wrapper });
    act(() => socket().receive("error", { message: "", error: "WORKSPACE_SUSPENDED" }));
    expect(result.current.blocked).not.toBeNull();
    h.workspace = { id: "ws-2", status: "active" };
    rerender();
    expect(h.ioMock).toHaveBeenCalledTimes(2);
    expect(h.ioMock.mock.calls[1][1].auth.workspaceId).toBe("ws-2");
    expect(result.current.blocked).toBeNull();
  });
});

describe("useTeamChat — conversa nova", () => {
  it("conversation_created coloca a conversa na lista, sem duplicar", () => {
    seed([conv({ id: "c-0", kind: "channel", title: "Equipe", peer: null })], { total: 0, by_conversation: {} });
    renderHook(() => useTeamChat(), { wrapper });
    const created = { ...conv({ id: "c-5", title: "Caio", peer: { user_id: 5, name: "Caio", avatar: null } }) };
    act(() => {
      socket().receive("conversation_created", created);
      socket().receive("conversation_created", created);
    });
    expect(conversations().map((c) => c.id)).toEqual(["c-0", "c-5"]);
  });
});

describe("useTeamChat — client_id (envio idempotente)", () => {
  const CID = "7d1f3a52-8c1e-4b6a-9b0f-0a5d2c7e9f11";

  it("gera um client_id por envio quando quem chama não passa um, e o manda no payload do socket", async () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    act(() => {
      void result.current.sendMessage("c-1", { body: "a", attachments: [] });
      void result.current.sendMessage("c-1", { body: "b", attachments: [] });
    });
    const [first, second] = socket().sent("send_message").map((e) => (e.payload as { client_id: string }).client_id);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toMatch(/^[0-9a-f-]{36}$/);
    expect(first).not.toBe(second);
  });

  it("'Tentar de novo' reusa o mesmo client_id (socket) e o mesmo na volta pelo REST", async () => {
    h.sendRest.mockResolvedValue(msg({ id: "400", sender_id: 1, client_id: CID }));
    seed([conv()], { total: 0, by_conversation: {} }, []);
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    let p!: Promise<unknown>;
    act(() => {
      p = result.current.sendMessage("c-1", { body: "x", attachments: [], clientId: CID });
    });
    const failed = expect(p).rejects.toThrow();
    act(() => socket().sent("send_message")[0].ack!({ ok: false, error: "Falhou" }));
    await failed;
    socket().connected = false;
    await act(async () => {
      await result.current.sendMessage("c-1", { body: "x", attachments: [], clientId: CID });
    });
    expect((socket().sent("send_message")[0].payload as { client_id: string }).client_id).toBe(CID);
    expect(h.sendRest).toHaveBeenCalledWith("c-1", { body: "x", attachments: [], client_id: CID });
  });

  it("new_message com o mesmo client_id de uma mensagem já tratada não duplica nem conta como não lida", async () => {
    seed([conv()], { total: 0, by_conversation: {} }, []);
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    let p!: Promise<TeamChatMessage | null>;
    act(() => {
      p = result.current.sendMessage("c-1", { body: "oi", attachments: [], clientId: CID });
    });
    act(() => socket().sent("send_message")[0].ack!({ ok: true, message: msg({ id: "500", sender_id: 1, client_id: CID }) }));
    await p;
    // Mesmo envio chegando de novo com outro id (ex.: reenvio): vale o client_id do mesmo remetente.
    act(() => socket().receive("new_message", msg({ id: "501", sender_id: 1, client_id: CID })));
    expect(cachedMessages().map((m) => m.id)).toEqual(["500"]);
    expect(conversations()[0].unread).toBe(0);
  });

  it("o mesmo client_id de outro remetente não colide", () => {
    seed([conv()], { total: 0, by_conversation: {} }, [msg({ id: "1", sender_id: 1, client_id: CID })]);
    renderHook(() => useTeamChat(), { wrapper });
    act(() => socket().receive("new_message", msg({ id: "2", sender_id: 2, client_id: CID })));
    expect(cachedMessages().map((m) => m.id)).toEqual(["1", "2"]);
  });

  it("new_message de mensagem minha com client_id já no histórico (ack veio antes) não repete", () => {
    seed([conv()], { total: 0, by_conversation: {} }, [msg({ id: "9", sender_id: 1, client_id: CID })]);
    renderHook(() => useTeamChat(), { wrapper });
    act(() => socket().receive("new_message", msg({ id: "10", sender_id: 1, client_id: CID })));
    expect(cachedMessages()).toHaveLength(1);
  });
});

describe("useTeamChat — handshake recusado", () => {
  it.each([
    ["TEAM_CHAT_FORBIDDEN", /não faz parte deste workspace/],
    ["TEAM_CHAT_UNAUTHENTICATED", /sessão expirou/],
  ] as const)("%s: bloqueia com frase clara, desconecta e não reconecta (nem em io server disconnect)", async (code, text) => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    const s = socket();
    act(() => s.receive("error", { message: "Forbidden", error: code }));
    expect(result.current.blocked).toEqual({ code, message: expect.stringMatching(text) });
    expect(s.disconnect).toHaveBeenCalled();
    act(() => s.receive("disconnect", "io server disconnect"));
    expect(s.connect).not.toHaveBeenCalled();
    // Escrita barrada e sem tentar o socket nem o REST.
    await expect(result.current.sendMessage("c-1", { body: "x", attachments: [] })).rejects.toThrow(text);
    expect(s.sent("send_message")).toHaveLength(0);
    expect(h.sendRest).not.toHaveBeenCalled();
  });

  it("recusa que chega como connect_error (handshake) também não reconecta", () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    const s = socket();
    act(() => s.receive("connect_error", Object.assign(new Error("TEAM_CHAT_FORBIDDEN"), { data: { error: "TEAM_CHAT_FORBIDDEN" } })));
    expect(result.current.blocked?.code).toBe("TEAM_CHAT_FORBIDDEN");
    expect(s.disconnect).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
  });

  it("connect_error comum (rede) segue tentando: sem bloqueio nem disconnect", () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    const s = socket();
    act(() => s.receive("connect_error", new Error("xhr poll error")));
    expect(result.current.blocked).toBeNull();
    expect(s.disconnect).not.toHaveBeenCalled();
  });

  it("recusa no ack do envio também bloqueia", async () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    let p!: Promise<unknown>;
    act(() => {
      p = result.current.sendMessage("c-1", { body: "x", attachments: [] });
    });
    const rejected = expect(p).rejects.toThrow(/não faz parte deste workspace/);
    act(() => socket().sent("send_message")[0].ack!({ ok: false, error: "TEAM_CHAT_FORBIDDEN" }));
    await rejected;
    expect(result.current.blocked?.code).toBe("TEAM_CHAT_FORBIDDEN");
  });

  it.each(["TEAM_CHAT_FORBIDDEN", "TEAM_CHAT_UNAUTHENTICATED", "WORKSPACE_SUSPENDED", "WORKSPACE_DELETED"])(
    "%s no ack do envio derruba o socket e o 'io server disconnect' seguinte não reconecta",
    async (code) => {
      const { result } = renderHook(() => useTeamChat(), { wrapper });
      const s = socket();
      let p!: Promise<unknown>;
      act(() => {
        p = result.current.sendMessage("c-1", { body: "x", attachments: [] });
      });
      const rejected = expect(p).rejects.toThrow();
      act(() => s.sent("send_message")[0].ack!({ ok: false, error: code }));
      await rejected;
      expect(s.disconnect).toHaveBeenCalled();
      act(() => s.receive("disconnect", "io server disconnect"));
      expect(s.connect).not.toHaveBeenCalled();
    },
  );

  it("workspace arquivado no ack bloqueia a escrita mas mantém o socket (leitura segue)", async () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    const s = socket();
    let p!: Promise<unknown>;
    act(() => {
      p = result.current.sendMessage("c-1", { body: "x", attachments: [] });
    });
    const rejected = expect(p).rejects.toThrow();
    act(() => s.sent("send_message")[0].ack!({ ok: false, error: "WORKSPACE_ARCHIVED" }));
    await rejected;
    expect(s.disconnect).not.toHaveBeenCalled();
  });

  it("estado do workspace recusado pelo REST (fallback sem socket) também derruba o socket", async () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    const s = socket();
    s.connected = false;
    h.sendRest.mockRejectedValue(Object.assign(new Error("Workspace suspenso"), { status: 403, code: "WORKSPACE_SUSPENDED" }));
    await act(async () => {
      await expect(result.current.sendMessage("c-1", { body: "x", attachments: [] })).rejects.toThrow();
    });
    act(() => s.receive("disconnect", "io server disconnect"));
    expect(s.connect).not.toHaveBeenCalled();
  });

  it("connect_error com código de estado terminal (suspenso) bloqueia e não segue tentando", () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    const s = socket();
    act(() => s.receive("connect_error", Object.assign(new Error("WORKSPACE_SUSPENDED"), { data: { error: "WORKSPACE_SUSPENDED" } })));
    expect(result.current.blocked?.code).toBe("WORKSPACE_SUSPENDED");
    expect(s.disconnect).toHaveBeenCalled();
  });

  it("trocar de workspace limpa a recusa e conecta de novo", () => {
    const { result, rerender } = renderHook(() => useTeamChat(), { wrapper });
    act(() => socket().receive("error", { message: "", error: "TEAM_CHAT_FORBIDDEN" }));
    expect(result.current.blocked).not.toBeNull();
    h.workspace = { id: "ws-2", status: "active" };
    rerender();
    expect(h.ioMock).toHaveBeenCalledTimes(2);
    expect(result.current.blocked).toBeNull();
  });
});

describe("useTeamChat — presença depois de reconectar", () => {
  it("reemite focus_conversation a cada reconexão, só da conversa que ainda está aberta", () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    const s = socket();
    act(() => s.receive("connect"));
    expect(s.sent("focus_conversation")).toHaveLength(0);
    act(() => result.current.focusConversation("c-1"));
    expect(s.sent("focus_conversation")).toHaveLength(1);
    for (let i = 0; i < 2; i++) {
      act(() => s.receive("disconnect", "transport close"));
      act(() => s.receive("connect"));
    }
    expect(s.sent("focus_conversation").map((e) => e.payload)).toEqual([
      { conversationId: "c-1" },
      { conversationId: "c-1" },
      { conversationId: "c-1" },
    ]);
    act(() => result.current.blurConversation("c-1"));
    act(() => s.receive("disconnect", "transport close"));
    act(() => s.receive("connect"));
    expect(s.sent("focus_conversation")).toHaveLength(3);
  });

  it("focus pedido com o socket fora do ar sai assim que conectar", () => {
    const { result } = renderHook(() => useTeamChat(), { wrapper });
    const s = socket();
    s.connected = false;
    act(() => result.current.focusConversation("c-1"));
    expect(s.sent("focus_conversation")).toHaveLength(0);
    s.connected = true;
    act(() => s.receive("connect"));
    expect(s.sent("focus_conversation")[0].payload).toEqual({ conversationId: "c-1" });
  });
});

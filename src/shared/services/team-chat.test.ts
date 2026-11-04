import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TeamChatUnavailableError,
  hasReadThrough,
  messageIndex,
  socketErrorText,
  getTeamChatUnread,
  isTeamChatRefusalCode,
  isTeamChatUnavailable,
  listTeamChatMembers,
  listTeamChatMessages,
  listTeamConversations,
  mapConversation,
  mapMessage,
  markTeamChatRead,
  openDirectConversation,
  sendTeamChatMessage,
  uploadTeamChatAttachment,
} from "./team-chat";

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new Error("sem corpo")) : Promise.resolve(body)),
  });

beforeEach(() => {
  vi.stubEnv("VITE_SERVER_URL", "http://api.test/api/backoffice");
  localStorage.setItem("token", "tok");
  localStorage.setItem("workspaceId", "ws-1");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
});

const rawConversation = (over: Record<string, unknown> = {}) => ({
  id: "c-1",
  kind: "direct",
  title: "Ana",
  peer: { user_id: 7, name: "Ana", avatar: "/uploads/a.png" },
  last_message: { body: "oi", sender_id: 7, sender_name: "Ana", created_at: "2026-11-03T10:00:00Z", has_attachments: false },
  unread: 2,
  peer_last_read_message_id: "41",
  ...over,
});

describe("mapeamento", () => {
  it("mensagem: normaliza anexos, avatar e ids", () => {
    expect(
      mapMessage({
        id: 10,
        conversation_id: "c-1",
        sender_id: "7",
        sender_name: "Ana",
        sender_avatar: "",
        body: "oi",
        created_at: "2026-11-03T10:00:00Z",
      }),
    ).toEqual({
      id: "10",
      conversation_id: "c-1",
      sender_id: 7,
      sender_name: "Ana",
      sender_avatar: null,
      body: "oi",
      attachments: [],
      created_at: "2026-11-03T10:00:00Z",
      client_id: null,
    });
    expect(
      mapMessage({ id: "1", attachments: [{ url: "/u/x.png", name: "x.png", mime_type: "image/png", size: "1200" }] }).attachments,
    ).toEqual([{ url: "/u/x.png", name: "x.png", mime_type: "image/png", size: 1200 }]);
  });

  it("conversa 1 a 1 e canal", () => {
    expect(mapConversation(rawConversation())).toMatchObject({
      id: "c-1",
      kind: "direct",
      peer: { user_id: 7, name: "Ana", avatar: "/uploads/a.png" },
      unread: 2,
      peer_last_read_message_id: "41",
      last_message: { body: "oi", has_attachments: false },
    });
    const channel = mapConversation({ id: "c-0", kind: "channel", title: "", peer: null, last_message: null, unread: -3 });
    expect(channel).toMatchObject({ kind: "channel", title: "Equipe", peer: null, last_message: null, unread: 0 });
    expect(channel.peer_last_read_message_id).toBeNull();
  });

  it("ordena ids de mensagem (UUID) pela posição na lista, não pelo texto", () => {
    const list = [{ id: "ffffffff-0000-4000-8000-000000000001" }, { id: "00000000-0000-4000-8000-000000000002" }];
    expect(messageIndex(list, list[1].id)).toBe(1);
    expect(messageIndex(list, "nao-esta")).toBe(-1);
    expect(messageIndex(list, null)).toBe(-1);
    // "00000000..." é menor que "ffffffff..." no texto, mas é a mais nova da lista.
    expect(hasReadThrough(list, list[1].id, list[0].id)).toBe(true);
    expect(hasReadThrough(list, list[0].id, list[1].id)).toBe(false);
    expect(hasReadThrough(list, list[1].id, list[1].id)).toBe(true);
    expect(hasReadThrough(list, null, list[1].id)).toBe(false);
    expect(hasReadThrough(list, "fora", list[1].id)).toBe(false);
  });

  it("traduz o código de erro do ack do socket", () => {
    expect(socketErrorText("RATE_LIMITED")).toMatch(/muito rápido/);
    expect(socketErrorText("TEAM_CHAT_PEER_UNAVAILABLE")).toMatch(/não faz mais parte/);
    expect(socketErrorText("OUTRO_CODIGO")).toBe("Não foi possível enviar a mensagem.");
    expect(socketErrorText("Mensagem inválida.")).toBe("Mensagem inválida.");
    expect(socketErrorText(undefined)).toBe("Não foi possível enviar a mensagem.");
  });
});

describe("rotas", () => {
  it("lista conversas com o canal primeiro e manda os cabeçalhos do backoffice", async () => {
    const fetchMock = respond(200, {
      data: [rawConversation(), rawConversation({ id: "c-0", kind: "channel", title: "Equipe", peer: null })],
    });
    vi.stubGlobal("fetch", fetchMock);
    const list = await listTeamConversations();
    expect(list.map((c) => c.id)).toEqual(["c-0", "c-1"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/backoffice/team-chat/conversations");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok", "Workspace-Id": "ws-1", "Client-Type": "backoffice" });
  });

  it("membros e não lidas", async () => {
    vi.stubGlobal("fetch", respond(200, { data: [{ user_id: 7, name: "Ana", avatar: null, role: "admin" }] }));
    await expect(listTeamChatMembers()).resolves.toEqual([{ user_id: 7, name: "Ana", avatar: null, role: "admin" }]);
    vi.stubGlobal("fetch", respond(200, { data: { total: 3, by_conversation: { "c-1": 2, "c-0": 1 } } }));
    await expect(getTeamChatUnread()).resolves.toEqual({ total: 3, by_conversation: { "c-1": 2, "c-0": 1 } });
  });

  it("mensagens: página, `before` e has_more", async () => {
    const fetchMock = respond(200, {
      data: [{ id: "30", conversation_id: "c-1", sender_id: 1, sender_name: "Eu", body: "x", created_at: "2026-11-03T10:00:00Z" }],
      meta: { has_more: true },
    });
    vi.stubGlobal("fetch", fetchMock);
    const page = await listTeamChatMessages("c-1", { before: "31", limit: 80 });
    expect(page.hasMore).toBe(true);
    expect(page.messages[0].id).toBe("30");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/api/backoffice/team-chat/conversations/c-1/messages");
    expect(url.searchParams.get("before")).toBe("31");
    expect(url.searchParams.get("limit")).toBe("50");
  });

  it("abre conversa 1 a 1, envia (com client_id no corpo), marca como lida e sobe anexo", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: rawConversation() }) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve({ data: { id: "50", conversation_id: "c-1", sender_id: 1, body: "oi" } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: { unread: 0 } }) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve({ data: { url: "/u/f.pdf", name: "f.pdf", mime_type: "application/pdf", size: 10 } }) });
    vi.stubGlobal("fetch", fetchMock);

    await openDirectConversation(7);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ user_id: 7 });

    const clientId = "7d1f3a52-8c1e-4b6a-9b0f-0a5d2c7e9f11";
    const sent = await sendTeamChatMessage("c-1", { body: "oi", client_id: clientId });
    expect(sent.id).toBe("50");
    expect(fetchMock.mock.calls[1][1].headers["Idempotency-Key"]).toBeUndefined();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ body: "oi", attachments: [], client_id: clientId });

    await expect(markTeamChatRead("c-1", "50")).resolves.toEqual({ unread: 0 });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ last_message_id: "50" });

    const att = await uploadTeamChatAttachment("c-1", new File(["x"], "f.pdf", { type: "application/pdf" }));
    expect(att).toEqual({ url: "/u/f.pdf", name: "f.pdf", mime_type: "application/pdf", size: 10 });
    const [, init] = fetchMock.mock.calls[3];
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers["Content-Type"]).toBeUndefined();
  });
});

describe("API antiga (404)", () => {
  it("listagens: qualquer 404 vira indisponível", async () => {
    for (const body of [{ statusCode: 404, message: "Cannot GET /api/backoffice/team-chat/conversations", error: "Not Found" }, undefined, { message: "x" }]) {
      vi.stubGlobal("fetch", respond(404, body));
      const error = await listTeamConversations().catch((e) => e);
      expect(isTeamChatUnavailable(error)).toBe(true);
      expect(error).toBeInstanceOf(TeamChatUnavailableError);
    }
    vi.stubGlobal("fetch", respond(404, {}));
    await expect(getTeamChatUnread()).rejects.toBeInstanceOf(TeamChatUnavailableError);
    await expect(listTeamChatMembers()).rejects.toBeInstanceOf(TeamChatUnavailableError);
  });

  it("rota de um recurso: 404 do serviço (membro/conversa não encontrada) segue como erro normal", async () => {
    vi.stubGlobal("fetch", respond(404, { statusCode: 404, message: "Membro não encontrado", error: "Not Found" }));
    const error = await openDirectConversation(99).catch((e) => e);
    expect(isTeamChatUnavailable(error)).toBe(false);
    expect(error.message).toBe("Membro não encontrado");
    expect(error.status).toBe(404);
    // Mas a rota que não existe no servidor ainda é "indisponível".
    vi.stubGlobal("fetch", respond(404, { statusCode: 404, message: "Cannot POST /api/backoffice/team-chat/conversations/direct" }));
    await expect(openDirectConversation(99)).rejects.toBeInstanceOf(TeamChatUnavailableError);
  });

  it("workspace excluído (404 com código) não é API antiga", async () => {
    vi.stubGlobal("fetch", respond(404, { statusCode: 404, message: "Workspace excluído", error: "WORKSPACE_DELETED" }));
    const error = await listTeamConversations().catch((e) => e);
    expect(isTeamChatUnavailable(error)).toBe(false);
    expect(error.code).toBe("WORKSPACE_DELETED");
  });

  it("estado do workspace chega com o código no erro", async () => {
    vi.stubGlobal("fetch", respond(403, { statusCode: 403, message: "Workspace arquivado", error: "WORKSPACE_ARCHIVED" }));
    const error = await sendTeamChatMessage("c-1", { body: "oi" }).catch((e) => e);
    expect(error.code).toBe("WORKSPACE_ARCHIVED");
    expect(error.status).toBe(403);
  });
});

describe("client_id e recusa do handshake", () => {
  it("mapMessage lê o client_id (ou null quando não vem)", () => {
    expect(mapMessage({ id: "1", client_id: "abc" }).client_id).toBe("abc");
    expect(mapMessage({ id: "1" }).client_id).toBeNull();
    expect(mapMessage({ id: "1", client_id: " " }).client_id).toBeNull();
  });

  it("sem client_id o REST não manda o campo (e nunca manda Idempotency-Key)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({ data: { id: "1" } }) });
    vi.stubGlobal("fetch", fetchMock);
    await sendTeamChatMessage("c-1", { body: "oi" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ body: "oi", attachments: [] });
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBeUndefined();
  });

  it("os códigos de recusa viram frase para a pessoa, nunca o código", () => {
    expect(isTeamChatRefusalCode("TEAM_CHAT_FORBIDDEN")).toBe(true);
    expect(isTeamChatRefusalCode("TEAM_CHAT_UNAUTHENTICATED")).toBe(true);
    expect(isTeamChatRefusalCode("WORKSPACE_ARCHIVED")).toBe(false);
    expect(socketErrorText("TEAM_CHAT_FORBIDDEN")).toMatch(/não faz parte deste workspace/);
    expect(socketErrorText("TEAM_CHAT_UNAUTHENTICATED")).toMatch(/sessão expirou/);
  });
});

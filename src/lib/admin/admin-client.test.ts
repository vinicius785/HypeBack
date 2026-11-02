import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ token: "tok-123" as string | null }));

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getAuthToken: () => auth.token,
}));

import {
  AdminApiError,
  adminFeed,
  adminGet,
  adminGetEnvelope,
  adminList,
  adminPatch,
  adminPath,
  adminPost,
  buildAdminQueryString,
  isAdminApiError,
  isClientError,
  newIdempotencyKey,
  setAdminUnauthorizedHandler,
  toAdminApiError,
} from "./admin-client";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fetchMock = vi.fn();

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
  });
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit & { headers: Record<string, string> }];
  return { url, init, headers: init.headers };
}

beforeEach(() => {
  auth.token = "tok-123";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  setAdminUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe("cabeçalhos e caminho", () => {
  it("envia Client-Type backoffice e Bearer, e NUNCA Workspace-Id", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { ok: true } }));
    await adminGet("/admin/overview", { from: "2026-10-01", to: "2026-10-31" });

    const { url, headers, init } = lastCall();
    expect(url).toBe("https://api.test/api/backoffice/admin/overview?from=2026-10-01&to=2026-10-31");
    expect(init.method).toBe("GET");
    expect(headers["Client-Type"]).toBe("backoffice");
    expect(headers.Authorization).toBe("Bearer tok-123");
    expect(headers.Accept).toBe("application/json");
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("workspace-id");
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("content-type");
    expect(init.body).toBeUndefined();
  });

  it("sem token a chamada nem sai (nada de 'Bearer null') e o handler de sessão é avisado", async () => {
    auth.token = null;
    const handler = vi.fn();
    setAdminUnauthorizedHandler(handler);

    await expect(adminGet("/admin/overview")).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("adminPath escapa cada valor (um id nunca vira outro caminho)", () => {
    expect(adminPath`/admin/workspaces/${"abc-123"}/members`).toBe("/admin/workspaces/abc-123/members");
    expect(adminPath`/admin/workspaces/${"../users?x=1#"}`).toBe("/admin/workspaces/..%2Fusers%3Fx%3D1%23");
    expect(adminPath`/admin/users/${42}`).toBe("/admin/users/42");
  });

  it("monta a query ignorando vazios e juntando arrays em CSV", () => {
    expect(buildAdminQueryString({ page: 2, search: "", status: ["active", "suspended"], q: undefined, x: null })).toBe(
      "?page=2&status=active%2Csuspended",
    );
    expect(buildAdminQueryString({})).toBe("");
    expect(buildAdminQueryString(undefined)).toBe("");
    expect(buildAdminQueryString({ search: "a&b=c" })).toBe("?search=a%26b%3Dc");
  });
});

describe("respostas de sucesso", () => {
  it("adminGet devolve só o data", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { id: "w1" } }));
    await expect(adminGet("/admin/workspaces/w1")).resolves.toEqual({ id: "w1" });
  });

  it("adminList mantém o meta de paginação", async () => {
    const meta = { page: 2, per_page: 25, total: 60, total_pages: 3 };
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [{ id: "a" }], meta }));
    await expect(adminList("/admin/workspaces", { page: 2 })).resolves.toEqual({ data: [{ id: "a" }], meta });
  });

  it("adminList rejeita meta ausente ou incompleto (INVALID_RESPONSE), em vez de inventar paginação", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [] }));
    await expect(adminList("/admin/workspaces")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    fetchMock.mockResolvedValue(jsonResponse(200, { data: [], meta: { page: 1 } }));
    await expect(adminList("/admin/workspaces")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    fetchMock.mockResolvedValue(jsonResponse(200, { data: { not: "a list" }, meta: { page: 1, per_page: 25, total: 0, total_pages: 0 } }));
    await expect(adminList("/admin/workspaces")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("adminFeed devolve o cursor", async () => {
    const meta = { next_cursor: "abc", has_more: true };
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [{ id: "e1" }], meta }));
    await expect(adminFeed("/admin/activity", { limit: 50 })).resolves.toEqual({ data: [{ id: "e1" }], meta });

    fetchMock.mockResolvedValue(jsonResponse(200, { data: [], meta: { has_more: "sim" } }));
    await expect(adminFeed("/admin/activity")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("adminGetEnvelope preserva o meta de alertas", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [], meta: { computed_at: "2026-10-31T12:00:00Z" } }));
    await expect(adminGetEnvelope("/admin/health/alerts")).resolves.toEqual({
      data: [],
      meta: { computed_at: "2026-10-31T12:00:00Z" },
    });
  });

  it("corpo fora do envelope é INVALID_RESPONSE", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "sem-envelope" }));
    await expect(adminGet("/admin/workspaces/w1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});

describe("escrita (Idempotency-Key)", () => {
  it("adminPost manda o corpo JSON e a chave", async () => {
    const key = newIdempotencyKey();
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { id: "w1", status: "suspended" } }));

    const result = await adminPost("/admin/workspaces/w1/suspend", { reason: "inadimplência" }, { idempotencyKey: key });

    expect(result).toEqual({ id: "w1", status: "suspended" });
    const { init, headers } = lastCall();
    expect(init.method).toBe("POST");
    expect(headers["Idempotency-Key"]).toBe(key);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "inadimplência" });
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("workspace-id");
  });

  it("adminPatch usa PATCH", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { id: "w1" } }));
    await adminPatch("/admin/workspaces/w1", { reason: "corrigir nome", name: "Novo" }, { idempotencyKey: newIdempotencyKey() });
    expect(lastCall().init.method).toBe("PATCH");
  });

  it("ação sem corpo ainda manda {}: o servidor valida o DTO", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: {} }));
    await adminPost("/admin/users/1/revoke-sessions", undefined, { idempotencyKey: newIdempotencyKey() });
    expect(JSON.parse(lastCall().init.body as string)).toEqual({});
  });

  it("204 devolve undefined", async () => {
    fetchMock.mockResolvedValue(jsonResponse(204));
    await expect(adminPost("/admin/x", {}, { idempotencyKey: newIdempotencyKey() })).resolves.toBeUndefined();
  });

  it("recusa uma chave que não é UUID v4 (erro de programação, antes de ir à rede)", async () => {
    await expect(adminPost("/admin/x", {}, { idempotencyKey: "123" })).rejects.toThrow(/Idempotency-Key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("newIdempotencyKey gera UUID v4 diferentes", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).toMatch(UUID_V4);
    expect(b).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });
});

describe("mapeamento de erros (AdminErrorBody)", () => {
  it("usa o código de domínio do contrato e o texto do servidor", () => {
    const err = toAdminApiError(409, {
      statusCode: 409,
      message: "O workspace tem saldo em custódia.",
      error: "WORKSPACE_DELETE_BLOCKED",
      details: { blockers: [{ code: "HAS_CUSTODY_BALANCE", message: "Saldo" }] },
    });
    expect(err).toBeInstanceOf(AdminApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("WORKSPACE_DELETE_BLOCKED");
    expect(err.message).toBe("O workspace tem saldo em custódia.");
    expect(err.details).toEqual({ blockers: [{ code: "HAS_CUSTODY_BALANCE", message: "Saldo" }] });
  });

  it("message pode ser uma lista (validação): vira texto único e mantém a lista em messages", () => {
    const err = toAdminApiError(400, { statusCode: 400, message: ["reason deve ter ao menos 5 caracteres", "reason é obrigatório"], error: "Bad Request" });
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.messages).toEqual(["reason deve ter ao menos 5 caracteres", "reason é obrigatório"]);
    expect(err.message).toBe("reason deve ter ao menos 5 caracteres · reason é obrigatório");
  });

  it("404 de rota que o servidor não tem vira ENDPOINT_UNAVAILABLE", () => {
    const err = toAdminApiError(404, { statusCode: 404, message: "Cannot GET /api/backoffice/admin/workspaces", error: "Not Found" });
    expect(err.code).toBe("ENDPOINT_UNAVAILABLE");
    expect(err.message).toBe("Este recurso ainda não está disponível no servidor.");
  });

  it("404 sem corpo JSON (proxy/CDN) também é ENDPOINT_UNAVAILABLE", () => {
    expect(toAdminApiError(404, undefined).code).toBe("ENDPOINT_UNAVAILABLE");
  });

  it("404 de um registro que não existe é NOT_FOUND, com o texto do servidor", () => {
    const err = toAdminApiError(404, { statusCode: 404, message: "Workspace não encontrado", error: "Not Found" });
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Workspace não encontrado");
  });

  it("os códigos de acesso do cliente final chegam como vieram", () => {
    expect(toAdminApiError(403, { message: "Conta suspensa", error: "ACCOUNT_SUSPENDED" }).code).toBe("ACCOUNT_SUSPENDED");
    expect(toAdminApiError(403, { message: "x", error: "WORKSPACE_SUSPENDED" }).code).toBe("WORKSPACE_SUSPENDED");
    expect(toAdminApiError(404, { message: "x", error: "WORKSPACE_DELETED" }).code).toBe("WORKSPACE_DELETED");
  });

  it("mensagens técnicas de 401/403/5xx não vazam para a tela", () => {
    expect(toAdminApiError(401, { message: "Unauthorized" }).message).toBe("Sua sessão expirou. Entre novamente.");
    expect(toAdminApiError(403, { message: "Forbidden resource" }).message).toBe("Você não tem permissão para acessar este recurso.");
    const server = toAdminApiError(500, { message: "SELECT * FROM users failed: connection refused" });
    expect(server.code).toBe("SERVER_ERROR");
    expect(server.message).not.toMatch(/SELECT|connection/);
  });

  it("status sem código de domínio caem nos genéricos", () => {
    expect(toAdminApiError(409, { message: "x" }).code).toBe("CONFLICT");
    expect(toAdminApiError(422, { message: "nome não confere" }).code).toBe("UNPROCESSABLE");
    expect(toAdminApiError(429, {}).code).toBe("RATE_LIMITED");
    expect(toAdminApiError(502, "<html>")).toMatchObject({ code: "SERVER_ERROR" });
  });

  it("isClientError e isAdminApiError", () => {
    expect(isClientError(toAdminApiError(422, {}))).toBe(true);
    expect(isClientError(toAdminApiError(500, {}))).toBe(false);
    expect(isClientError(new Error("x"))).toBe(false);
    expect(isAdminApiError(toAdminApiError(401, {}), "UNAUTHENTICATED")).toBe(true);
    expect(isAdminApiError(toAdminApiError(401, {}), "FORBIDDEN")).toBe(false);
    expect(isAdminApiError("x")).toBe(false);
  });
});

describe("erros na chamada", () => {
  it("401 avisa o handler de sessão e lança o erro tipado", async () => {
    const handler = vi.fn();
    setAdminUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse(401, { statusCode: 401, message: "Unauthorized" }));

    await expect(adminGet("/admin/overview")).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBeInstanceOf(AdminApiError);
  });

  it("ACCOUNT_SUSPENDED (conta suspensa por outro admin) também encerra a sessão", async () => {
    const handler = vi.fn();
    setAdminUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse(403, { statusCode: 403, message: "Conta suspensa", error: "ACCOUNT_SUSPENDED" }));

    await expect(adminGet("/admin/overview")).rejects.toMatchObject({ status: 403, code: "ACCOUNT_SUSPENDED" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("403 comum (sem permissão) NÃO derruba a sessão", async () => {
    const handler = vi.fn();
    setAdminUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse(403, { statusCode: 403, message: "Forbidden resource" }));

    await expect(adminGet("/admin/overview")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("um handler que falha não troca o erro da requisição", async () => {
    setAdminUnauthorizedHandler(() => {
      throw new Error("falha no handler");
    });
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    await expect(adminGet("/admin/overview")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rede fora do ar vira NETWORK_ERROR (status 0)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(adminGet("/admin/overview")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });

  it("cancelamento (AbortError) passa como está: não é falha da API", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    fetchMock.mockRejectedValue(abort);
    await expect(adminGet("/admin/overview")).rejects.toBe(abort);
  });

  it("repassa o signal ao fetch", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: 1 }));
    const controller = new AbortController();
    await adminGet("/admin/overview", undefined, { signal: controller.signal });
    expect(lastCall().init.signal).toBe(controller.signal);
  });

  it("o desregistro do handler só vale para quem registrou", () => {
    const first = vi.fn();
    const second = vi.fn();
    const undoFirst = setAdminUnauthorizedHandler(first);
    setAdminUnauthorizedHandler(second);
    undoFirst(); // o primeiro já foi trocado: não pode apagar o segundo
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    return adminGet("/admin/x").catch(() => {
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });
});

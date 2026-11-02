import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getAuthToken: () => "tok-1",
  getWorkspaceId: () => "11111111-1111-4111-8111-111111111111",
}));

import { readWorkspaceStateError } from "@/lib/workspace-state/lifecycle-errors";

import { apiDelete, apiGet, apiPost } from "./http-client";

const fetchMock = vi.fn();

function json(status: number, payload?: unknown): Response {
  return new Response(payload === undefined ? null : JSON.stringify(payload), {
    status,
    headers: payload === undefined ? {} : { "Content-Type": "application/json" },
  });
}

async function failure(promise: Promise<unknown>): Promise<Error & { status?: number; code?: string; details?: unknown }> {
  try {
    await promise;
  } catch (error) {
    return error as Error & { status?: number; code?: string; details?: unknown };
  }
  throw new Error("a chamada deveria ter falhado");
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("http-client: sucesso", () => {
  it("manda o workspace e o token, e devolve o conteúdo de { data }", async () => {
    fetchMock.mockResolvedValue(json(200, { data: [{ id: 1 }] }));
    await expect(apiGet("/campaigns")).resolves.toEqual([{ id: 1 }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://api.test/api/backoffice/campaigns");
    expect(init.headers["Workspace-Id"]).toBe("11111111-1111-4111-8111-111111111111");
    expect(init.headers.Authorization).toBe("Bearer tok-1");
  });

  it("204 devolve undefined", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiDelete("/campaigns/1")).resolves.toBeUndefined();
  });
});

describe("http-client: erro", () => {
  it("o erro é um Error com o texto do servidor, o status, o código e os details", async () => {
    fetchMock.mockResolvedValue(
      json(403, { statusCode: 403, message: "Este workspace está suspenso.", error: "WORKSPACE_SUSPENDED", details: { x: 1 } }),
    );
    const error = await failure(apiGet("/campaigns"));
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Este workspace está suspenso.");
    expect(error.status).toBe(403);
    expect(error.code).toBe("WORKSPACE_SUSPENDED");
    expect(error.details).toEqual({ x: 1 });
  });

  it("o código fica reconhecível para a política de repetição (ele não se perde no Error)", async () => {
    fetchMock.mockResolvedValue(json(403, { statusCode: 403, message: "arquivado", error: "WORKSPACE_ARCHIVED" }));
    const error = await failure(apiPost("/campaigns", { title: "x" }));
    expect(readWorkspaceStateError(error)?.code).toBe("WORKSPACE_ARCHIVED");
  });

  it("mensagem em lista (validação) vira um texto só, em vez de o nome do erro", async () => {
    fetchMock.mockResolvedValue(json(400, { statusCode: 400, message: ["título é obrigatório", "prazo inválido"], error: "Bad Request" }));
    const error = await failure(apiPost("/campaigns", {}));
    expect(error.message).toBe("título é obrigatório prazo inválido");
    expect(error.status).toBe(400);
  });

  it("sem `message`, o `error` do corpo; sem corpo, o texto padrão da chamada", async () => {
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401, error: "Unauthorized" }));
    expect((await failure(apiGet("/campaigns"))).message).toBe("Unauthorized");

    fetchMock.mockResolvedValueOnce(new Response("<html>bad gateway</html>", { status: 502 }));
    const bare = await failure(apiGet("/campaigns"));
    expect(bare.message).toBe("Request failed: /campaigns (502)");
    expect(bare.status).toBe(502);
    expect(bare.code).toBeUndefined();
  });
});

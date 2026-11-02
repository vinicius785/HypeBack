import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  base: "https://api.test/api/backoffice" as string | null,
  stored: null as string | null,
}));

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => {
    if (env.base === null) throw new Error("Unable to get base url.");
    return `${env.base}${path}`;
  },
  getWorkspaceId: () => env.stored,
}));

import { installWorkspaceStateObserver, type WorkspaceStateEvent } from "./response-observer";

const API = "https://api.test/api/backoffice";

function body(status: number, payload: unknown): Response {
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const refusal = (code: string, message = "texto do servidor") => ({ statusCode: 403, message, error: code });

let fetchMock: ReturnType<typeof vi.fn>;
let events: WorkspaceStateEvent[];
let uninstall: () => void;

/** Dá tempo da leitura da cópia do corpo (que roda depois de a resposta voltar) terminar. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function call(url: string, init?: RequestInit): Promise<Response> {
  const response = await globalThis.fetch(url, init);
  await settle();
  return response;
}

beforeEach(() => {
  env.base = API;
  env.stored = null;
  events = [];
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  uninstall = installWorkspaceStateObserver((event) => events.push(event));
});

afterEach(() => {
  uninstall();
  vi.unstubAllGlobals();
});

describe("reconhece o estado do workspace em qualquer chamada", () => {
  it("403 WORKSPACE_SUSPENDED: avisa com o workspace do header Workspace-Id", async () => {
    fetchMock.mockResolvedValue(body(403, refusal("WORKSPACE_SUSPENDED", "Este workspace está suspenso.")));
    await call(`${API}/campaigns`, { method: "GET", headers: { "Workspace-Id": "w-123", Authorization: "Bearer t" } });
    expect(events).toEqual([
      { code: "WORKSPACE_SUSPENDED", workspaceId: "w-123", status: 403, message: "Este workspace está suspenso." },
    ]);
  });

  it("403 WORKSPACE_ARCHIVED numa escrita e 404 WORKSPACE_DELETED", async () => {
    fetchMock.mockResolvedValueOnce(body(403, refusal("WORKSPACE_ARCHIVED", "Somente consulta.")));
    await call(`${API}/campaigns`, { method: "POST", headers: { "Workspace-Id": "w-1" } });
    fetchMock.mockResolvedValueOnce(body(404, { statusCode: 404, message: "Excluído.", error: "WORKSPACE_DELETED" }));
    await call(`${API}/campaigns/9`, { method: "GET", headers: { "Workspace-Id": "w-2" } });
    expect(events.map((e) => [e.code, e.workspaceId, e.status])).toEqual([
      ["WORKSPACE_ARCHIVED", "w-1", 403],
      ["WORKSPACE_DELETED", "w-2", 404],
    ]);
  });

  it("mensagem em lista vira um texto só", async () => {
    fetchMock.mockResolvedValue(body(403, { statusCode: 403, message: ["a", "b"], error: "WORKSPACE_SUSPENDED" }));
    await call(`${API}/campaigns`, { headers: { "Workspace-Id": "w" } });
    expect(events[0].message).toBe("a b");
  });

  it("o header é lido em qualquer formato: objeto (sem diferenciar maiúsculas), Headers, lista de pares e Request", async () => {
    fetchMock.mockImplementation(async () => body(403, refusal("WORKSPACE_SUSPENDED")));
    await call(`${API}/a`, { headers: { "workspace-id": "w-obj" } });
    await call(`${API}/b`, { headers: new Headers({ "Workspace-Id": "w-headers" }) });
    await call(`${API}/c`, { headers: [["Workspace-Id", "w-pairs"]] });
    await globalThis.fetch(new Request(`${API}/d`, { headers: { "Workspace-Id": "w-request" } }));
    await settle();
    expect(events.map((e) => e.workspaceId)).toEqual(["w-obj", "w-headers", "w-pairs", "w-request"]);
  });

  it("sem header, o workspace é o da URL (/workspaces/:id/...)", async () => {
    fetchMock.mockResolvedValue(body(403, refusal("WORKSPACE_SUSPENDED")));
    await call(`${API}/workspaces/w-url/members?page=1`, { method: "GET" });
    await call(`${API}/workspaces/w%2Fx`, { method: "DELETE" });
    expect(events.map((e) => e.workspaceId)).toEqual(["w-url", "w/x"]);
  });

  it("sem header nem workspace na URL, é o workspace guardado (ou nenhum)", async () => {
    fetchMock.mockResolvedValue(body(403, refusal("WORKSPACE_SUSPENDED")));
    env.stored = "w-stored";
    await call(`${API}/me/workspaces`);
    env.stored = null;
    await call(`${API}/me/workspaces`);
    expect(events.map((e) => e.workspaceId)).toEqual(["w-stored", undefined]);
  });

  it("o header vale mais que o guardado: a chamada em voo é do workspace de quando ela saiu", async () => {
    fetchMock.mockResolvedValue(body(403, refusal("WORKSPACE_ARCHIVED")));
    env.stored = "w-novo";
    await call(`${API}/campaigns`, { method: "POST", headers: { "Workspace-Id": "w-antigo" } });
    expect(events[0].workspaceId).toBe("w-antigo");
  });
});

describe("não reage ao que não é estado do workspace", () => {
  const cases: Array<[string, number, unknown, string]> = [
    ["sucesso", 200, { data: [] }, `${API}/campaigns`],
    ["403 comum (sem permissão)", 403, { statusCode: 403, message: "Forbidden resource", error: "Forbidden" }, `${API}/campaigns`],
    ["403 sem corpo reconhecível", 403, "não é json", `${API}/campaigns`],
    ["ACCOUNT_SUSPENDED (tratado no login)", 403, refusal("ACCOUNT_SUSPENDED"), `${API}/auth/login`],
    ["WORKSPACE_DELETE_BLOCKED (tratado no diálogo)", 409, { statusCode: 409, error: "WORKSPACE_DELETE_BLOCKED" }, `${API}/workspaces/w1`],
    ["500 mesmo com o código no corpo", 500, refusal("WORKSPACE_SUSPENDED"), `${API}/campaigns`],
    ["chamada a outro servidor", 403, refusal("WORKSPACE_SUSPENDED"), "https://viacep.com.br/ws/01001000/json/"],
    ["prefixo parecido com o da API", 403, refusal("WORKSPACE_SUSPENDED"), "https://api.test/api/backoffice-other/campaigns"],
    ["Admin da plataforma (escopo global)", 403, refusal("WORKSPACE_SUSPENDED"), `${API}/admin/workspaces/w1`],
  ];

  it.each(cases)("%s", async (_name, status, payload, url) => {
    fetchMock.mockResolvedValue(body(status, payload));
    await call(url, { headers: { "Workspace-Id": "w1" } });
    expect(events).toEqual([]);
  });

  it("sem base da API configurada o observador fica inerte (e a chamada segue)", async () => {
    env.base = null;
    fetchMock.mockResolvedValue(body(403, refusal("WORKSPACE_SUSPENDED")));
    const response = await call(`${API}/campaigns`);
    expect(response.status).toBe(403);
    expect(events).toEqual([]);
  });
});

describe("não atrapalha a chamada", () => {
  it("devolve a resposta original, com o corpo ainda legível para o serviço", async () => {
    const original = body(403, refusal("WORKSPACE_SUSPENDED", "Suspenso."));
    fetchMock.mockResolvedValue(original);
    const response = await globalThis.fetch(`${API}/campaigns`, { headers: { "Workspace-Id": "w1" } });
    expect(response).toBe(original);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "WORKSPACE_SUSPENDED", message: "Suspenso." });
    await settle();
    expect(events).toHaveLength(1);
  });

  it("repassa os argumentos como vieram e falha de rede sobe sem mudança", async () => {
    const networkError = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValue(networkError);
    const init = { method: "PUT", headers: { "Workspace-Id": "w1" }, body: "{}" };
    await expect(globalThis.fetch(`${API}/campaigns/1`, init)).rejects.toBe(networkError);
    expect(fetchMock).toHaveBeenCalledWith(`${API}/campaigns/1`, init);
    expect(events).toEqual([]);
  });

  it("um ouvinte que falha não vira falha da chamada", async () => {
    uninstall();
    uninstall = installWorkspaceStateObserver(() => {
      throw new Error("ouvinte quebrado");
    });
    fetchMock.mockResolvedValue(body(403, refusal("WORKSPACE_SUSPENDED")));
    const response = await call(`${API}/campaigns`, { headers: { "Workspace-Id": "w1" } });
    expect(response.status).toBe(403);
  });

  it("resposta que não é uma Response de verdade (mock simples de outro teste) passa direto", async () => {
    const fake = { ok: false, status: 403 } as unknown as Response;
    fetchMock.mockResolvedValue(fake);
    await expect(globalThis.fetch(`${API}/campaigns`)).resolves.toBe(fake);
    await settle();
    expect(events).toEqual([]);
  });
});

describe("instalação", () => {
  it("desfazer devolve o fetch de antes e para de avisar", async () => {
    expect(globalThis.fetch).not.toBe(fetchMock);
    uninstall();
    expect(globalThis.fetch).toBe(fetchMock);
    fetchMock.mockResolvedValue(body(403, refusal("WORKSPACE_SUSPENDED")));
    await call(`${API}/campaigns`, { headers: { "Workspace-Id": "w1" } });
    expect(events).toEqual([]);
  });

  it("instalações empilham e desfazem em qualquer ordem sem perder o fetch de ninguém", async () => {
    const second: WorkspaceStateEvent[] = [];
    const uninstallSecond = installWorkspaceStateObserver((event) => second.push(event));
    fetchMock.mockResolvedValue(body(403, refusal("WORKSPACE_SUSPENDED")));
    await call(`${API}/campaigns`, { headers: { "Workspace-Id": "w1" } });
    expect(events).toHaveLength(1);
    expect(second).toHaveLength(1);

    // a primeira sai antes da segunda: o fetch atual continua sendo o da segunda, e a primeira fica inerte
    uninstall();
    const current = globalThis.fetch;
    await call(`${API}/campaigns`, { headers: { "Workspace-Id": "w1" } });
    expect(events).toHaveLength(1);
    expect(second).toHaveLength(2);
    expect(globalThis.fetch).toBe(current);

    uninstallSecond();
    uninstall = () => {};
    // a primeira embrulhava o mock e a segunda embrulhava a primeira; a segunda devolve o que era a primeira
    // (inerte), e a chamada continua chegando ao mock
    await call(`${API}/campaigns`, { headers: { "Workspace-Id": "w1" } });
    expect(events).toHaveLength(1);
    expect(second).toHaveLength(2);
  });
});

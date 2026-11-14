/**
 * Operação Escudo no cliente HTTP do Admin.
 *
 * O QUE PRECISA FUNCIONAR:
 *   - com o Escudo ligado (sabido), a alteração pede o código ANTES e vai com `X-Shield-Code`;
 *   - sem saber, o 403 `SHIELD_CODE_REQUIRED` abre o pedido e a MESMA chamada é repetida com o cabeçalho;
 *   - `SHIELD_CODE_INVALID` pede de novo; `SHIELD_CODE_LOCKED` não repete e diz para esperar 15 minutos;
 *   - cancelar o pedido não envia a alteração; leituras e rotas isentas nunca pedem código.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getAuthToken: () => "tok",
}));

import { AdminApiError, adminDelete, adminGet, adminPatch, adminPost, adminPostPlain, newIdempotencyKey } from "./admin-client";
import { isShieldExempt, isShieldWrite, setShieldActive, setShieldCodeProvider } from "./shield";

const fetchMock = vi.fn();
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: body === undefined ? {} : { "Content-Type": "application/json" } });
const shieldError = (code: string) => json(403, { statusCode: 403, message: "x", error: code });
const headersOf = (index: number) => (fetchMock.mock.calls[index][1] as { headers: Record<string, string> }).headers;

let ask: ReturnType<typeof vi.fn>;
let unregister: () => void;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  ask = vi.fn();
  unregister = setShieldCodeProvider(ask as never);
  setShieldActive(false);
});
afterEach(() => {
  unregister();
  setShieldActive(false);
  vi.unstubAllGlobals();
});

describe("rotas isentas e escritas", () => {
  it("o Escudo, marcar como visto e o Suporte são isentos; o resto das alterações não", () => {
    expect(isShieldExempt("/admin/security/shield/activate")).toBe(true);
    expect(isShieldExempt("/admin/security/shield")).toBe(true);
    expect(isShieldExempt("/admin/security/alerts/12/seen")).toBe(true);
    expect(isShieldExempt("/admin/security/alerts/seen-all")).toBe(true);
    expect(isShieldExempt("/admin/support/tickets/t1/messages")).toBe(true);
    expect(isShieldExempt("/admin/security/watchlist")).toBe(false);
    expect(isShieldExempt("/admin/users/3/suspend")).toBe(false);
    expect(isShieldWrite("POST") && isShieldWrite("PUT") && isShieldWrite("PATCH") && isShieldWrite("DELETE")).toBe(true);
    expect(isShieldWrite("GET")).toBe(false);
  });
});

describe("interceptador do código", () => {
  it("Escudo ligado: pede o código ANTES e manda X-Shield-Code na primeira chamada", async () => {
    setShieldActive(true);
    ask.mockResolvedValue("123456");
    fetchMock.mockResolvedValue(json(200, { data: { ok: true } }));
    await adminPost("/admin/users/1/suspend", { reason: "abcde" }, { idempotencyKey: newIdempotencyKey() });
    expect(ask).toHaveBeenCalledWith("proactive");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(headersOf(0)["X-Shield-Code"]).toBe("123456");
  });

  it("sem saber do Escudo: 403 SHIELD_CODE_REQUIRED pede o código e repete a MESMA chamada com o cabeçalho", async () => {
    ask.mockResolvedValue("654321");
    fetchMock.mockResolvedValueOnce(shieldError("SHIELD_CODE_REQUIRED")).mockResolvedValueOnce(json(200, { data: { id: 1 } }));
    const key = newIdempotencyKey();
    const result = await adminPatch<{ id: number }>("/admin/workspaces/9", { name: "Novo" }, { idempotencyKey: key });
    expect(result).toEqual({ id: 1 });
    expect(ask).toHaveBeenCalledWith("required");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(headersOf(0)["X-Shield-Code"]).toBeUndefined();
    expect(headersOf(1)["X-Shield-Code"]).toBe("654321");
    // mesma chamada: mesmo caminho, mesmo corpo, mesma chave de idempotência
    expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[0][0]);
    expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
    expect(headersOf(1)["Idempotency-Key"]).toBe(key);
  });

  it("SHIELD_CODE_INVALID pede de novo; a terceira tentativa passa", async () => {
    ask.mockResolvedValueOnce("111111").mockResolvedValueOnce("222222");
    fetchMock
      .mockResolvedValueOnce(shieldError("SHIELD_CODE_REQUIRED"))
      .mockResolvedValueOnce(shieldError("SHIELD_CODE_INVALID"))
      .mockResolvedValueOnce(json(204));
    await adminDelete("/admin/security/watchlist/3");
    expect(ask.mock.calls.map((c) => c[0])).toEqual(["required", "invalid"]);
    expect(headersOf(2)["X-Shield-Code"]).toBe("222222");
  });

  it("SHIELD_CODE_LOCKED não repete e diz para aguardar 15 minutos", async () => {
    setShieldActive(true);
    ask.mockResolvedValue("123456");
    fetchMock.mockResolvedValue(shieldError("SHIELD_CODE_LOCKED"));
    const error = await adminPostPlain("/admin/security/watchlist", { email: "a@b.co" }).catch((e) => e);
    expect(error).toBeInstanceOf(AdminApiError);
    expect((error as AdminApiError).code).toBe("SHIELD_CODE_LOCKED");
    expect((error as AdminApiError).message).toBe("Muitas tentativas. Aguarde 15 minutos.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("cancelar o pedido não envia a alteração (proativo) e devolve o erro (reativo)", async () => {
    setShieldActive(true);
    ask.mockResolvedValue(null);
    await expect(adminPostPlain("/admin/security/watchlist", {})).rejects.toMatchObject({ code: "SHIELD_CODE_REQUIRED" });
    expect(fetchMock).not.toHaveBeenCalled();

    setShieldActive(false);
    fetchMock.mockResolvedValue(shieldError("SHIELD_CODE_REQUIRED"));
    await expect(adminPostPlain("/admin/security/watchlist", {})).rejects.toMatchObject({ code: "SHIELD_CODE_REQUIRED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leituras e rotas isentas nunca pedem código, nem com o Escudo ligado", async () => {
    setShieldActive(true);
    fetchMock.mockResolvedValue(json(200, { data: { x: 1 } }));
    await adminGet("/admin/security/shield");
    await adminPostPlain("/admin/security/shield/activate", { code: "123456" });
    await adminPostPlain("/admin/security/alerts/4/seen");
    await adminPostPlain("/admin/support/tickets/t1/messages", { body: "oi" });
    expect(ask).not.toHaveBeenCalled();
    for (let i = 0; i < 4; i += 1) expect(headersOf(i)["X-Shield-Code"]).toBeUndefined();
  });

  it("sem pedido de código registrado (fora do Admin), o 403 vira o erro normal", async () => {
    unregister();
    fetchMock.mockResolvedValue(shieldError("SHIELD_CODE_REQUIRED"));
    await expect(adminPostPlain("/admin/security/watchlist", {})).rejects.toMatchObject({ code: "SHIELD_CODE_REQUIRED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unregister = setShieldCodeProvider(ask as never);
  });
});

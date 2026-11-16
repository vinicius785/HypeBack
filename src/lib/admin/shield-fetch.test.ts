import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setShieldActive, setShieldCodeProvider, shieldFetch } from "./shield";

const URL_WRITE = "https://api.test/api/backoffice/admin/notifications";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("shieldFetch (alterações do Admin fora do cliente do Admin)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setShieldActive(false);
  });
  afterEach(() => {
    setShieldCodeProvider(null);
    setShieldActive(false);
    vi.unstubAllGlobals();
  });

  it("leitura passa direto, sem código", async () => {
    fetchMock.mockResolvedValue(json(200, { data: [] }));
    const provider = vi.fn();
    setShieldCodeProvider(provider);
    setShieldActive(true);
    await shieldFetch(URL_WRITE, { method: "GET" });
    expect(provider).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Escudo desligado: alteração sai sem cabeçalho", async () => {
    fetchMock.mockResolvedValue(json(201, { data: {} }));
    await shieldFetch(URL_WRITE, { method: "POST", headers: { A: "1" } });
    const sent = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(sent.has("X-Shield-Code")).toBe(false);
  });

  it("Escudo ligado: pede o código antes e manda X-Shield-Code", async () => {
    fetchMock.mockResolvedValue(json(201, { data: {} }));
    const provider = vi.fn().mockResolvedValue("123456");
    setShieldCodeProvider(provider);
    setShieldActive(true);
    const res = await shieldFetch(URL_WRITE, { method: "POST", headers: { A: "1" } });
    expect(res.status).toBe(201);
    expect(provider).toHaveBeenCalledWith("proactive");
    const sent = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(sent.get("X-Shield-Code")).toBe("123456");
    expect(sent.get("A")).toBe("1");
  });

  it("403 SHIELD_CODE_REQUIRED: pede o código e repete a mesma chamada", async () => {
    fetchMock.mockResolvedValueOnce(json(403, { error: "SHIELD_CODE_REQUIRED" })).mockResolvedValueOnce(json(201, { data: {} }));
    const provider = vi.fn().mockResolvedValue("654321");
    setShieldCodeProvider(provider);
    const res = await shieldFetch(URL_WRITE, { method: "POST", body: "{}" });
    expect(res.status).toBe(201);
    expect(provider).toHaveBeenCalledWith("required");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get("X-Shield-Code")).toBe("654321");
    expect(fetchMock.mock.calls[1][1].body).toBe("{}");
  });

  it("cancelar o pedido devolve o 403 como veio; código travado não repete", async () => {
    fetchMock.mockResolvedValue(json(403, { error: "SHIELD_CODE_REQUIRED" }));
    setShieldCodeProvider(vi.fn().mockResolvedValue(null));
    expect((await shieldFetch(URL_WRITE, { method: "POST" })).status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json(403, { error: "SHIELD_CODE_LOCKED" }));
    const provider = vi.fn().mockResolvedValue("111111");
    setShieldCodeProvider(provider);
    expect((await shieldFetch(URL_WRITE, { method: "POST" })).status).toBe(403);
    expect(provider).not.toHaveBeenCalled();
  });

  it("rotas do Escudo e do Suporte nunca pedem o código", async () => {
    fetchMock.mockResolvedValue(json(200, { data: {} }));
    const provider = vi.fn();
    setShieldCodeProvider(provider);
    setShieldActive(true);
    await shieldFetch("https://api.test/api/backoffice/admin/support/tickets/1/messages", { method: "POST" });
    expect(provider).not.toHaveBeenCalled();
  });

  it("proactive:false só reage ao 403", async () => {
    fetchMock.mockResolvedValue(json(200, { data: {} }));
    const provider = vi.fn();
    setShieldCodeProvider(provider);
    setShieldActive(true);
    await shieldFetch(URL_WRITE + "/estimate-audience", { method: "POST" }, { proactive: false });
    expect(provider).not.toHaveBeenCalled();
  });
});

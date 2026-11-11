import { afterEach, describe, expect, it, vi } from "vitest";

import { getBackendOrigin, isTrustedPopupMessage } from "./public-campaign-invite";

describe("isTrustedPopupMessage (falha fechada)", () => {
  const backend = "https://api-v2.hypeapp.com.br";

  it("aceita só a mensagem vinda EXATAMENTE da origem do backend", () => {
    expect(isTrustedPopupMessage(backend, backend)).toBe(true);
  });

  it("recusa outra origem, inclusive parecida", () => {
    expect(isTrustedPopupMessage("https://evil.example", backend)).toBe(false);
    expect(isTrustedPopupMessage("https://api-v2.hypeapp.com.br.evil.example", backend)).toBe(false);
    expect(isTrustedPopupMessage("http://api-v2.hypeapp.com.br", backend)).toBe(false);
    expect(isTrustedPopupMessage("", backend)).toBe(false);
  });

  it("SEM origem do backend configurada, NENHUMA mensagem é aceita (antes, qualquer uma passava)", () => {
    expect(isTrustedPopupMessage("https://evil.example", "")).toBe(false);
    expect(isTrustedPopupMessage("", "")).toBe(false);
    expect(isTrustedPopupMessage(backend, "")).toBe(false);
  });
});

describe("getBackendOrigin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("devolve só a origem (sem caminho) da URL do servidor", () => {
    vi.stubEnv("VITE_SERVER_URL", "https://api-v2.hypeapp.com.br/api");
    expect(getBackendOrigin()).toBe("https://api-v2.hypeapp.com.br");
  });

  it("variável ausente ou inválida devolve vazio (e aí nenhuma mensagem é aceita)", () => {
    vi.stubEnv("VITE_SERVER_URL", "");
    expect(getBackendOrigin()).toBe("");
    vi.stubEnv("VITE_SERVER_URL", "isto-nao-e-url");
    expect(getBackendOrigin()).toBe("");
  });
});

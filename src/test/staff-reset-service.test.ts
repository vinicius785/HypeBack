/** `staffResetPassword`: chamada pública (sem Authorization), com `Client-Type: backoffice`, e erros tipados. */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getAuthToken: () => "token-que-nao-deve-ir",
  getWorkspaceId: () => "ws-1",
}));
vi.mock("../lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getAuthToken: () => "token-que-nao-deve-ir",
}));

import { StaffResetError, staffResetPassword } from "@/shared/services/auth";

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
const lastCall = () => (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1) as [string, RequestInit];
const DATA = { email: "lucas@vocenohype.com", code: "AB3D-9XK2-M7QP", password: "uma-senha-bem-forte-123" };

afterEach(() => vi.restoreAllMocks());

describe("staffResetPassword", () => {
  it("POST em /auth/staff-reset-password, sem Authorization e com Client-Type backoffice", async () => {
    globalThis.fetch = vi.fn(async () => json({ data: { message: "Senha redefinida com sucesso. Entre com a nova senha." } })) as unknown as typeof fetch;
    const result = await staffResetPassword(DATA);
    const [url, init] = lastCall();
    expect(url).toBe("https://api.test/api/backoffice/auth/staff-reset-password");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Client-Type"]).toBe("backoffice");
    expect(headers.Authorization).toBeUndefined();
    expect(JSON.parse(String(init.body))).toEqual(DATA);
    expect(result.message).toBe("Senha redefinida com sucesso. Entre com a nova senha.");
  });

  it("erro 400 com lista de textos vira StaffResetError com todas as mensagens", async () => {
    globalThis.fetch = vi.fn(async () => json({ message: ["Código inválido", "Senha é obrigatória"], error: "Bad Request" }, 400)) as unknown as typeof fetch;
    const error = await staffResetPassword(DATA).catch((e) => e);
    expect(error).toBeInstanceOf(StaffResetError);
    expect(error.status).toBe(400);
    expect(error.messages).toEqual(["Código inválido", "Senha é obrigatória"]);
  });

  it("guarda o código de domínio (ANONYMIZER_BLOCKED) e trata corpo ilegível e rede fora do ar", async () => {
    globalThis.fetch = vi.fn(async () => json({ message: "Forbidden", error: "ANONYMIZER_BLOCKED" }, 403)) as unknown as typeof fetch;
    expect(await staffResetPassword(DATA).catch((e) => e)).toMatchObject({ status: 403, code: "ANONYMIZER_BLOCKED" });

    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 502, json: async () => { throw new Error("html"); } }) as unknown as Response) as unknown as typeof fetch;
    expect(await staffResetPassword(DATA).catch((e) => e)).toMatchObject({ status: 502, messages: [] });

    globalThis.fetch = vi.fn(async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    expect(await staffResetPassword(DATA).catch((e) => e)).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });
});

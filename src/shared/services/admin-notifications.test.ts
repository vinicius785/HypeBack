/**
 * Contrato HTTP de `POST /admin/notifications` (envio para os criadores).
 *
 * O que precisa continuar valendo:
 * - o `Idempotency-Key` enviado é o que o chamador passou — assim o reenvio do
 *   mesmo conteúdo é reconhecido pelo servidor em vez de disparar de novo;
 *   só geramos uma chave quando nenhuma vem;
 * - rota global: **sem** header `Workspace-Id`;
 * - resposta desembrulhada de `{ data }` e erro do backend vira `Error.message`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getAuthToken: () => "token-123",
}));

import type { AdminNotificationCreatePayload } from "@/shared/types";
import { createAdminNotification } from "./admin-notifications";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const payload: AdminNotificationCreatePayload = {
  title: "Nova campanha aberta",
  body: "Entre no app e confira.",
  cta_url: null,
  channels: ["push"],
  audience: { type: "all" },
  scheduled_at: null,
};

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

function calls() {
  const mock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  return mock.mock.calls as Array<[string, RequestInit]>;
}

const headersOf = (init: RequestInit) => init.headers as Record<string, string>;

describe("createAdminNotification", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ data: { id: "n-1" } }),
    ) as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  it("faz POST em /admin/notifications com JSON e sem Workspace-Id", async () => {
    await createAdminNotification(payload, "chave-1");

    const [url, init] = calls()[0];
    expect(url).toBe("https://api.test/api/backoffice/admin/notifications");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(payload);
    const headers = headersOf(init);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer token-123");
    expect(headers["Client-Type"]).toBe("backoffice");
    expect(headers).not.toHaveProperty("Workspace-Id");
  });

  it("envia a Idempotency-Key recebida, igual em reenvios do mesmo conteúdo", async () => {
    await createAdminNotification(payload, "chave-fixa");
    await createAdminNotification(payload, "chave-fixa");

    expect(headersOf(calls()[0][1])["Idempotency-Key"]).toBe("chave-fixa");
    expect(headersOf(calls()[1][1])["Idempotency-Key"]).toBe("chave-fixa");
  });

  it("gera uma UUID quando nenhuma chave é passada", async () => {
    await createAdminNotification(payload);

    expect(headersOf(calls()[0][1])["Idempotency-Key"]).toMatch(UUID_RE);
  });

  it("devolve o conteúdo de { data }", async () => {
    const created = await createAdminNotification(payload, "chave-1");

    expect(created).toEqual({ id: "n-1" });
  });

  it("propaga a mensagem de erro do backend", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ message: "Audiência vazia" }, { ok: false, status: 422 }),
    ) as unknown as typeof fetch;

    await expect(createAdminNotification(payload, "chave-1")).rejects.toThrow(
      "Audiência vazia",
    );
  });
});

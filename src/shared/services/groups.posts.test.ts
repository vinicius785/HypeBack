/**
 * Contrato HTTP da publicação em grupo da comunidade (escopo admin/global).
 *
 * O que precisa continuar valendo:
 * - POST em `/admin/community/groups/:id/posts` com JSON;
 * - **sem** header `Workspace-Id` (rota é global, atrás do PlatformAdminGuard);
 * - `client_request_id` sempre presente (idempotência no backend);
 * - `image_url` só vai no corpo quando existe imagem;
 * - resposta é desembrulhada de `{ data }` e o erro do backend vira `Error.message`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getAuthToken: () => "token-123",
  getWorkspaceId: () => "workspace-9",
}));

import {
  createGroupPost,
  uploadCommunityImage,
  uploadGroupCover,
  validateGroupCoverFile,
} from "./groups";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

function lastCall() {
  const mock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  const [url, init] = mock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init };
}

describe("createGroupPost", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ data: { id: "post-1", content: "Oi" } }),
    ) as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  it("faz POST na rota de posts do grupo com JSON e sem Workspace-Id", async () => {
    await createGroupPost("group-abc", { content: "Aviso importante" });

    const { url, init } = lastCall();
    expect(url).toBe(
      "https://api.test/api/backoffice/admin/community/groups/group-abc/posts",
    );
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer token-123");
    expect(headers["Client-Type"]).toBe("backoffice");
    expect(headers).not.toHaveProperty("Workspace-Id");
  });

  it("envia o conteúdo e um client_request_id UUID a cada chamada", async () => {
    await createGroupPost("group-abc", { content: "Primeira" });
    const first = JSON.parse(lastCall().init.body as string);

    await createGroupPost("group-abc", { content: "Segunda" });
    const second = JSON.parse(lastCall().init.body as string);

    expect(first.content).toBe("Primeira");
    expect(first.client_request_id).toMatch(UUID_RE);
    expect(second.client_request_id).toMatch(UUID_RE);
    // Ids distintos: publicações diferentes não podem colidir no índice de
    // idempotência do backend (senão a segunda seria descartada).
    expect(second.client_request_id).not.toBe(first.client_request_id);
  });

  it("omite image_url quando não há imagem e envia quando há", async () => {
    await createGroupPost("group-abc", { content: "Sem imagem" });
    expect(JSON.parse(lastCall().init.body as string)).not.toHaveProperty(
      "image_url",
    );

    await createGroupPost("group-abc", { content: "Sem imagem", image_url: null });
    expect(JSON.parse(lastCall().init.body as string)).not.toHaveProperty(
      "image_url",
    );

    await createGroupPost("group-abc", {
      content: "Com imagem",
      image_url: "/uploads/community/x.png",
    });
    expect(JSON.parse(lastCall().init.body as string).image_url).toBe(
      "/uploads/community/x.png",
    );
  });

  it("desembrulha o envelope { data } da resposta", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ data: { id: "post-9", content: "Publicado" } }),
    ) as unknown as typeof fetch;

    const post = await createGroupPost("group-abc", { content: "Publicado" });

    expect(post).toEqual({ id: "post-9", content: "Publicado" });
  });

  it("propaga a mensagem de erro do backend e o status", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ message: "Group not found" }, { ok: false, status: 404 }),
    ) as unknown as typeof fetch;

    await expect(
      createGroupPost("group-inexistente", { content: "Oi" }),
    ).rejects.toMatchObject({ message: "Group not found", status: 404 });
  });
});

describe("uploadCommunityImage", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ data: { url: "/uploads/community/abc.png" } }),
    ) as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  it("envia multipart no campo `image` e sem Content-Type manual", async () => {
    const file = new File(["binario"], "post.png", { type: "image/png" });

    const result = await uploadCommunityImage(file);

    const { url, init } = lastCall();
    expect(url).toBe(
      "https://api.test/api/backoffice/admin/community/groups/uploads",
    );
    expect(init.method).toBe("POST");
    // Content-Type manual quebraria o boundary do multipart.
    expect(init.headers as Record<string, string>).not.toHaveProperty(
      "Content-Type",
    );
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("image")).toBe(file);
    expect(result).toEqual({ url: "/uploads/community/abc.png" });
  });

  it("uploadGroupCover é a mesma rota (alias)", () => {
    expect(uploadGroupCover).toBe(uploadCommunityImage);
  });
});

describe("validateGroupCoverFile", () => {
  const file = (type: string, size: number) => {
    const f = new File(["x"], "arquivo", { type });
    Object.defineProperty(f, "size", { value: size });
    return f;
  };

  it("aceita jpeg, png e webp dentro de 5 MB", () => {
    expect(validateGroupCoverFile(file("image/jpeg", 1024))).toBeNull();
    expect(validateGroupCoverFile(file("image/png", 1024))).toBeNull();
    expect(validateGroupCoverFile(file("image/webp", 5 * 1024 * 1024))).toBeNull();
  });

  it("recusa formato fora da whitelist", () => {
    expect(validateGroupCoverFile(file("application/pdf", 1024))).toMatch(
      /Formato inválido/,
    );
    expect(validateGroupCoverFile(file("", 1024))).toMatch(/desconhecido/);
  });

  it("recusa arquivo acima de 5 MB", () => {
    expect(validateGroupCoverFile(file("image/png", 5 * 1024 * 1024 + 1))).toMatch(
      /5 MB/,
    );
  });
});

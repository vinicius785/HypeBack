/**
 * Contrato HTTP da moderação global de posts.
 *
 * Pontos que precisam continuar valendo: escopo global (sem `Workspace-Id`),
 * filtro `group` (`all` omitido, `none` = feed geral, id de grupo) e o delete
 * que funciona para qualquer post, dentro ou fora de grupo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getAuthToken: () => "token-123",
  getWorkspaceId: () => "workspace-9",
}));

import { deleteCommunityPost, listCommunityPosts } from "./community-posts";

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

const page = {
  data: [
    {
      id: "post-1",
      content: "Olá",
      image_url: null,
      author: { id: "7", name: "Ana", avatar_url: null },
      group: null,
      likes_count: 0,
      comments_count: 0,
      created_at: "2026-08-27T12:00:00.000Z",
    },
  ],
  meta: { next_cursor: "abc", has_more: true },
};

describe("listCommunityPosts", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(page),
    ) as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  it("busca na rota global, sem Workspace-Id", async () => {
    const result = await listCommunityPosts();

    const { url, init } = lastCall();
    expect(url).toBe("https://api.test/api/backoffice/admin/community/posts");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-123");
    expect(headers).not.toHaveProperty("Workspace-Id");
    expect(result.items).toEqual(page.data);
    expect(result.meta).toEqual(page.meta);
  });

  it("omite o filtro quando o escopo é `all`", async () => {
    await listCommunityPosts({ group: "all" });

    expect(lastCall().url).not.toContain("group=");
  });

  it("envia `none` para listar só o feed geral", async () => {
    await listCommunityPosts({ group: "none" });

    expect(lastCall().url).toContain("group=none");
  });

  it("envia o id do grupo, busca, cursor e limite", async () => {
    await listCommunityPosts({
      group: "group-abc",
      search: "promo",
      cursor: "cur-1",
      limit: 20,
    });

    const { url } = lastCall();
    expect(url).toContain("group=group-abc");
    expect(url).toContain("search=promo");
    expect(url).toContain("cursor=cur-1");
    expect(url).toContain("limit=20");
  });

  it("assume meta vazia quando o backend não manda cursor", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ data: [] }),
    ) as unknown as typeof fetch;

    const result = await listCommunityPosts();

    expect(result).toEqual({
      items: [],
      meta: { next_cursor: null, has_more: false },
    });
  });

  it("propaga a mensagem de erro do backend", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ message: "Group not found" }, { ok: false, status: 404 }),
    ) as unknown as typeof fetch;

    await expect(listCommunityPosts({ group: "nao-existe" })).rejects.toMatchObject(
      { message: "Group not found", status: 404 },
    );
  });
});

describe("deleteCommunityPost", () => {
  it("faz DELETE na rota global do post", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(null, { status: 204 }),
    ) as unknown as typeof fetch;

    await deleteCommunityPost("post-1");

    const { url, init } = lastCall();
    expect(url).toBe(
      "https://api.test/api/backoffice/admin/community/posts/post-1",
    );
    expect(init.method).toBe("DELETE");
    expect(init.headers as Record<string, string>).not.toHaveProperty(
      "Workspace-Id",
    );
  });

  it("propaga a mensagem de erro do backend", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ message: "Post not found" }, { ok: false, status: 404 }),
    ) as unknown as typeof fetch;

    await expect(deleteCommunityPost("sumiu")).rejects.toMatchObject({
      message: "Post not found",
      status: 404,
    });
  });
});

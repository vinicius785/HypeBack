/**
 * Contrato HTTP das publicações no grupo da campanha (escopo workspace).
 *
 * Diferente do escopo admin, aqui o header `Workspace-Id` é obrigatório — sem
 * ele o backend rejeita a requisição.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getAuthToken: () => "token-123",
  getWorkspaceId: () => "workspace-9",
  getUploadUrl: (p: string) => p,
}));

import {
  createCampaignGroupPost,
  listCampaignGroupPosts,
} from "./campaign-groups";

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
      content: "Bem-vindos!",
      origin: "backoffice",
      created_at: "2026-08-27T12:00:00.000Z",
      author_name: "Equipe Hype",
    },
  ],
  meta: { page: 1, per_page: 5, total: 1, total_pages: 1 },
};

describe("listCampaignGroupPosts", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(page),
    ) as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  it("monta a URL com paginação e envia Workspace-Id", async () => {
    const result = await listCampaignGroupPosts("camp-1", "group-abc", {
      page: 1,
      per_page: 5,
    });

    const { url, init } = lastCall();
    expect(url).toBe(
      "https://api.test/api/backoffice/campaigns/camp-1/community-groups/group-abc/posts?page=1&per_page=5",
    );
    expect((init.headers as Record<string, string>)["Workspace-Id"]).toBe(
      "workspace-9",
    );
    expect(result).toEqual(page);
  });

  it("escapa o id do grupo na URL", async () => {
    await listCampaignGroupPosts("camp-1", "group/abc", {
      page: 2,
      per_page: 5,
    });

    expect(lastCall().url).toContain("/community-groups/group%2Fabc/posts");
  });

  it("propaga a mensagem de erro do backend", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(
        { message: "Grupo não vinculado à campanha" },
        { ok: false, status: 404 },
      ),
    ) as unknown as typeof fetch;

    await expect(
      listCampaignGroupPosts("camp-1", "group-abc", { page: 1, per_page: 5 }),
    ).rejects.toMatchObject({
      message: "Grupo não vinculado à campanha",
      status: 404,
    });
  });
});

describe("createCampaignGroupPost", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ data: { id: "post-1" } }),
    ) as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  it("publica com conteúdo e client_request_id de idempotência", async () => {
    await createCampaignGroupPost("camp-1", "group-abc", "Aviso da campanha");

    const { url, init } = lastCall();
    expect(url).toBe(
      "https://api.test/api/backoffice/campaigns/camp-1/community-groups/group-abc/posts",
    );
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.content).toBe("Aviso da campanha");
    expect(body.client_request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

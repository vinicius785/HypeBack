/**
 * Contrato HTTP da equipe da comunidade (moderadores e contas oficiais): escopo global (sem `Workspace-Id`), filtro e
 * busca na URL, paginação e o PATCH que concede ou tira o papel/selo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getAuthToken: () => "token-123",
  getWorkspaceId: () => "workspace-9",
}));

import { listCommunityMembers, updateCommunityMember } from "./community-members";

const res = (body: unknown, init: { ok?: boolean; status?: number } = {}) =>
  ({ ok: init.ok ?? true, status: init.status ?? 200, json: async () => body }) as unknown as Response;
const last = () => {
  const [url, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1) as [string, RequestInit];
  return { url, init };
};

const member = { id: "7", name: "Ana", username: "ana", email: "ana@x.com", avatar_url: null, is_moderator: false, is_verified: true, verified_at: "2026-11-04T00:00:00Z" };

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => res({ data: [member], meta: { page: 1, per_page: 20, total: 1, total_pages: 1 } })) as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

describe("listCommunityMembers", () => {
  it("global: com o token e sem Workspace-Id", async () => {
    await listCommunityMembers();
    const { url, init } = last();
    expect(url).toBe("https://api.test/api/backoffice/admin/community/members");
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer token-123");
    expect(h["Workspace-Id"]).toBeUndefined();
  });

  it("manda filtro, busca aparada e página", async () => {
    await listCommunityMembers({ filter: "all", q: "  ana ", page: 2, perPage: 20 });
    expect(last().url).toBe("https://api.test/api/backoffice/admin/community/members?filter=all&q=ana&page=2&per_page=20");
  });

  it("devolve itens e meta", async () => {
    const page = await listCommunityMembers({ filter: "team" });
    expect(page.items).toEqual([member]);
    expect(page.meta.total_pages).toBe(1);
  });

  it("erro do servidor vira Error com a mensagem e o status", async () => {
    globalThis.fetch = vi.fn(async () => res({ message: "Sem permissão" }, { ok: false, status: 403 })) as unknown as typeof fetch;
    await expect(listCommunityMembers()).rejects.toMatchObject({ message: "Sem permissão", status: 403 });
  });
});

describe("updateCommunityMember", () => {
  it("PATCH com o corpo certo para conceder o selo", async () => {
    globalThis.fetch = vi.fn(async () => res({ data: { ...member, is_verified: true } })) as unknown as typeof fetch;
    const out = await updateCommunityMember("7", { verified: true });
    const { url, init } = last();
    expect(url).toBe("https://api.test/api/backoffice/admin/community/members/7");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ verified: true });
    expect(out.is_verified).toBe(true);
  });

  it("falha traz a mensagem do servidor (lista de validação vira texto)", async () => {
    globalThis.fetch = vi.fn(async () => res({ message: ["moderator deve ser booleano"] }, { ok: false, status: 400 })) as unknown as typeof fetch;
    await expect(updateCommunityMember("7", { moderator: true })).rejects.toMatchObject({ message: "moderator deve ser booleano", status: 400 });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (p: string) => `http://api${p}`,
  getAuthToken: () => "t",
  getWorkspaceId: () => "w1",
}));
vi.mock("./campaign-users", () => ({ getCampaignUsers: vi.fn() }));

import { RateLimitError, getInfluencerMessages, parseRetryAfter } from "./chat";

const ok = (data: unknown[] = []) => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ data }) }) as Response;

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("parseRetryAfter", () => {
  it("segundos, data HTTP, ausente e inválido", () => {
    expect(parseRetryAfter("90")).toBe(90_000);
    expect(parseRetryAfter(null)).toBe(30_000);
    expect(parseRetryAfter("lixo")).toBe(30_000);
    const now = Date.parse("2026-11-13T12:00:00Z");
    expect(parseRetryAfter("Fri, 13 Nov 2026 12:02:00 GMT", now)).toBe(120_000);
  });
  it("tem teto de 5 minutos e piso de 1 segundo", () => {
    expect(parseRetryAfter("99999")).toBe(300_000);
    expect(parseRetryAfter("0.2")).toBe(1_000);
  });
});

describe("getInfluencerMessages", () => {
  it("429 vira RateLimitError com o Retry-After", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, headers: new Headers({ "Retry-After": "45" }) }) as Response));
    const err = await getInfluencerMessages("c1", "1").catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterMs).toBe(45_000);
  });

  it("não repete a chamada enquanto outra igual está em andamento", async () => {
    let release!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((res) => (release = res)));
    vi.stubGlobal("fetch", fetchMock);
    const a = getInfluencerMessages("c1", "1");
    const b = getInfluencerMessages("c1", "1");
    release(ok());
    await Promise.all([a, b]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Terminada a anterior, uma nova chamada vai à API.
    vi.stubGlobal("fetch", vi.fn(async () => ok()));
    await getInfluencerMessages("c1", "1");
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("conversas diferentes não se misturam", async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([getInfluencerMessages("c1", "1"), getInfluencerMessages("c2", "1")]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

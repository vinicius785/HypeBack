import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCreatorsCatalog } from "./creators-catalog";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("VITE_SERVER_URL", "http://api.test/api/backoffice");
  localStorage.setItem("token", "t");
  localStorage.setItem("workspaceId", "ws-1");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [], meta: { total: 0, page: 1, per_page: 20, last_page: 1 } }) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
});

const requestedUrl = () => new URL(fetchMock.mock.calls[0][0] as string);

describe("getCreatorsCatalog: filtro do elenco (agência)", () => {
  it("com roster, manda roster=true", async () => {
    await getCreatorsCatalog({ roster: true });
    expect(requestedUrl().searchParams.get("roster")).toBe("true");
  });

  it("sem roster (ou falso), o parâmetro nem vai: o catálogo de sempre", async () => {
    await getCreatorsCatalog({});
    expect(requestedUrl().searchParams.has("roster")).toBe(false);
    fetchMock.mockClear();
    await getCreatorsCatalog({ roster: false });
    expect(requestedUrl().searchParams.has("roster")).toBe(false);
  });
});

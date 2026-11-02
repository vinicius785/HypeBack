import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getAuthToken: () => "tok",
  removeAuthToken: vi.fn(),
  removeWorkspaceId: vi.fn(),
}));

import { setAdminUnauthorizedHandler } from "@/lib/admin/admin-client";

import { useAdminCreatorsNicheProfile, useAdminCreatorsSizeProfile } from "./use-admin-creators-profile";

const fetchMock = vi.fn();
const PERIOD = { from: "2026-10-02", to: "2026-10-31" };
const NICHES = [{ niche_id: 1, niche_name: "Moda", count: 10, percentage: 62.5 }];
const SIZES = [{ bucket: "micro", count: 10, percentage: 100 }];

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retryDelay: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, wrapper };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  setAdminUnauthorizedHandler(null);
});

describe("useAdminCreatorsNicheProfile / useAdminCreatorsSizeProfile", () => {
  it("nichos: lê a rota antiga com período e limite pelo cliente do Admin (token e signal)", async () => {
    fetchMock.mockResolvedValue(json(200, { data: NICHES }));
    const { wrapper } = setup();

    const { result } = renderHook(() => useAdminCreatorsNicheProfile(PERIOD, 8), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(NICHES));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/api/backoffice/admin/dashboard/creators/niche-distribution");
    expect(Object.fromEntries(parsed.searchParams)).toEqual({ from: "2026-10-02", to: "2026-10-31", limit: "8" });
    expect((init.headers as Record<string, string>).Authorization ?? new Headers(init.headers).get("authorization")).toContain("tok");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("porte: lê a rota antiga só com o período", async () => {
    fetchMock.mockResolvedValue(json(200, { data: SIZES }));
    const { wrapper } = setup();

    const { result } = renderHook(() => useAdminCreatorsSizeProfile(PERIOD), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(SIZES));

    const parsed = new URL(fetchMock.mock.calls[0][0] as string);
    expect(parsed.pathname).toBe("/api/backoffice/admin/dashboard/creators/size-distribution");
    expect(Object.fromEntries(parsed.searchParams)).toEqual({ from: "2026-10-02", to: "2026-10-31" });
  });

  it("não consulta enquanto `enabled` é falso (o perfil só abre sob demanda)", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdminCreatorsNicheProfile(PERIOD, 8, { enabled: false }), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("401 chega ao aviso de sessão do Admin (antes, o fetch cru nunca avisava)", async () => {
    const onUnauthorized = vi.fn();
    setAdminUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValue(json(401, { statusCode: 401, message: "Unauthorized" }));
    const { wrapper } = setup();

    const { result } = renderHook(() => useAdminCreatorsNicheProfile(PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result.current.error).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rota que o servidor não tem vira ENDPOINT_UNAVAILABLE, sem repetir a consulta", async () => {
    fetchMock.mockResolvedValue(json(404, { statusCode: 404, message: "Cannot GET /api/backoffice/admin/dashboard/creators/size-distribution" }));
    const { wrapper } = setup();

    const { result } = renderHook(() => useAdminCreatorsSizeProfile(PERIOD), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({ code: "ENDPOINT_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("não há atualização por intervalo (o hook antigo repetia a cada 15 minutos)", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "setTimeout"] });
    try {
      fetchMock.mockImplementation(async () => json(200, { data: NICHES }));
      const { wrapper } = setup();
      const { result } = renderHook(() => useAdminCreatorsNicheProfile(PERIOD), { wrapper });
      await vi.waitFor(() => expect(result.current.data).toEqual(NICHES));
      await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

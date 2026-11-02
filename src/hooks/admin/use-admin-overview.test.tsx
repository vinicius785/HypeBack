import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminGetEnvelope: vi.fn(),
  adminFeed: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminGet: client.adminGet, adminGetEnvelope: client.adminGetEnvelope, adminFeed: client.adminFeed };
});

import { AdminApiError, isAdminApiError } from "@/lib/admin/admin-client";
import { ALERTS, EVENTS, OVERVIEW } from "@/components/admin/dashboard/dashboard-fixtures";

import { adminKeys } from "./admin-query-keys";
import {
  DASHBOARD_REFRESH_MS,
  RECENT_ACTIVITY_LIMIT,
  useAdminDashboardAlerts,
  useAdminOverview,
  useAdminRecentActivity,
} from "./use-admin-overview";

function setup() {
  // `retryDelay: 0`: cada hook declara a sua política de retry (a do Admin); aqui só as esperas somem.
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retryDelay: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const RANGE_30 = { from: "2026-10-02", to: "2026-10-31" };
const RANGE_7 = { from: "2026-10-25", to: "2026-10-31" };

beforeEach(() => {
  client.adminGet.mockReset();
  client.adminGetEnvelope.mockReset();
  client.adminFeed.mockReset();
});

describe("useAdminOverview", () => {
  it("consulta /admin/overview com from e to do período e o signal da consulta", async () => {
    const { wrapper } = setup();
    client.adminGet.mockResolvedValue(OVERVIEW);

    const { result } = renderHook(() => useAdminOverview(RANGE_30), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(OVERVIEW);
    const [path, params, options] = client.adminGet.mock.calls[0];
    expect(path).toBe("/admin/overview");
    expect(params).toEqual({ from: "2026-10-02", to: "2026-10-31" });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("a chave fica sob ['admin','platform','overview']: invalidar o recurso refaz a consulta", async () => {
    const { wrapper, queryClient } = setup();
    client.adminGet.mockResolvedValue(OVERVIEW);
    const { result } = renderHook(() => useAdminOverview(RANGE_30), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(["admin", "platform", "overview", "item", RANGE_30])).toBe(OVERVIEW);

    await queryClient.invalidateQueries({ queryKey: adminKeys.resource("overview") });
    await waitFor(() => expect(client.adminGet).toHaveBeenCalledTimes(2));
  });

  it("trocar o período mantém os números anteriores na tela (placeholder) até o novo chegar", async () => {
    const { wrapper } = setup();
    const next = deferred<typeof OVERVIEW>();
    const sevenDays = { ...OVERVIEW, period: RANGE_7 };
    client.adminGet.mockResolvedValueOnce(OVERVIEW).mockReturnValueOnce(next.promise);

    const { result, rerender } = renderHook(({ range }: { range: typeof RANGE_30 }) => useAdminOverview(range), {
      wrapper,
      initialProps: { range: RANGE_30 },
    });
    await waitFor(() => expect(result.current.data).toBe(OVERVIEW));
    expect(result.current.isPlaceholderData).toBe(false);

    rerender({ range: RANGE_7 });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toBe(OVERVIEW);
    expect(client.adminGet.mock.calls[1][1]).toEqual({ from: "2026-10-25", to: "2026-10-31" });

    next.resolve(sevenDays);
    await waitFor(() => expect(result.current.data).toBe(sevenDays));
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it("voltar a um período já consultado usa o cache (sem nova chamada enquanto está fresco)", async () => {
    const { wrapper } = setup();
    client.adminGet.mockImplementation(async (_path: string, params: { from: string }) => ({
      ...OVERVIEW,
      period: { from: params.from, to: "2026-10-31" },
    }));
    const { result, rerender } = renderHook(({ range }: { range: typeof RANGE_30 }) => useAdminOverview(range), {
      wrapper,
      initialProps: { range: RANGE_30 },
    });
    await waitFor(() => expect(result.current.data?.period.from).toBe("2026-10-02"));
    rerender({ range: RANGE_7 });
    await waitFor(() => expect(result.current.data?.period.from).toBe("2026-10-25"));
    rerender({ range: RANGE_30 });
    await waitFor(() => expect(result.current.data?.period.from).toBe("2026-10-02"));
    expect(client.adminGet).toHaveBeenCalledTimes(2);
  });

  it("não repete a consulta em 4xx (o resultado não muda), mas repete em 5xx", async () => {
    const { wrapper } = setup();
    client.adminGet.mockRejectedValue(new AdminApiError({ status: 404, code: "ENDPOINT_UNAVAILABLE", message: "x" }));
    const first = renderHook(() => useAdminOverview(RANGE_30), { wrapper });
    await waitFor(() => expect(first.result.current.isError).toBe(true));
    expect(client.adminGet).toHaveBeenCalledTimes(1);

    client.adminGet.mockReset();
    client.adminGet.mockRejectedValue(new AdminApiError({ status: 500, code: "SERVER_ERROR", message: "x" }));
    const second = renderHook(() => useAdminOverview(RANGE_7), { wrapper: setup().wrapper });
    await waitFor(() => expect(second.result.current.isError).toBe(true));
    expect(client.adminGet).toHaveBeenCalledTimes(3); // a primeira + 2 novas tentativas
  });

  it("se a consulta do período novo falha, não mostra números do período anterior como se fossem dele", async () => {
    const { wrapper } = setup();
    client.adminGet
      .mockResolvedValueOnce(OVERVIEW)
      .mockRejectedValueOnce(new AdminApiError({ status: 429, code: "RATE_LIMITED", message: "x" }));
    const { result, rerender } = renderHook(({ range }: { range: typeof RANGE_30 }) => useAdminOverview(range), {
      wrapper,
      initialProps: { range: RANGE_30 },
    });
    await waitFor(() => expect(result.current.data).toBe(OVERVIEW));
    rerender({ range: RANGE_7 });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe("useAdminDashboardAlerts", () => {
  it("devolve os alertas e quando o servidor calculou", async () => {
    const { wrapper } = setup();
    client.adminGetEnvelope.mockResolvedValue({ data: ALERTS, meta: { computed_at: "2026-10-31T15:00:00.000Z" } });

    const { result } = renderHook(() => useAdminDashboardAlerts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ alerts: ALERTS, computedAt: "2026-10-31T15:00:00.000Z" });
    const [path, params, options] = client.adminGetEnvelope.mock.calls[0];
    expect(path).toBe("/admin/health/alerts");
    expect(params).toBeUndefined();
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("sem meta, o horário do cálculo é nulo (e a lista vale mesmo assim)", async () => {
    const { wrapper } = setup();
    client.adminGetEnvelope.mockResolvedValue({ data: [], meta: undefined });
    const { result } = renderHook(() => useAdminDashboardAlerts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ alerts: [], computedAt: null });
  });

  it("resposta que não é uma lista é ERRO, nunca 'tudo em ordem' (falso alívio é pior que falha)", async () => {
    const { wrapper } = setup();
    client.adminGetEnvelope.mockResolvedValue({ data: { alerts: [] }, meta: undefined });
    const { result } = renderHook(() => useAdminDashboardAlerts(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isAdminApiError(result.current.error, "INVALID_RESPONSE")).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(client.adminGetEnvelope).toHaveBeenCalledTimes(1); // resposta fora do contrato não é repetida
  });

  it("atualiza sozinho a cada minuto e a chave fica sob ['admin','platform','health']", async () => {
    const { wrapper, queryClient } = setup();
    client.adminGetEnvelope.mockResolvedValue({ data: [], meta: { computed_at: "2026-10-31T15:00:00.000Z" } });
    const { result } = renderHook(() => useAdminDashboardAlerts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(DASHBOARD_REFRESH_MS).toBe(60_000);
    const [query] = queryClient.getQueryCache().findAll({ queryKey: adminKeys.resource("health") });
    expect(query).toBeDefined();
    expect(query?.observers[0].options.refetchInterval).toBe(DASHBOARD_REFRESH_MS);
    expect(query?.observers[0].options.refetchOnWindowFocus).toBe(false);
  });
});

describe("useAdminRecentActivity", () => {
  it("pede os 8 mais recentes e devolve a primeira página do feed", async () => {
    const { wrapper } = setup();
    const page = { data: EVENTS.slice(0, 8), meta: { next_cursor: "abc", has_more: true } };
    client.adminFeed.mockResolvedValue(page);

    const { result } = renderHook(() => useAdminRecentActivity(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(page);
    const [path, params, options] = client.adminFeed.mock.calls[0];
    expect(RECENT_ACTIVITY_LIMIT).toBe(8);
    expect(path).toBe("/admin/activity");
    expect(params).toEqual({ limit: 8 });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("aceita outro limite e não divide o cache com o feed da tela de atividade", async () => {
    const { wrapper, queryClient } = setup();
    client.adminFeed.mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });
    const { result } = renderHook(() => useAdminRecentActivity(3), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.adminFeed.mock.calls[0][1]).toEqual({ limit: 3 });
    // escopo próprio: o feed infinito da tela de atividade (mesma família) usa outra chave
    expect(queryClient.getQueryData(["admin", "platform", "activity", "feed", "dashboard", { limit: 3 }])).toBeDefined();
    expect(queryClient.getQueryData(["admin", "platform", "activity", "feed", { limit: 3 }])).toBeUndefined();
  });

  it("atualiza sozinho a cada minuto e não consulta ao voltar o foco da janela", async () => {
    const { wrapper, queryClient } = setup();
    client.adminFeed.mockResolvedValue({ data: [], meta: { next_cursor: null, has_more: false } });
    const { result } = renderHook(() => useAdminRecentActivity(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [query] = queryClient.getQueryCache().findAll({ queryKey: adminKeys.resource("activity") });
    expect(query?.observers[0].options.refetchInterval).toBe(DASHBOARD_REFRESH_MS);
    expect(query?.observers[0].options.refetchOnWindowFocus).toBe(false);
  });
});

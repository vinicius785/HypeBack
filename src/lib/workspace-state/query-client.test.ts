import { QueryObserver, type QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ stored: null as string | null }));
vi.mock("@/lib/utils/api", () => ({ getWorkspaceId: () => env.stored }));

import type { Workspace, WorkspaceStatus } from "@/shared/types";

import { buildApiError } from "./api-error";
import { WORKSPACE_STATE_ERROR_CODES } from "./lifecycle-errors";
import { createAppQueryClient, shouldRetryQuery } from "./query-client";
import { ME_WORKSPACES_KEY } from "./workspace-list-cache";

const ws = (id: string, status: WorkspaceStatus): Workspace => ({ id, name: id, status });

beforeEach(() => {
  env.stored = null;
});

describe("shouldRetryQuery", () => {
  it.each(WORKSPACE_STATE_ERROR_CODES)("não repete a recusa %s (corpo cru do servidor)", (code) => {
    const thrown = { statusCode: 403, message: "recusado", error: code };
    expect(shouldRetryQuery(0, thrown)).toBe(false);
    expect(shouldRetryQuery(2, thrown)).toBe(false);
  });

  it("nem quando o serviço lançou um Error com o código (http-client)", () => {
    const error = buildApiError(403, { message: "suspenso", error: "WORKSPACE_SUSPENDED" }, "falhou");
    expect(shouldRetryQuery(0, error)).toBe(false);
  });

  it("falha comum segue o padrão do React Query: até 3 repetições", () => {
    const error = new Error("rede");
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(true);
    expect(shouldRetryQuery(3, error)).toBe(false);
    expect(shouldRetryQuery(0, buildApiError(500, { message: "x" }, "falhou"))).toBe(true);
  });

  it("com o workspace aberto suspenso nada é repetido, mesmo que o serviço tenha jogado o código fora", () => {
    expect(shouldRetryQuery(0, new Error("Este workspace está suspenso"), () => true)).toBe(false);
    expect(shouldRetryQuery(0, new Error("Este workspace está suspenso"), () => false)).toBe(true);
  });
});

describe("createAppQueryClient", () => {
  const retryOf = (client: QueryClient) => client.getDefaultOptions().queries?.retry as (count: number, error: unknown) => boolean;

  it("liga a política de repetição nas consultas", () => {
    const client = createAppQueryClient();
    expect(typeof retryOf(client)).toBe("function");
    expect(retryOf(client)(0, { statusCode: 403, error: "WORKSPACE_ARCHIVED" })).toBe(false);
    expect(retryOf(client)(0, new Error("rede"))).toBe(true);
  });

  it("consulta que recebe a recusa falha de primeira, sem repetir", async () => {
    const client = createAppQueryClient();
    const queryFn = vi.fn().mockRejectedValue({ statusCode: 403, message: "suspenso", error: "WORKSPACE_SUSPENDED" });
    const observer = new QueryObserver(client, { queryKey: ["campaigns", "w1"], queryFn });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().failureCount).toBe(1);
    unsubscribe();
    client.clear();
  });

  it("consulta de um workspace suspenso (segundo a lista em cache) não repete nem quando o erro é genérico", async () => {
    const client = createAppQueryClient();
    client.setQueryData(ME_WORKSPACES_KEY, [ws("w1", "suspended")]);
    env.stored = "w1";
    const queryFn = vi.fn().mockRejectedValue(new Error("Request failed: /campaigns (403)"));
    const observer = new QueryObserver(client, { queryKey: ["campaigns", "w1"], queryFn });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));
    expect(queryFn).toHaveBeenCalledTimes(1);
    unsubscribe();
    client.clear();
  });

  it("o resto das opções fica nos padrões do React Query", () => {
    const options = createAppQueryClient().getDefaultOptions();
    expect(options.queries?.staleTime).toBeUndefined();
    expect(options.queries?.refetchOnWindowFocus).toBeUndefined();
    expect(options.mutations).toBeUndefined();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { adminKeys } from "./admin-query-keys";
import { useAdminMutation } from "./use-admin-mutation";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe("useAdminMutation", () => {
  it("mesmo corpo depois de uma falha reenvia a MESMA chave (a primeira tentativa pode ter gravado)", async () => {
    const { wrapper } = setup();
    const keys: string[] = [];
    const fn = vi
      .fn<(vars: { reason: string }, key: string) => Promise<string>>()
      .mockImplementationOnce(async (_v, key) => {
        keys.push(key);
        throw new Error("rede");
      })
      .mockImplementationOnce(async (_v, key) => {
        keys.push(key);
        return "ok";
      });
    const { result } = renderHook(() => useAdminMutation({ mutationFn: fn }), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ reason: "inadimplência" }).catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync({ reason: "inadimplência" });
    });

    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(UUID_V4);
    expect(keys[1]).toBe(keys[0]);
  });

  it("corpo diferente usa chave nova (a mesma chave com outro corpo daria IDEMPOTENCY_CONFLICT)", async () => {
    const { wrapper } = setup();
    const keys: string[] = [];
    const fn = vi.fn(async (_v: { reason: string }, key: string) => {
      keys.push(key);
      throw new Error("falhou");
    });
    const { result } = renderHook(() => useAdminMutation({ mutationFn: fn }), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ reason: "motivo um" }).catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync({ reason: "motivo dois" }).catch(() => undefined);
    });

    expect(keys[1]).not.toBe(keys[0]);
  });

  it("depois de um sucesso a próxima ação (mesmo texto) é outra intenção: chave nova", async () => {
    const { wrapper } = setup();
    const keys: string[] = [];
    const fn = vi.fn(async (_v: { reason: string }, key: string) => {
      keys.push(key);
      return "ok";
    });
    const { result } = renderHook(() => useAdminMutation({ mutationFn: fn }), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ reason: "mesmo texto" });
    });
    await act(async () => {
      await result.current.mutateAsync({ reason: "mesmo texto" });
    });

    expect(keys[1]).not.toBe(keys[0]);
  });

  it("no sucesso invalida as chaves informadas e chama onSuccess", async () => {
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useAdminMutation<string, void>({
          mutationFn: async () => "feito",
          invalidate: [adminKeys.resource("workspaces"), adminKeys.of("overview")],
          onSuccess,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("feito", undefined));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "platform", "workspaces"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "platform", "overview"] });
  });

  it("na falha não invalida nada e chama onError", async () => {
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const onError = vi.fn();
    const { result } = renderHook(
      () =>
        useAdminMutation<string, void>({
          mutationFn: async () => {
            throw new Error("nao foi");
          },
          invalidate: [adminKeys.resource("workspaces")],
          onError,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
  });
});

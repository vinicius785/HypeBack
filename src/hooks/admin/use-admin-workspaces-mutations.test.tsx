import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  adminPost: vi.fn(),
  adminPatch: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminPost: client.adminPost, adminPatch: client.adminPatch };
});

import { AdminApiError } from "@/lib/admin/admin-client";

import { workspaceDetailKey } from "./use-admin-workspaces";
import {
  useRefreshOnStaleWorkspace,
  useWorkspaceDangerMutation,
  useWorkspaceMemberAddMutation,
  useWorkspaceMemberRemoveMutation,
  useWorkspaceMemberRoleMutation,
  useWorkspaceTransitionMutation,
  useWorkspaceUpdateMutation,
} from "./use-admin-workspaces-mutations";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = "7a1e0000-0000-4000-8000-000000000002";
const DETAIL = { id: ID, name: "Café Serra Verde" };

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, invalidate, wrapper };
}

const postCall = (index = 0) => {
  const [path, body, options] = client.adminPost.mock.calls[index] as [string, unknown, { idempotencyKey: string }];
  return { path, body, key: options.idempotencyKey };
};

beforeEach(() => {
  client.adminPost.mockReset().mockResolvedValue(DETAIL);
  client.adminPatch.mockReset().mockResolvedValue(DETAIL);
});

describe("transições (suspender, reativar, desarquivar, restaurar)", () => {
  it.each(["suspend", "reactivate", "unarchive", "restore"] as const)("%s: POST no caminho do contrato com o motivo e uma Idempotency-Key v4", async (action) => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useWorkspaceTransitionMutation(ID, action), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ reason: "Motivo de teste" });
    });

    expect(postCall().path).toBe(`/admin/workspaces/${ID}/${action}`);
    expect(postCall().body).toEqual({ reason: "Motivo de teste" });
    expect(postCall().key).toMatch(UUID_V4);
  });

  it("grava o workspace devolvido no detalhe e invalida tudo do Admin", async () => {
    const { queryClient, invalidate, wrapper } = setup();
    const { result } = renderHook(() => useWorkspaceTransitionMutation(ID, "suspend"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ reason: "Motivo de teste" });
    });

    expect(queryClient.getQueryData(workspaceDetailKey(ID))).toEqual(DETAIL);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "platform"] });
  });

  it("mesmo corpo depois de uma falha: mesma chave; corpo novo: chave nova; depois do sucesso: chave nova", async () => {
    client.adminPost.mockRejectedValueOnce(new Error("rede")).mockResolvedValue(DETAIL);
    const { wrapper } = setup();
    const { result } = renderHook(() => useWorkspaceTransitionMutation(ID, "suspend"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ reason: "Motivo de teste" }).catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync({ reason: "Motivo de teste" });
    });
    await act(async () => {
      await result.current.mutateAsync({ reason: "Motivo de teste" });
    });
    await act(async () => {
      await result.current.mutateAsync({ reason: "Outro motivo" });
    });

    expect(postCall(1).key).toBe(postCall(0).key);
    expect(postCall(2).key).not.toBe(postCall(1).key);
    expect(postCall(3).key).not.toBe(postCall(2).key);
  });
});

describe("arquivar e excluir", () => {
  it.each(["archive", "delete"] as const)("%s: manda motivo, confirm_name e impact_token", async (action) => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useWorkspaceDangerMutation(ID, action), { wrapper });
    const body = { reason: "Motivo de teste", confirm_name: "Café Serra Verde", impact_token: "tok" };
    await act(async () => {
      await result.current.mutateAsync(body);
    });

    expect(postCall().path).toBe(`/admin/workspaces/${ID}/${action}`);
    expect(postCall().body).toEqual(body);
    expect(postCall().key).toMatch(UUID_V4);
    expect(queryClient.getQueryData(workspaceDetailKey(ID))).toEqual(DETAIL);
  });

  it("token de impacto novo é outra intenção: chave nova (a mesma chave com outro corpo daria IDEMPOTENCY_CONFLICT)", async () => {
    client.adminPost.mockRejectedValue(new Error("falhou"));
    const { wrapper } = setup();
    const { result } = renderHook(() => useWorkspaceDangerMutation(ID, "delete"), { wrapper });
    const body = { reason: "Motivo de teste", confirm_name: "Café", impact_token: "tok-1" };

    await act(async () => {
      await result.current.mutateAsync(body).catch(() => undefined);
    });
    await act(async () => {
      await result.current.mutateAsync({ ...body, impact_token: "tok-2" }).catch(() => undefined);
    });

    expect(postCall(1).key).not.toBe(postCall(0).key);
  });
});

describe("edição", () => {
  it("PATCH no workspace com o motivo e só os campos alterados", async () => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useWorkspaceUpdateMutation(ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ reason: "Motivo de teste", name: "Café Novo" });
    });

    const [path, body, options] = client.adminPatch.mock.calls[0] as [string, unknown, { idempotencyKey: string }];
    expect(path).toBe(`/admin/workspaces/${ID}`);
    expect(body).toEqual({ reason: "Motivo de teste", name: "Café Novo" });
    expect(options.idempotencyKey).toMatch(UUID_V4);
    expect(queryClient.getQueryData(workspaceDetailKey(ID))).toEqual(DETAIL);
  });
});

describe("membros", () => {
  it("adicionar: POST em .../members; não mexe no detalhe (a resposta é o membro), mas invalida tudo", async () => {
    client.adminPost.mockResolvedValue({ user_id: 99 });
    const { queryClient, invalidate, wrapper } = setup();
    const { result } = renderHook(() => useWorkspaceMemberAddMutation(ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ reason: "Motivo de teste", email: "a@b.com", role: "member" });
    });

    expect(postCall().path).toBe(`/admin/workspaces/${ID}/members`);
    expect(postCall().body).toEqual({ reason: "Motivo de teste", email: "a@b.com", role: "member" });
    expect(queryClient.getQueryData(workspaceDetailKey(ID))).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "platform"] });
  });

  it("alterar papel: PATCH em .../members/:userId", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useWorkspaceMemberRoleMutation(ID, 12), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ reason: "Motivo de teste", role: "aprovador" });
    });

    const [path, body, options] = client.adminPatch.mock.calls[0] as [string, unknown, { idempotencyKey: string }];
    expect(path).toBe(`/admin/workspaces/${ID}/members/12`);
    expect(body).toEqual({ reason: "Motivo de teste", role: "aprovador" });
    expect(options.idempotencyKey).toMatch(UUID_V4);
  });

  it("remover: POST em .../members/:userId/remove (DELETE com corpo seria descartado por proxies)", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useWorkspaceMemberRemoveMutation(ID, 12), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ reason: "Motivo de teste" });
    });

    expect(postCall().path).toBe(`/admin/workspaces/${ID}/members/12/remove`);
    expect(postCall().body).toEqual({ reason: "Motivo de teste" });
    expect(client.adminPatch).not.toHaveBeenCalled();
  });

  it("falha não invalida nada nem grava no detalhe", async () => {
    client.adminPost.mockRejectedValue(new AdminApiError({ status: 409, code: "LAST_OWNER", message: "x" }));
    const { queryClient, invalidate, wrapper } = setup();
    const { result } = renderHook(() => useWorkspaceMemberRemoveMutation(ID, 12), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ reason: "Motivo de teste" }).catch(() => undefined);
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(workspaceDetailKey(ID))).toBeUndefined();
  });
});

describe("useRefreshOnStaleWorkspace", () => {
  const stale = (code: string) => new AdminApiError({ status: 409, code, message: "x" });

  it.each(["INVALID_STATE_TRANSITION", "WORKSPACE_DELETED"])("%s: a tela está velha, então consulta tudo de novo e avisa quem chamou", (code) => {
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useRefreshOnStaleWorkspace(), { wrapper });

    expect(result.current(stale(code))).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "platform"] });
  });

  it.each(["LAST_OWNER", "CONFIRMATION_MISMATCH", "IMPACT_TOKEN_MISMATCH", "UNKNOWN"])("%s: não é estado velho (nada é consultado de novo)", (code) => {
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useRefreshOnStaleWorkspace(), { wrapper });

    expect(result.current(stale(code))).toBe(false);
    expect(result.current(new Error("x"))).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
  });
});

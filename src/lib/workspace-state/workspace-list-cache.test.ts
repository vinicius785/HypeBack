import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ stored: null as string | null }));
vi.mock("@/lib/utils/api", () => ({ getWorkspaceId: () => env.stored }));

import type { Workspace, WorkspaceStatus } from "@/shared/types";

import {
  ME_WORKSPACES_KEY,
  getCachedWorkspaces,
  isStoredWorkspaceSuspended,
  pickDefaultWorkspace,
  removeCachedWorkspace,
  setCachedWorkspaceStatus,
} from "./workspace-list-cache";

const ws = (id: string, status: WorkspaceStatus = "active"): Workspace => ({ id, name: `Marca ${id}`, status });

let client: QueryClient;

beforeEach(() => {
  env.stored = null;
  client = new QueryClient();
});

describe("setCachedWorkspaceStatus", () => {
  it("troca só o estado do workspace pedido, sem mexer nos outros nem no resto dos dados", () => {
    const a = { ...ws("a"), role: "owner" as const };
    const b = ws("b");
    client.setQueryData(ME_WORKSPACES_KEY, [a, b]);
    expect(setCachedWorkspaceStatus(client, "a", "suspended")).toBe(true);
    const [first, second] = getCachedWorkspaces(client) ?? [];
    expect(first).toEqual({ ...a, status: "suspended" });
    expect(second).toBe(b);
  });

  it("false (e a lista intacta) quando já tem esse estado, quando o workspace não está na lista e quando não há lista", () => {
    const list = [ws("a", "archived")];
    client.setQueryData(ME_WORKSPACES_KEY, list);
    expect(setCachedWorkspaceStatus(client, "a", "archived")).toBe(false);
    expect(setCachedWorkspaceStatus(client, "zzz", "suspended")).toBe(false);
    expect(getCachedWorkspaces(client)).toBe(list);

    expect(setCachedWorkspaceStatus(new QueryClient(), "a", "suspended")).toBe(false);
  });
});

describe("removeCachedWorkspace", () => {
  it("tira o workspace da lista; false quando ele não estava", () => {
    client.setQueryData(ME_WORKSPACES_KEY, [ws("a"), ws("b")]);
    expect(removeCachedWorkspace(client, "a")).toBe(true);
    expect(getCachedWorkspaces(client)?.map((w) => w.id)).toEqual(["b"]);
    expect(removeCachedWorkspace(client, "a")).toBe(false);
    expect(removeCachedWorkspace(new QueryClient(), "a")).toBe(false);
  });
});

describe("pickDefaultWorkspace", () => {
  it("o primeiro que está funcionando; se nenhum está, o primeiro da lista; lista vazia não tem escolha", () => {
    expect(pickDefaultWorkspace([ws("a", "suspended"), ws("b", "archived"), ws("c"), ws("d")])?.id).toBe("c");
    expect(pickDefaultWorkspace([ws("a", "suspended"), ws("b", "archived")])?.id).toBe("a");
    expect(pickDefaultWorkspace([])).toBeUndefined();
  });
});

describe("isStoredWorkspaceSuspended", () => {
  it("só é verdade para o workspace guardado e suspenso na lista", () => {
    client.setQueryData(ME_WORKSPACES_KEY, [ws("a", "suspended"), ws("b"), ws("c", "archived")]);
    expect(isStoredWorkspaceSuspended(client)).toBe(false); // nada guardado
    env.stored = "a";
    expect(isStoredWorkspaceSuspended(client)).toBe(true);
    env.stored = "b";
    expect(isStoredWorkspaceSuspended(client)).toBe(false);
    env.stored = "c"; // arquivado ainda lê: as consultas seguem
    expect(isStoredWorkspaceSuspended(client)).toBe(false);
    env.stored = "fora-da-lista";
    expect(isStoredWorkspaceSuspended(client)).toBe(false);
    expect(isStoredWorkspaceSuspended(new QueryClient())).toBe(false);
  });
});

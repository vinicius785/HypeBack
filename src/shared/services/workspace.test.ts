import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getAuthToken: () => "tok-1",
}));

import { getDeleteBlockers } from "@/lib/workspace-state/delete-blockers";
import { readWorkspaceStateError } from "@/lib/workspace-state/lifecycle-errors";

import { deleteWorkspace, getMyWorkspaces } from "./workspace";

const fetchMock = vi.fn();

function json(status: number, payload?: unknown): Response {
  return new Response(payload === undefined ? null : JSON.stringify(payload), {
    status,
    headers: payload === undefined ? {} : { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getMyWorkspaces: estado (status) de cada workspace", () => {
  const row = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: `Marca ${id}`, role: "owner", ...extra });

  it("servidor antigo, sem o campo: o workspace é ativo", async () => {
    fetchMock.mockResolvedValue(json(200, { data: [row("a")] }));
    const [workspace] = await getMyWorkspaces();
    expect(workspace.status).toBe("active");
  });

  it("active, suspended e archived chegam como vieram (sem diferenciar maiúsculas)", async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        data: [row("a", { status: "active" }), row("b", { status: "suspended" }), row("c", { status: "ARCHIVED" })],
      }),
    );
    const list = await getMyWorkspaces();
    expect(list.map((w) => [w.id, w.status])).toEqual([
      ["a", "active"],
      ["b", "suspended"],
      ["c", "archived"],
    ]);
  });

  it("valor que o app não conhece (ou vazio, ou não texto) segue como ativo", async () => {
    fetchMock.mockResolvedValue(
      json(200, { data: [row("a", { status: "pending" }), row("b", { status: "" }), row("c", { status: null }), row("d", { status: 3 })] }),
    );
    const list = await getMyWorkspaces();
    expect(list.map((w) => w.status)).toEqual(["active", "active", "active", "active"]);
  });

  it("excluído não deveria vir; se vier, o workspace não existe para o app", async () => {
    fetchMock.mockResolvedValue(json(200, { data: [row("a", { status: "deleted" }), row("b", { status: "active" })] }));
    const list = await getMyWorkspaces();
    expect(list.map((w) => w.id)).toEqual(["b"]);
  });

  it("o resto da normalização continua igual", async () => {
    fetchMock.mockResolvedValue(
      json(200, { data: [row("a", { status: "suspended", permissions: ["workspace_read", "campaigns_read"], photo: "/p.png", niche_id: "7" })] }),
    );
    const [workspace] = await getMyWorkspaces();
    expect(workspace).toMatchObject({ id: "a", name: "Marca a", role: "owner", photo: "/p.png", niche_id: 7, status: "suspended" });
    expect(workspace.permissions?.workspace_read).toBe(true);
    expect(workspace.permissions?.campaigns_read).toBe(true);
  });
});

describe("deleteWorkspace", () => {
  const blockers = [
    { code: "HAS_CUSTODY_BALANCE", message: "Saldo em custódia", amount_cents: 125000 },
    { code: "HAS_PUBLISHED_CAMPAIGNS", message: "Campanhas publicadas", count: 2 },
  ];

  it("DELETE /workspaces/:id e resolve quando o servidor aceita (a resposta não mudou)", async () => {
    fetchMock.mockResolvedValue(json(200, { data: { id: "a" } }));
    await expect(deleteWorkspace("w-1")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("https://api.test/api/backoffice/workspaces/w-1");
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe("Bearer tok-1");
  });

  it("409 WORKSPACE_DELETE_BLOCKED: o erro leva status, código e a lista de impedimentos", async () => {
    fetchMock.mockResolvedValue(
      json(409, {
        statusCode: 409,
        message: "A exclusão está bloqueada.",
        error: "WORKSPACE_DELETE_BLOCKED",
        details: { blockers },
      }),
    );
    const error = (await deleteWorkspace("w-1").catch((e: unknown) => e)) as Error & { status: number; code: string };
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("A exclusão está bloqueada.");
    expect(error.status).toBe(409);
    expect(error.code).toBe("WORKSPACE_DELETE_BLOCKED");
    expect(readWorkspaceStateError(error)?.code).toBe("WORKSPACE_DELETE_BLOCKED");
    expect(getDeleteBlockers(error)).toEqual(blockers);
  });

  it("outra recusa (workspace suspenso) é um erro comum, não um impedimento de exclusão", async () => {
    fetchMock.mockResolvedValue(
      json(403, { statusCode: 403, message: "Este workspace está suspenso.", error: "WORKSPACE_SUSPENDED" }),
    );
    const error = (await deleteWorkspace("w-1").catch((e: unknown) => e)) as Error & { status: number };
    expect(error.message).toBe("Este workspace está suspenso.");
    expect(error.status).toBe(403);
    expect(getDeleteBlockers(error)).toBeNull();
  });

  it("sem corpo JSON, a mensagem padrão é em pt-BR", async () => {
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }));
    const error = (await deleteWorkspace("w-1").catch((e: unknown) => e)) as Error & { status: number };
    expect(error.message).toBe("Não foi possível excluir o workspace.");
    expect(error.status).toBe(502);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acceptWorkspaceInvite,
  cancelWorkspaceInvite,
  listMyWorkspaceInvites,
  listWorkspaceInvites,
} from "./workspace-invites";

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  vi.stubEnv("VITE_SERVER_URL", "http://api.test/backoffice");
  localStorage.setItem("token", "t");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("workspace-invites service", () => {
  it("traduz a lista de convites recebidos", async () => {
    vi.stubGlobal(
      "fetch",
      respond(200, {
        data: [
          {
            id: 5,
            workspace_id: 7,
            workspace_name: "Casa Aurora",
            role: "admin",
            role_label: "Administrador",
            invited_by_name: "Lúcia",
            created_at: "2026-11-01T10:00:00Z",
            expires_at: "2026-11-08T10:00:00Z",
          },
        ],
      }),
    );
    await expect(listMyWorkspaceInvites()).resolves.toEqual([
      {
        id: 5,
        workspaceId: "7",
        workspaceName: "Casa Aurora",
        role: "admin",
        roleLabel: "Administrador",
        invitedByName: "Lúcia",
        createdAt: "2026-11-01T10:00:00Z",
        expiresAt: "2026-11-08T10:00:00Z",
      },
    ]);
  });

  it("API sem a rota (404) vira lista vazia, para o app não quebrar antes do deploy", async () => {
    vi.stubGlobal("fetch", respond(404, { message: "Cannot GET" }));
    await expect(listMyWorkspaceInvites()).resolves.toEqual([]);
    await expect(listWorkspaceInvites("7")).resolves.toEqual([]);
  });

  it("aceitar devolve a marca em que a pessoa entrou", async () => {
    const fetchMock = respond(200, { data: { workspace_id: 7, role: "admin" } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(acceptWorkspaceInvite(5)).resolves.toEqual({ workspaceId: "7" });
    expect(fetchMock.mock.calls[0][0]).toContain("/me/invites/5/accept");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("erro do servidor vira Error com o texto e o status", async () => {
    vi.stubGlobal("fetch", respond(400, { message: "Este convite venceu." }));
    await expect(acceptWorkspaceInvite(5)).rejects.toMatchObject({ message: "Este convite venceu.", status: 400 });
  });

  it("cancelar usa DELETE na rota da marca", async () => {
    const fetchMock = respond(200, { data: { cancelled: true } });
    vi.stubGlobal("fetch", fetchMock);
    await cancelWorkspaceInvite("7", 5);
    expect(fetchMock.mock.calls[0][0]).toContain("/workspaces/7/invites/5");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });
});

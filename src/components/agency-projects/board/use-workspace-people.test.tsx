import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  query: { data: undefined as unknown, isLoading: false, isError: false },
  user: { id: 7, name: "Eu Mesma", email: "eu@x.com", avatar: "/u/eu.jpg" } as { id: number; name: string; email: string; avatar?: string | null } | null,
  workspaceId: "ws-1" as string | undefined,
  membersArg: vi.fn(),
}));

vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspaceIdForQueries: () => h.workspaceId }));
vi.mock("@/hooks/use-workspace-members", () => ({
  useWorkspaceMembersQuery: (id: string | undefined) => {
    h.membersArg(id);
    return h.query;
  },
}));

import { useWorkspacePeople } from "./use-workspace-people";

beforeEach(() => {
  vi.clearAllMocks();
  h.query = { data: undefined, isLoading: false, isError: false };
  h.user = { id: 7, name: "Eu Mesma", email: "eu@x.com", avatar: "/u/eu.jpg" };
});

describe("useWorkspacePeople", () => {
  it("membros do workspace por nome, usando o e-mail quando não há nome", () => {
    h.query.data = [
      { user_id: 2, name: "Bruno", email: "b@x.com" },
      { user_id: 1, name: "ana", email: "a@x.com" },
      { user_id: 3, name: "", email: "sem-nome@x.com" },
    ];
    const { result } = renderHook(() => useWorkspacePeople());
    expect(result.current.people.map((p) => [p.id, p.name])).toEqual([
      [1, "ana"],
      [2, "Bruno"],
      [3, "sem-nome@x.com"],
    ]);
    expect(result.current.failed).toBe(false);
  });

  it("sem acesso à lista (erro): fica a própria pessoa como opção e o aviso de falha", () => {
    h.query.isError = true;
    const { result } = renderHook(() => useWorkspacePeople());
    expect(result.current.failed).toBe(true);
    expect(result.current.people).toEqual([{ id: 7, name: "Eu Mesma", avatar: "/u/eu.jpg" }]);
  });

  it("desligado (somente leitura) não consulta a equipe", () => {
    renderHook(() => useWorkspacePeople({ enabled: false }));
    expect(h.membersArg).toHaveBeenCalledWith(undefined);
  });
});

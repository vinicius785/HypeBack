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

import { knownProjectPeople, useWorkspacePeople } from "./use-workspace-people";

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

  it("a foto vem do membro, do que o projeto já conhece ou da própria pessoa logada", () => {
    h.query.data = [
      { user_id: 1, name: "Ana", email: "a@x.com", avatar: "/m/ana.jpg" },
      { user_id: 2, name: "Bruno", email: "b@x.com" },
      { user_id: 7, name: "Eu Mesma", email: "eu@x.com" },
      { user_id: 9, name: "Sem Foto", email: "s@x.com" },
    ];
    const known = [{ id: 2, name: "Bruno", avatar: "/p/bruno.jpg" }];
    const { result } = renderHook(() => useWorkspacePeople({ known }));
    const photo = (id: number) => result.current.people.find((p) => p.id === id)?.avatar;
    expect(photo(1)).toBe("/m/ana.jpg");
    expect(photo(2)).toBe("/p/bruno.jpg");
    expect(photo(7)).toBe("/u/eu.jpg");
    expect(photo(9)).toBeNull();
  });
});

describe("knownProjectPeople", () => {
  it("junta responsável, participantes e responsáveis das tarefas, sem repetir e sem perder a foto", () => {
    const project = {
      responsible: { user_id: 1, name: "Ana", avatar: "/a.jpg" },
      participants: [{ user_id: 2, name: "Bruno", avatar: null }],
    };
    const tasks = [{ assignees: [{ user_id: 2, name: "Bruno", avatar: "/b.jpg", is_primary: true }, { user_id: 3, name: "Cris", avatar: null, is_primary: false }] }];
    const people = knownProjectPeople(project, tasks);
    expect(people.map((p) => [p.id, p.avatar])).toEqual([
      [1, "/a.jpg"],
      [2, "/b.jpg"],
      [3, null],
    ]);
  });
});

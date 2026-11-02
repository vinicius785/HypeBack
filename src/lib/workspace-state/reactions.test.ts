import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ stored: null as string | null, toast: { info: vi.fn() } }));

vi.mock("sonner", () => ({ toast: env.toast }));
vi.mock("@/lib/utils/api", () => ({
  getWorkspaceId: () => env.stored,
  removeWorkspaceId: () => {
    env.stored = null;
  },
}));

import type { Workspace, WorkspaceStatus } from "@/shared/types";

import {
  ARCHIVED_NOTICE,
  ARCHIVED_TOAST_ID,
  DELETED_NOTICE,
  DELETED_TOAST_ID,
  NO_WORKSPACES_NOTICE,
  applyWorkspaceStateEvent,
} from "./reactions";
import type { WorkspaceStateEvent } from "./response-observer";
import { ME_WORKSPACES_KEY, getCachedWorkspaces } from "./workspace-list-cache";

const ws = (id: string, status: WorkspaceStatus = "active"): Workspace => ({ id, name: `Marca ${id}`, status });

const event = (code: WorkspaceStateEvent["code"], workspaceId?: string): WorkspaceStateEvent => ({
  code,
  workspaceId,
  status: code === "WORKSPACE_DELETED" ? 404 : 403,
  message: "texto do servidor",
});

let client: QueryClient;
let refetchList: ReturnType<typeof vi.fn>;
let unsubscribe: () => void;

/** Deixa a lista "em uso" (como o `useWorkspaces` do provider) e conta as buscas novas dela. */
function watchList(list: Workspace[]) {
  client.setQueryData(ME_WORKSPACES_KEY, list);
  refetchList = vi.fn().mockResolvedValue(list);
  const observer = new QueryObserver(client, { queryKey: ME_WORKSPACES_KEY, queryFn: refetchList, staleTime: Infinity });
  unsubscribe = observer.subscribe(() => {});
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const ids = () => getCachedWorkspaces(client)?.map((w) => w.id);
const statusOf = (id: string) => getCachedWorkspaces(client)?.find((w) => w.id === id)?.status;

beforeEach(() => {
  env.stored = null;
  env.toast.info.mockReset();
  client = new QueryClient();
  unsubscribe = () => {};
});

afterEach(() => {
  unsubscribe();
  client.clear();
});

describe("WORKSPACE_SUSPENDED", () => {
  it("marca o workspace como suspenso na lista, sem toast (a tela de bloqueio explica) e sem buscar de novo", async () => {
    env.stored = "a";
    watchList([ws("a"), ws("b")]);
    applyWorkspaceStateEvent(event("WORKSPACE_SUSPENDED", "a"), client);
    await settle();

    expect(statusOf("a")).toBe("suspended");
    expect(statusOf("b")).toBe("active");
    expect(env.toast.info).not.toHaveBeenCalled();
    // a lista fica marcada como velha (volta a ser conferida ao voltar para a aba), mas não é buscada agora
    expect(client.getQueryState(ME_WORKSPACES_KEY)?.isInvalidated).toBe(true);
    expect(refetchList).not.toHaveBeenCalled();
  });

  it("sem workspace no evento, vale o guardado", () => {
    env.stored = "b";
    watchList([ws("a"), ws("b")]);
    applyWorkspaceStateEvent(event("WORKSPACE_SUSPENDED"), client);
    expect(statusOf("b")).toBe("suspended");
    expect(statusOf("a")).toBe("active");
  });

  it("evento repetido (várias chamadas falhando juntas) não mexe de novo na lista", () => {
    watchList([ws("a")]);
    applyWorkspaceStateEvent(event("WORKSPACE_SUSPENDED", "a"), client);
    const afterFirst = getCachedWorkspaces(client);
    applyWorkspaceStateEvent(event("WORKSPACE_SUSPENDED", "a"), client);
    expect(getCachedWorkspaces(client)).toBe(afterFirst);
  });

  it("workspace que a lista em cache não conhece: busca a lista para saber o estado de verdade", async () => {
    watchList([ws("a")]);
    applyWorkspaceStateEvent(event("WORKSPACE_SUSPENDED", "desconhecido"), client);
    await vi.waitFor(() => expect(refetchList).toHaveBeenCalledTimes(1));
    expect(ids()).toEqual(["a"]);
  });

  it("sem workspace no evento e nada guardado, não há o que marcar", async () => {
    watchList([ws("a")]);
    applyWorkspaceStateEvent(event("WORKSPACE_SUSPENDED"), client);
    await settle();
    expect(statusOf("a")).toBe("active");
    expect(refetchList).not.toHaveBeenCalled();
  });
});

describe("WORKSPACE_ARCHIVED", () => {
  it("marca como arquivado e avisa com calma, com id fixo (várias escritas recusadas dão um aviso só)", () => {
    watchList([ws("a")]);
    applyWorkspaceStateEvent(event("WORKSPACE_ARCHIVED", "a"), client);
    applyWorkspaceStateEvent(event("WORKSPACE_ARCHIVED", "a"), client);

    expect(statusOf("a")).toBe("archived");
    expect(ARCHIVED_NOTICE).toBe("Este workspace está arquivado: só consulta.");
    expect(env.toast.info).toHaveBeenCalledTimes(2);
    for (const call of env.toast.info.mock.calls) {
      expect(call).toEqual([ARCHIVED_NOTICE, { id: ARCHIVED_TOAST_ID }]);
    }
  });

  it("avisa mesmo quando a lista já dizia arquivado (a escrita da pessoa não passou)", () => {
    watchList([ws("a", "archived")]);
    applyWorkspaceStateEvent(event("WORKSPACE_ARCHIVED", "a"), client);
    expect(env.toast.info).toHaveBeenCalledTimes(1);
    expect(statusOf("a")).toBe("archived");
  });
});

describe("WORKSPACE_DELETED", () => {
  it("o aberto sumiu e há outro: sai da lista, limpa o id guardado, busca a lista, explica e avisa quem navega", async () => {
    env.stored = "a";
    watchList([ws("a"), ws("b")]);
    const onWorkspaceGone = vi.fn();
    applyWorkspaceStateEvent(event("WORKSPACE_DELETED", "a"), client, { onWorkspaceGone });

    expect(ids()).toEqual(["b"]);
    expect(env.stored).toBeNull();
    expect(DELETED_NOTICE).toBe("Este workspace foi excluído e não está mais disponível.");
    expect(env.toast.info).toHaveBeenCalledTimes(1);
    expect(env.toast.info).toHaveBeenCalledWith(DELETED_NOTICE, { id: DELETED_TOAST_ID, description: "Você está agora em Marca b." });
    expect(onWorkspaceGone).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(refetchList).toHaveBeenCalledTimes(1));
  });

  it("o próximo é o primeiro que está funcionando, não um suspenso", () => {
    env.stored = "a";
    watchList([ws("a"), ws("b", "suspended"), ws("c")]);
    applyWorkspaceStateEvent(event("WORKSPACE_DELETED", "a"), client);
    expect(env.toast.info).toHaveBeenCalledWith(DELETED_NOTICE, { id: DELETED_TOAST_ID, description: "Você está agora em Marca c." });
  });

  it("era o último workspace: a lista fica vazia (estado 'Sem workspaces') e o aviso diz o que fazer", () => {
    env.stored = "a";
    watchList([ws("a")]);
    applyWorkspaceStateEvent(event("WORKSPACE_DELETED", "a"), client);
    expect(ids()).toEqual([]);
    expect(env.stored).toBeNull();
    expect(NO_WORKSPACES_NOTICE).toBe("Você não tem mais workspaces. Crie um novo para continuar.");
    expect(env.toast.info).toHaveBeenCalledWith(DELETED_NOTICE, { id: DELETED_TOAST_ID, description: NO_WORKSPACES_NOTICE });
  });

  it("sem workspace no evento, vale o guardado", () => {
    env.stored = "b";
    watchList([ws("a"), ws("b")]);
    applyWorkspaceStateEvent(event("WORKSPACE_DELETED"), client);
    expect(ids()).toEqual(["a"]);
    expect(env.stored).toBeNull();
  });

  it("não era o workspace aberto (a pessoa trocou com a chamada em voo): sai da lista em silêncio e o guardado fica", async () => {
    env.stored = "b";
    watchList([ws("a"), ws("b")]);
    const onWorkspaceGone = vi.fn();
    applyWorkspaceStateEvent(event("WORKSPACE_DELETED", "a"), client, { onWorkspaceGone });

    expect(ids()).toEqual(["b"]);
    expect(env.stored).toBe("b");
    expect(env.toast.info).not.toHaveBeenCalled();
    expect(onWorkspaceGone).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(refetchList).toHaveBeenCalledTimes(1));
  });

  it("várias chamadas falham juntas: só a primeira age (o resto chega com o workspace fora da lista e do storage)", async () => {
    env.stored = "a";
    watchList([ws("a"), ws("b")]);
    const onWorkspaceGone = vi.fn();
    applyWorkspaceStateEvent(event("WORKSPACE_DELETED", "a"), client, { onWorkspaceGone });
    applyWorkspaceStateEvent(event("WORKSPACE_DELETED", "a"), client, { onWorkspaceGone });
    applyWorkspaceStateEvent(event("WORKSPACE_DELETED", "a"), client, { onWorkspaceGone });
    await settle();

    expect(env.toast.info).toHaveBeenCalledTimes(1);
    expect(onWorkspaceGone).toHaveBeenCalledTimes(1);
    expect(refetchList).toHaveBeenCalledTimes(1);
  });
});

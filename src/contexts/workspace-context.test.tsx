/**
 * Contexto de workspace: seleção a partir da lista e transições de estado (suspenso, arquivado, excluído) que
 * as respostas do servidor provocam, ponta a ponta (observador de `fetch` → reações → lista → selecionado).
 */
import { QueryClientProvider, focusManager, type QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  stored: null as string | null,
  pathname: "/",
  navigate: vi.fn(),
  toast: { info: vi.fn() },
  /** O que `GET /me/workspaces` devolve agora. */
  list: [] as unknown[],
  listCalls: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: env.toast }));
// Como o roteador de verdade: um objeto estável cujo `state` muda por baixo (o pathname é lido na hora do evento).
vi.mock("@tanstack/react-router", () => {
  const router = {
    state: {
      get location() {
        return { pathname: env.pathname };
      },
    },
    navigate: env.navigate,
  };
  return { useRouter: () => router };
});
vi.mock("@/lib/utils/api", () => ({
  getApiUrl: (path: string) => `https://api.test/api/backoffice${path}`,
  getWorkspaceId: () => env.stored,
  saveWorkspaceId: (id: string) => {
    env.stored = id;
  },
  removeWorkspaceId: () => {
    env.stored = null;
  },
}));
vi.mock("@/shared/services/workspace", () => ({
  getMyWorkspaces: () => {
    env.listCalls();
    return Promise.resolve(env.list);
  },
}));

import { createAppQueryClient } from "@/lib/workspace-state/query-client";
import { ME_WORKSPACES_KEY } from "@/lib/workspace-state/workspace-list-cache";
import type { Workspace, WorkspaceStatus } from "@/shared/types";

import { WorkspaceProvider, useWorkspaceContext } from "./workspace-context";

const API = "https://api.test/api/backoffice";
const ws = (id: string, status: WorkspaceStatus = "active"): Workspace => ({ id, name: `Marca ${id}`, role: "owner", status });

const fetchMock = vi.fn();
let client: QueryClient;

function Probe() {
  const { selectedWorkspace, workspaces, isInitialized, selectWorkspace } = useWorkspaceContext();
  return (
    <div>
      <output data-testid="selected">{selectedWorkspace ? `${selectedWorkspace.id}:${selectedWorkspace.status}` : "nenhum"}</output>
      <output data-testid="total">{workspaces.length}</output>
      <output data-testid="ready">{String(isInitialized)}</output>
      {workspaces.map((w) => (
        <button key={w.id} type="button" onClick={() => selectWorkspace(w)}>
          {`abrir ${w.id}`}
        </button>
      ))}
    </div>
  );
}

function mount() {
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
}

const selected = () => screen.getByTestId("selected").textContent;
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function refusal(status: number, code: string, message = "texto do servidor"): Response {
  return new Response(JSON.stringify({ statusCode: status, message, error: code }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Uma chamada do app ao servidor (passa pelo `fetch` que o provider observa). */
async function call(path: string, workspaceId: string, method = "GET") {
  await act(async () => {
    await globalThis.fetch(`${API}${path}`, { method, headers: { "Workspace-Id": workspaceId } });
    await settle();
  });
}

beforeEach(() => {
  env.stored = null;
  env.pathname = "/";
  env.list = [];
  env.navigate.mockReset();
  env.toast.info.mockReset();
  env.listCalls.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  client = createAppQueryClient();
});

afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

describe("seleção a partir da lista", () => {
  it("restaura o workspace guardado", async () => {
    env.stored = "b";
    env.list = [ws("a"), ws("b")];
    mount();
    await waitFor(() => expect(selected()).toBe("b:active"));
    expect(screen.getByTestId("ready")).toHaveTextContent("true");
  });

  it("sem guardado, abre o primeiro que está funcionando (pula o suspenso e o arquivado) e guarda o id", async () => {
    env.list = [ws("a", "suspended"), ws("b", "archived"), ws("c"), ws("d")];
    mount();
    await waitFor(() => expect(selected()).toBe("c:active"));
    expect(env.stored).toBe("c");
  });

  it("só há workspaces suspensos: abre o primeiro (a pessoa cai na explicação e pode trocar)", async () => {
    env.list = [ws("a", "suspended"), ws("b", "suspended")];
    mount();
    await waitFor(() => expect(selected()).toBe("a:suspended"));
    expect(env.stored).toBe("a");
  });

  it("o guardado não está mais na lista (foi excluído): abre outro e guarda o novo id", async () => {
    env.stored = "excluido";
    env.list = [ws("a"), ws("b")];
    mount();
    await waitFor(() => expect(selected()).toBe("a:active"));
    expect(env.stored).toBe("a");
  });

  it("sem nenhum workspace: nada selecionado e o contexto fica pronto (estado 'Sem workspaces')", async () => {
    env.list = [];
    mount();
    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
    expect(selected()).toBe("nenhum");
    expect(screen.getByTestId("total")).toHaveTextContent("0");
  });

  it("a lista que fica vazia depois (o último foi excluído) limpa o selecionado em vez de mantê-lo", async () => {
    env.stored = "a";
    env.list = [ws("a")];
    mount();
    await waitFor(() => expect(selected()).toBe("a:active"));
    act(() => {
      client.setQueryData(ME_WORKSPACES_KEY, []);
    });
    await waitFor(() => expect(selected()).toBe("nenhum"));
  });

  it("a lista que muda o estado do selecionado (suspenso pelo suporte) muda o selecionado", async () => {
    env.stored = "a";
    env.list = [ws("a"), ws("b")];
    mount();
    await waitFor(() => expect(selected()).toBe("a:active"));
    act(() => {
      client.setQueryData(ME_WORKSPACES_KEY, [ws("a", "suspended"), ws("b")]);
    });
    await waitFor(() => expect(selected()).toBe("a:suspended"));
    act(() => {
      client.setQueryData(ME_WORKSPACES_KEY, [ws("a"), ws("b")]); // o suporte reativou
    });
    await waitFor(() => expect(selected()).toBe("a:active"));
  });
});

describe("selectWorkspace", () => {
  it("escolher um workspace guarda o id; escolher um suspenso não rebusca as consultas (o servidor recusaria tudo)", async () => {
    env.stored = "a";
    env.list = [ws("a"), ws("b", "suspended"), ws("c")];
    mount();
    await waitFor(() => expect(selected()).toBe("a:active"));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    invalidate.mockClear();

    await userEvent.click(screen.getByRole("button", { name: "abrir b" }));
    expect(selected()).toBe("b:suspended");
    expect(env.stored).toBe("b");
    expect(invalidate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "abrir c" }));
    expect(selected()).toBe("c:active");
    expect(env.stored).toBe("c");
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});

describe("o servidor revela o estado do workspace (ponta a ponta, pelo fetch)", () => {
  it("403 WORKSPACE_SUSPENDED: o selecionado vira suspenso (aparece o bloqueio) e os outros seguem ativos", async () => {
    env.stored = "a";
    env.list = [ws("a"), ws("b")];
    mount();
    await waitFor(() => expect(selected()).toBe("a:active"));

    fetchMock.mockResolvedValue(refusal(403, "WORKSPACE_SUSPENDED", "Este workspace está suspenso."));
    await call("/campaigns", "a");
    await waitFor(() => expect(selected()).toBe("a:suspended"));
    expect(env.toast.info).not.toHaveBeenCalled();
    expect(env.navigate).not.toHaveBeenCalled();
    // a lista em cache é a mesma fonte do menu: o `b` continua ativo
    expect(client.getQueryData<Workspace[]>(ME_WORKSPACES_KEY)?.map((w) => w.status)).toEqual(["suspended", "active"]);
  });

  it("recusa de um workspace que não é o selecionado (chamada em voo de antes da troca) não bloqueia o atual", async () => {
    env.stored = "b";
    env.list = [ws("a"), ws("b")];
    mount();
    await waitFor(() => expect(selected()).toBe("b:active"));

    fetchMock.mockResolvedValue(refusal(403, "WORKSPACE_SUSPENDED"));
    await call("/campaigns", "a");
    expect(selected()).toBe("b:active");
    expect(client.getQueryData<Workspace[]>(ME_WORKSPACES_KEY)?.map((w) => w.status)).toEqual(["suspended", "active"]);
  });

  it("403 WORKSPACE_ARCHIVED: o selecionado vira arquivado e a escrita recusada vira um aviso calmo (um só, mesmo com várias)", async () => {
    env.stored = "a";
    env.list = [ws("a")];
    mount();
    await waitFor(() => expect(selected()).toBe("a:active"));

    fetchMock.mockImplementation(async () => refusal(403, "WORKSPACE_ARCHIVED", "Este workspace está arquivado."));
    await call("/campaigns", "a", "POST");
    await call("/campaigns/1", "a", "PATCH");
    await waitFor(() => expect(selected()).toBe("a:archived"));
    expect(env.toast.info).toHaveBeenCalledTimes(2);
    for (const args of env.toast.info.mock.calls) {
      expect(args).toEqual(["Este workspace está arquivado: só consulta.", { id: "workspace-archived" }]);
    }
  });

  it("404 WORKSPACE_DELETED com outro workspace: limpa o id guardado, rebusca a lista, abre o outro e explica", async () => {
    env.stored = "a";
    env.list = [ws("a"), ws("b")];
    mount();
    await waitFor(() => expect(selected()).toBe("a:active"));

    env.list = [ws("b")]; // o servidor já não lista o excluído
    env.listCalls.mockClear();
    fetchMock.mockResolvedValue(refusal(404, "WORKSPACE_DELETED", "Este workspace foi excluído e não está mais disponível."));
    await call("/campaigns", "a");

    await waitFor(() => expect(selected()).toBe("b:active"));
    expect(env.stored).toBe("b");
    expect(env.listCalls).toHaveBeenCalled();
    expect(env.toast.info).toHaveBeenCalledWith("Este workspace foi excluído e não está mais disponível.", {
      id: "workspace-deleted",
      description: "Você está agora em Marca b.",
    });
  });

  it("excluído estando num detalhe do workspace (campanha): leva ao início; numa lista, fica onde está", async () => {
    env.stored = "a";
    env.list = [ws("a"), ws("b"), ws("c")];
    mount();
    await waitFor(() => expect(selected()).toBe("a:active"));

    env.pathname = "/campaigns/abc";
    env.list = [ws("b"), ws("c")];
    fetchMock.mockResolvedValue(refusal(404, "WORKSPACE_DELETED"));
    await call("/campaigns/abc", "a");
    await waitFor(() => expect(selected()).toBe("b:active"));
    expect(env.navigate).toHaveBeenCalledWith({ to: "/", replace: true });

    env.navigate.mockReset();
    env.pathname = "/campaigns";
    env.list = [ws("c")];
    await call("/campaigns", "b");
    await waitFor(() => expect(selected()).toBe("c:active"));
    expect(env.navigate).not.toHaveBeenCalled();
  });

  it("404 WORKSPACE_DELETED do último workspace: fica o estado 'Sem workspaces'", async () => {
    env.stored = "a";
    env.list = [ws("a")];
    mount();
    await waitFor(() => expect(selected()).toBe("a:active"));

    env.list = [];
    fetchMock.mockResolvedValue(refusal(404, "WORKSPACE_DELETED"));
    await call("/campaigns", "a");

    await waitFor(() => expect(selected()).toBe("nenhum"));
    expect(env.stored).toBeNull();
    expect(screen.getByTestId("total")).toHaveTextContent("0");
    expect(env.toast.info).toHaveBeenCalledWith(expect.any(String), {
      id: "workspace-deleted",
      description: "Você não tem mais workspaces. Crie um novo para continuar.",
    });
  });

  it("erros comuns (403 sem permissão, 500) não mexem em nada", async () => {
    env.stored = "a";
    env.list = [ws("a")];
    mount();
    await waitFor(() => expect(selected()).toBe("a:active"));

    fetchMock.mockResolvedValueOnce(refusal(403, "Forbidden", "Forbidden resource"));
    await call("/campaigns", "a");
    fetchMock.mockResolvedValueOnce(refusal(500, "WORKSPACE_SUSPENDED"));
    await call("/campaigns", "a");
    expect(selected()).toBe("a:active");
    expect(env.toast.info).not.toHaveBeenCalled();
  });

  it("o workspace reativado pelo suporte sai do bloqueio ao voltar para a aba (a lista marcada como velha é conferida)", async () => {
    env.stored = "a";
    env.list = [ws("a"), ws("b")];
    mount();
    await waitFor(() => expect(selected()).toBe("a:active"));

    fetchMock.mockResolvedValue(refusal(403, "WORKSPACE_SUSPENDED"));
    await call("/campaigns", "a");
    await waitFor(() => expect(selected()).toBe("a:suspended"));

    env.list = [ws("a"), ws("b")]; // o suporte reativou
    env.listCalls.mockClear();
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(selected()).toBe("a:active"));
    expect(env.listCalls).toHaveBeenCalled();
  });

  it("a chamada que uma tela dispara ao montar já é observada (o observador existe antes dos efeitos da tela)", async () => {
    env.stored = "a";
    env.list = [ws("a")];
    fetchMock.mockResolvedValue(refusal(403, "WORKSPACE_ARCHIVED"));
    function EarlyCaller() {
      useEffect(() => {
        void globalThis.fetch(`${API}/campaigns`, { method: "POST", headers: { "Workspace-Id": "a" } });
      }, []);
      return null;
    }
    render(
      <QueryClientProvider client={client}>
        <WorkspaceProvider>
          <Probe />
          <EarlyCaller />
        </WorkspaceProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(env.toast.info).toHaveBeenCalledWith("Este workspace está arquivado: só consulta.", { id: "workspace-archived" }));
  });

  it("o observador sai junto com o provider (o fetch volta ao que era)", async () => {
    env.list = [ws("a")];
    const { unmount } = mount();
    await waitFor(() => expect(selected()).toBe("a:active"));
    expect(globalThis.fetch).not.toBe(fetchMock);
    unmount();
    expect(globalThis.fetch).toBe(fetchMock);
  });
});

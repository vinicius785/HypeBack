import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InfluencerList, InfluencerListDetail } from "@/shared/services/influencer-lists";

const h = vi.hoisted(() => ({
  lists: [] as unknown[],
  listsState: { isLoading: false, isError: false },
  detail: null as unknown,
  canWrite: true,
  remove: vi.fn(async () => undefined),
  del: vi.fn(async () => undefined),
  duplicate: vi.fn(async () => ({ failed: 0 })),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspacePermissions: () => ({ catalog_write: h.canWrite }) }));
vi.mock("@/hooks/use-influencer-lists", () => ({
  useInfluencerLists: () => ({ data: h.lists, ...h.listsState, refetch: vi.fn() }),
  useInfluencerList: () => ({ data: h.detail, isLoading: false, isError: false, refetch: vi.fn() }),
  useInfluencerListReach: () => ({
    data: { creators_total: 6, creators_with_network: 6, creators_with_reach: 6, followers_total: 90000, estimated_reach_total: 9000, by_network: [{ network: "instagram", creators: 6, followers: 90000, estimated_reach: 9000, creators_with_reach: 6 }] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-influencer-accounts", () => ({
  useInfluencerAccountsMap: (ids: number[]) => ({
    loading: false,
    map: new Map(ids.map((id) => [id, [{ id: `p${id}`, type: "instagram", type_label: "Instagram", name: "ig", username: `user${id}`, members: id * 1000 }]])),
  }),
}));
vi.mock("@/hooks/use-creators-catalog", () => ({
  useCreateInfluencerList: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateInfluencerList: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteInfluencerList: () => ({ mutateAsync: h.del, isPending: false }),
  useDuplicateInfluencerList: () => ({ mutateAsync: h.duplicate, isPending: false }),
  useRemoveFromInfluencerList: () => ({ mutateAsync: h.remove, isPending: false }),
  useAddToInfluencerList: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreatorsCatalog: () => ({ data: { pages: [{ items: [] }] }, isLoading: false, isError: false }),
}));
vi.mock("@/shared/services/influencer-lists", async (orig) => ({
  ...(await orig<typeof import("@/shared/services/influencer-lists")>()),
  getInfluencerList: vi.fn(async () => h.detail),
}));

import { ListsTab } from "./lists-tab";

const list = (over: Partial<InfluencerList> = {}): InfluencerList => ({ id: "l1", name: "Moda verão", description: "Para a campanha de verão", created_at: "2026-01-05T12:00:00Z", influencer_count: 6, ...over });
const detail = (n: number): InfluencerListDetail => ({
  id: "l1",
  name: "Moda verão",
  created_at: "2026-01-05T12:00:00Z",
  influencers: Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Criador ${String.fromCharCode(65 + i)}`, email: `c${i}@x.com`, photo: null })),
});

beforeEach(() => {
  h.lists = [list()];
  h.listsState = { isLoading: false, isError: false };
  h.detail = detail(6);
  h.canWrite = true;
  vi.clearAllMocks();
});

describe("Minhas listas", () => {
  it("o cartão mostra nome, descrição, total e data; o menu tem editar, duplicar e excluir", () => {
    render(<ListsTab />);
    expect(screen.getByRole("heading", { name: "Moda verão" })).toBeTruthy();
    expect(screen.getByText("Para a campanha de verão")).toBeTruthy();
    expect(screen.getByText("6 criadores")).toBeTruthy();
    expect(screen.getByText("Criada em 05/01/2026")).toBeTruthy();
    const menu = screen.getByRole("menu");
    for (const t of ["Editar informações", "Duplicar lista", "Excluir lista"]) expect(within(menu).getByRole("menuitem", { name: new RegExp(t) })).toBeTruthy();
  });

  it("sem permissão de escrita não há editar, duplicar, excluir nem nova lista", () => {
    h.canWrite = false;
    render(<ListsTab />);
    expect(screen.queryByRole("menuitem", { name: /Excluir/ })).toBeNull();
    expect(screen.queryByText("Nova lista")).toBeNull();
  });

  it("sem listas: estado vazio com a ação de criar; com erro: tentar de novo", () => {
    h.lists = [];
    const { unmount } = render(<ListsTab />);
    expect(screen.getByText("Você ainda não tem listas")).toBeTruthy();
    unmount();
    h.listsState = { isLoading: false, isError: true };
    render(<ListsTab />);
    expect(screen.getByRole("alert").textContent).toMatch(/Não foi possível carregar suas listas/);
  });

  it("abrir mostra cabeçalho, indicadores e as linhas com @, rede e seguidores", () => {
    render(<ListsTab />);
    fireEvent.click(screen.getAllByRole("button", { name: "Abrir lista" })[0]);
    const dlg = screen.getByRole("dialog", { name: "Lista Moda verão" });
    expect(within(dlg).getByText("Alcance estimado")).toBeTruthy();
    expect(within(dlg).getByText("Redes representadas").nextElementSibling?.textContent).toBe("1");
    expect(within(dlg).getByText("@user3")).toBeTruthy();
    expect(within(dlg).getAllByText("Instagram").length).toBeGreaterThan(0);
  });

  it("busca interna, sem resultados e ordenação por seguidores", () => {
    render(<ListsTab />);
    fireEvent.click(screen.getAllByRole("button", { name: "Abrir lista" })[0]);
    const names = () => within(screen.getByRole("list", { name: "Criadores da lista" })).getAllByRole("listitem").map((li) => li.querySelector("b")?.textContent);
    fireEvent.change(screen.getByLabelText("Buscar na lista"), { target: { value: "criador c" } });
    expect(names()).toEqual(["Criador C"]);
    fireEvent.change(screen.getByLabelText("Buscar na lista"), { target: { value: "zzz" } });
    expect(screen.getByText("Nenhum criador encontrado")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar busca" }).at(-1)!);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "followers" } });
    expect(names()[0]).toBe("Criador F");
  });

  it("remover pede confirmação na própria linha", () => {
    render(<ListsTab />);
    fireEvent.click(screen.getAllByRole("button", { name: "Abrir lista" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Remover Criador A da lista" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(h.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remover Criador A da lista" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(h.remove).toHaveBeenCalledWith({ listId: "l1", userId: 1 });
  });

  it("lista vazia oferece adicionar criadores", () => {
    h.lists = [list({ influencer_count: 0 })];
    h.detail = detail(0);
    render(<ListsTab />);
    fireEvent.click(screen.getAllByRole("button", { name: "Abrir lista" })[0]);
    expect(screen.getByText("Esta lista ainda não tem criadores")).toBeTruthy();
  });

  it("excluir confirma no diálogo", () => {
    render(<ListsTab />);
    fireEvent.click(screen.getByRole("menuitem", { name: /Excluir lista/ }));
    expect(screen.getByText(/será excluída/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Excluir lista" }).at(-1)!);
    expect(h.del).toHaveBeenCalledWith("l1");
  });
});

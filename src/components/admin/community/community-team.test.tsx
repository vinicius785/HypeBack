import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("sonner", () => ({ toast: api.toast }));
vi.mock("@/shared/services/community-members", () => ({ listCommunityMembers: api.list, updateCommunityMember: api.update }));

import { renderAdminRoute } from "@/test/render-admin-route";
import type { CommunityMember } from "@/shared/services/community-members";

import { CommunityTeam } from "./community-team";

const person = (o: Partial<CommunityMember> = {}): CommunityMember => ({
  id: "1", name: "Ana Souza", username: "ana", email: "ana@x.com", avatar_url: null, is_moderator: false, is_verified: false, verified_at: null, ...o,
});
const page = (items: CommunityMember[], total_pages = 1, p = 1) => ({ items, meta: { page: p, per_page: 20, total: items.length, total_pages } });

function mount() {
  return renderAdminRoute([{ path: "/admin/groups", component: () => <CommunityTeam /> }], "/admin/groups");
}
const sw = (label: string, name: string) => screen.getByRole("switch", { name: `${label}: ${name}` });

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue(page([person({ is_moderator: true }), person({ id: "2", name: "Loja Oficial", username: "oficial", email: "o@x.com", is_verified: true })]));
  api.update.mockImplementation(async (id: string, input: { moderator?: boolean; verified?: boolean }) =>
    person({ id, name: id === "1" ? "Ana Souza" : "Loja Oficial", is_moderator: input.moderator ?? false, is_verified: input.verified ?? false }),
  );
});
afterEach(cleanup);

describe("Comunidade › Equipe", () => {
  it("lista a equipe com Moderador e Verificado por pessoa, e o selo roxo na conta oficial", async () => {
    await mount();
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ filter: "team" }));
    expect(sw("Moderador", "Ana Souza")).toHaveAttribute("aria-checked", "true");
    expect(sw("Verificado", "Ana Souza")).toHaveAttribute("aria-checked", "false");
    expect(sw("Verificado", "Loja Oficial")).toHaveAttribute("aria-checked", "true");
    const oficial = screen.getByText("Loja Oficial").closest("li") as HTMLElement;
    expect(within(oficial).getByRole("img", { name: "Conta oficial" })).toBeInTheDocument();
    expect(within(screen.getByText("Ana Souza").closest("li") as HTMLElement).queryByRole("img", { name: "Conta oficial" })).toBeNull();
  });

  it("ligar Verificado manda só verified e avisa quem recebeu o selo", async () => {
    const user = userEvent.setup();
    await mount();
    await screen.findByText("Ana Souza");
    await user.click(sw("Verificado", "Ana Souza"));
    expect(api.update).toHaveBeenCalledWith("1", { verified: true });
    await waitFor(() => expect(api.toast.success).toHaveBeenCalledWith("Ana Souza agora é uma conta oficial"));
  });

  it("tirar o selo e tirar moderador têm mensagens próprias", async () => {
    const user = userEvent.setup();
    await mount();
    await screen.findByText("Ana Souza");
    await user.click(sw("Verificado", "Loja Oficial"));
    expect(api.update).toHaveBeenCalledWith("2", { verified: false });
    await waitFor(() => expect(api.toast.success).toHaveBeenCalledWith("O selo de Loja Oficial foi removido"));
    await user.click(sw("Moderador", "Ana Souza"));
    expect(api.update).toHaveBeenLastCalledWith("1", { moderator: false });
    await waitFor(() => expect(api.toast.success).toHaveBeenCalledWith("Ana Souza deixou de ser moderador"));
  });

  it("falha ao salvar mostra o erro do servidor", async () => {
    api.update.mockRejectedValueOnce(new Error("Usuário não encontrado"));
    const user = userEvent.setup();
    await mount();
    await screen.findByText("Ana Souza");
    await user.click(sw("Moderador", "Ana Souza"));
    await waitFor(() => expect(api.toast.error).toHaveBeenCalledWith("Usuário não encontrado"));
  });

  it("digitar na busca procura em todas as pessoas; busca curta não consulta", async () => {
    const user = userEvent.setup();
    await mount();
    await screen.findByText("Ana Souza");
    api.list.mockClear();
    await user.type(screen.getByRole("searchbox", { name: "Buscar pessoa" }), "a");
    await new Promise((r) => setTimeout(r, 450));
    expect(api.list).not.toHaveBeenCalledWith(expect.objectContaining({ filter: "all" }));
    api.list.mockResolvedValueOnce(page([person({ id: "9", name: "Bia Lima", email: "bia@x.com" })]));
    await user.type(screen.getByRole("searchbox", { name: "Buscar pessoa" }), "bia");
    await waitFor(() => expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ filter: "all", q: "abia" })));
  });

  it("sem ninguém na equipe: orienta a buscar; busca sem resultado tem Limpar busca", async () => {
    api.list.mockResolvedValue(page([]));
    const user = userEvent.setup();
    await mount();
    expect(await screen.findByText("Ninguém na equipe ainda")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Buscar pessoa" }), "zzz");
    expect(await screen.findByText("Nenhuma pessoa encontrada")).toBeInTheDocument();
    // Há dois "Limpar busca": o do campo e o do estado vazio. O do estado vazio vem por último na tela.
    await user.click(screen.getAllByRole("button", { name: "Limpar busca" }).at(-1)!);
    expect(await screen.findByText("Ninguém na equipe ainda")).toBeInTheDocument();
  });

  it("erro ao carregar mostra o aviso com tentar de novo", async () => {
    api.list.mockRejectedValue(new Error("falhou"));
    await mount();
    expect(await screen.findByText("Não foi possível carregar as pessoas")).toBeInTheDocument();
  });

  it("explica que moderador e selo são só identificação, sem acesso ao Admin", async () => {
    await mount();
    expect(await screen.findByText(/não dão acesso ao Admin/)).toBeInTheDocument();
  });
});

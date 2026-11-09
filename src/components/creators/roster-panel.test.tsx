import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  canWrite: true,
  members: [] as unknown[],
  remove: vi.fn(),
  setExclusive: vi.fn(),
  navigate: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspacePermissions: () => ({ influencers_invite: h.canWrite }) }));
vi.mock("@/hooks/use-agency-roster", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-agency-roster")>()),
  useAgencyRoster: () => ({ data: h.members, isLoading: false, error: null }),
  useRemoveFromRoster: () => ({ mutate: h.remove, isPending: false }),
  useSetRosterExclusive: () => ({ mutate: h.setExclusive, isPending: false }),
}));
vi.mock("@/styles/agency-roster.css", () => ({}));

import { RosterPanel } from "./roster-panel";

const Panel = ({ status = "all" }: { status?: "all" | "active" | "invited" }): ReactElement => <RosterPanel status={status} onStatusChange={vi.fn()} tabs={<div />} onFindCreators={h.navigate} />;

const member = (id: string, name: string, status: "active" | "invited", over: Record<string, unknown> = {}) => ({
  id,
  status,
  exclusive: true,
  invited_at: "2026-11-03T00:00:00Z",
  responded_at: null,
  creator: {
    id: Number(id.replace(/\D/g, "")) || 1,
    name,
    photo: null,
    username: name.toLowerCase().split(" ")[0],
    followers_total: 15000,
    networks: [{ type: "instagram", username: "x", members: 10000 }],
  },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.canWrite = true;
  h.members = [member("m1", "Bia Alves", "active"), member("m2", "Caio Lima", "invited"), member("m3", "Duda Reis", "active", { exclusive: false })];
});

describe("Meu elenco (aceitos e convites pendentes numa lista só)", () => {
  it("mostra todos juntos, pendentes primeiro, cada um com a sua situação", () => {
    render(<Panel />);
    const names = Array.from(screen.getByRole("list", { name: "Meu elenco" }).querySelectorAll(":scope > li")).map((li) => li.querySelector(".rst-id b")?.textContent);
    expect(names).toEqual(["Caio Lima", "Bia Alves", "Duda Reis"]);
    expect(screen.getByText("Aguardando resposta")).toBeInTheDocument();
    expect(screen.getByText("Exclusivo da agência")).toBeInTheDocument();
    expect(screen.getByText("Aberto a outros workspaces")).toBeInTheDocument();
  });

  it("a subaba de situação separa pendentes e ativos", () => {
    const { unmount } = render(<Panel status="invited" />);
    expect(screen.getByText("Caio Lima")).toBeInTheDocument();
    expect(screen.queryByText("Bia Alves")).not.toBeInTheDocument();
    expect(screen.getByText("Eles entram no elenco quando aceitarem o convite pelo app.")).toBeInTheDocument();
    unmount();
    render(<Panel status="active" />);
    expect(screen.getByText("Bia Alves")).toBeInTheDocument();
    expect(screen.queryByText("Caio Lima")).not.toBeInTheDocument();
  });

  it("alternar a exclusividade chama a API com o valor contrário", async () => {
    const user = userEvent.setup();
    render(<Panel />);
    await user.click(screen.getByRole("switch", { name: "Exclusividade de Bia Alves" }));
    expect(h.setExclusive).toHaveBeenCalledWith({ rosterId: "m1", exclusive: false }, expect.any(Object));
    await user.click(screen.getByRole("switch", { name: "Exclusividade de Duda Reis" }));
    expect(h.setExclusive).toHaveBeenLastCalledWith({ rosterId: "m3", exclusive: true }, expect.any(Object));
  });

  it("remover pede confirmação antes de chamar a API; 'Voltar' desiste", async () => {
    const user = userEvent.setup();
    render(<Panel />);
    const card = screen.getByText("Bia Alves").closest("li") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Remover do elenco" }));
    expect(h.remove).not.toHaveBeenCalled();
    expect(within(card).getByRole("alert")).toHaveTextContent("Tirar Bia Alves do elenco?");
    await user.click(within(card).getByRole("button", { name: "Voltar" }));
    expect(within(card).queryByRole("alert")).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Remover do elenco" }));
    await user.click(within(card).getByRole("button", { name: "Confirmar remoção" }));
    expect(h.remove).toHaveBeenCalledWith("m1", expect.any(Object));
  });

  it("cancelar um convite pendente usa a mesma confirmação", async () => {
    const user = userEvent.setup();
    render(<Panel />);
    const card = screen.getByText("Caio Lima").closest("li") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Cancelar convite" }));
    expect(within(card).getByRole("alert")).toHaveTextContent("Cancelar o convite para Caio Lima?");
    await user.click(within(card).getByRole("button", { name: "Cancelar convite" }));
    expect(h.remove).toHaveBeenCalledWith("m2", expect.any(Object));
  });

  it("sem permissão de convidar: sem interruptor nem botões de remover", () => {
    h.canWrite = false;
    render(<Panel />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover do elenco" })).not.toBeInTheDocument();
    expect(screen.getByText("Bia Alves")).toBeInTheDocument();
  });

  it("cada linha traz @usuário, seguidores e a data de entrada no elenco", () => {
    h.members = [member("m1", "Bia Alves", "active", { responded_at: "2026-10-20T12:00:00Z" })];
    render(<Panel />);
    const row = screen.getByText("Bia Alves").closest("li") as HTMLElement;
    expect(within(row).getByText("@bia")).toBeInTheDocument();
    expect(within(row).getByText("15 mil")).toBeInTheDocument();
    expect(within(row).getAllByText("Desde 20/10/2026").length).toBeGreaterThan(0);
  });

  it("busca por nome ou @, filtra por rede e ordena", async () => {
    const user = userEvent.setup();
    h.members = [
      member("m1", "Bia Alves", "active", { creator: { id: 1, name: "Bia Alves", photo: null, username: "bia", followers_total: 1000, networks: [{ type: "instagram", username: "bia", members: 1000 }] } }),
      member("m2", "Caio Lima", "active", { creator: { id: 2, name: "Caio Lima", photo: null, username: "caiol", followers_total: 9000, networks: [{ type: "tiktok", username: "caiol", members: 9000 }] } }),
    ];
    render(<Panel />);
    const names = () => Array.from(screen.getByRole("list", { name: "Meu elenco" }).querySelectorAll(":scope > li")).map((li) => li.querySelector(".rst-id b")?.textContent);
    await user.click(screen.getByRole("button", { name: /^Ordenar:/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "Mais seguidores" }));
    expect(names()).toEqual(["Caio Lima", "Bia Alves"]);
    await user.selectOptions(screen.getByLabelText("Filtrar por rede social"), "instagram");
    expect(names()).toEqual(["Bia Alves"]);
    await user.selectOptions(screen.getByLabelText("Filtrar por rede social"), "all");
    await user.type(screen.getByLabelText("Buscar no elenco"), "@caiol");
    expect(names()).toEqual(["Caio Lima"]);
    await user.clear(screen.getByLabelText("Buscar no elenco"));
    await user.type(screen.getByLabelText("Buscar no elenco"), "zzz");
    expect(screen.getByText("Nenhum criador encontrado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(names()).toHaveLength(2);
  });

  it("elenco vazio orienta e leva ao catálogo", async () => {
    h.members = [];
    const user = userEvent.setup();
    render(<Panel />);
    expect(screen.getByText("Seu elenco começa aqui")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Encontrar criadores/ })[0]);
    expect(h.navigate).toHaveBeenCalledTimes(1);
  });
});

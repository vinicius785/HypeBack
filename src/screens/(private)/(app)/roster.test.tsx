import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isAgency: true,
  canWrite: true,
  members: [] as unknown[],
  remove: vi.fn(),
  setExclusive: vi.fn(),
  navigate: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (opts: unknown) => opts, useNavigate: () => h.navigate }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspacePermissions: () => ({ influencers_invite: h.canWrite }) }));
vi.mock("@/hooks/use-agency-brands", () => ({ useIsAgencyWorkspace: () => h.isAgency }));
vi.mock("@/hooks/use-agency-roster", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-agency-roster")>()),
  useAgencyRoster: () => ({ data: h.members, isLoading: false, error: null }),
  useRemoveFromRoster: () => ({ mutate: h.remove, isPending: false }),
  useSetRosterExclusive: () => ({ mutate: h.setExclusive, isPending: false }),
}));
vi.mock("@/styles/agency-roster.css", () => ({}));

import { Route } from "./roster";

const Page = (Route as unknown as { component: () => ReactElement }).component;

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
  h.isAgency = true;
  h.canWrite = true;
  h.members = [member("m1", "Bia Alves", "active"), member("m2", "Caio Lima", "invited"), member("m3", "Duda Reis", "active", { exclusive: false })];
});

describe("página Elenco", () => {
  it("fora de agência explica que é exclusivo e não lista ninguém", () => {
    h.isAgency = false;
    render(<Page />);
    expect(screen.getByText("O elenco é exclusivo de agências")).toBeInTheDocument();
    expect(screen.queryByText("Bia Alves")).not.toBeInTheDocument();
  });

  it("mostra quem está no elenco, com a exclusividade de cada um, e os convites na outra aba", async () => {
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getByText("Bia Alves")).toBeInTheDocument();
    expect(screen.getByText("Duda Reis")).toBeInTheDocument();
    expect(screen.queryByText("Caio Lima")).not.toBeInTheDocument();
    expect(screen.getByText("Exclusivo da agência")).toBeInTheDocument();
    expect(screen.getByText("Aberto a outros workspaces")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^Convites/ }));
    expect(screen.getByText("Caio Lima")).toBeInTheDocument();
    expect(screen.getByText("Ele entra no elenco quando aceitar o convite pelo app.")).toBeInTheDocument();
  });

  it("alternar a exclusividade chama a API com o valor contrário", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("switch", { name: "Exclusividade de Bia Alves" }));
    expect(h.setExclusive).toHaveBeenCalledWith({ rosterId: "m1", exclusive: false }, expect.any(Object));
    await user.click(screen.getByRole("switch", { name: "Exclusividade de Duda Reis" }));
    expect(h.setExclusive).toHaveBeenLastCalledWith({ rosterId: "m3", exclusive: true }, expect.any(Object));
  });

  it("remover pede confirmação antes de chamar a API; 'Voltar' desiste", async () => {
    const user = userEvent.setup();
    render(<Page />);
    const card = screen.getByText("Bia Alves").closest("article") as HTMLElement;
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
    render(<Page />);
    await user.click(screen.getByRole("tab", { name: /^Convites/ }));
    const card = screen.getByText("Caio Lima").closest("article") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "Cancelar convite" }));
    expect(within(card).getByRole("alert")).toHaveTextContent("Cancelar o convite para Caio Lima?");
    await user.click(within(card).getByRole("button", { name: "Cancelar convite" }));
    expect(h.remove).toHaveBeenCalledWith("m2", expect.any(Object));
  });

  it("sem permissão de convidar: sem interruptor nem botões de remover", () => {
    h.canWrite = false;
    render(<Page />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover do elenco" })).not.toBeInTheDocument();
    expect(screen.getByText("Bia Alves")).toBeInTheDocument();
  });

  it("elenco vazio orienta e leva ao catálogo", async () => {
    h.members = [];
    const user = userEvent.setup();
    render(<Page />);
    expect(screen.getByText("Seu elenco ainda está vazio")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Encontrar criadores/ })[0]);
    expect(h.navigate).toHaveBeenCalledWith({ to: "/creators" });
  });
});

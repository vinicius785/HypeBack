import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  listMyWorkspaceInvites: vi.fn(),
  acceptWorkspaceInvite: vi.fn(),
  declineWorkspaceInvite: vi.fn(),
}));
vi.mock("@/shared/services/workspace-invites", () => service);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

import { renderAdminRoute } from "@/test/render-admin-route";

import { MyInvitesPanel, expiryLabel } from "./my-invites";

const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

const invite = (over: Record<string, unknown> = {}) => ({
  id: 5,
  workspaceId: "7",
  workspaceName: "Casa Aurora",
  role: "admin",
  roleLabel: "Administrador",
  invitedByName: "Lúcia Prado",
  createdAt: new Date().toISOString(),
  expiresAt: inDays(5),
  ...over,
});

const open = (compact = false) =>
  renderAdminRoute([{ path: "/", component: () => <MyInvitesPanel compact={compact} /> }], "/");

beforeEach(() => {
  vi.clearAllMocks();
  service.listMyWorkspaceInvites.mockResolvedValue([invite()]);
});
afterEach(cleanup);

describe("MyInvitesPanel", () => {
  it("mostra quem convidou, o papel e a validade", async () => {
    open();
    expect(await screen.findByText("Casa Aurora")).toBeInTheDocument();
    expect(screen.getByText(/Convidado por Lúcia Prado/)).toBeInTheDocument();
    expect(screen.getByText(/como Administrador/)).toBeInTheDocument();
    expect(screen.getByText(/vence em 5 dias/)).toBeInTheDocument();
  });

  it("sem convites não desenha nada", async () => {
    service.listMyWorkspaceInvites.mockResolvedValue([]);
    open();
    await waitFor(() => expect(service.listMyWorkspaceInvites).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: "Convites para você" })).not.toBeInTheDocument();
  });

  it("aceitar chama a API, avisa e relê as marcas e os convites", async () => {
    service.acceptWorkspaceInvite.mockResolvedValue({ workspaceId: "7" });
    const { queryClient } = open();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Aceitar convite de Casa Aurora" }));

    await waitFor(() => expect(service.acceptWorkspaceInvite).toHaveBeenCalledWith(5));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Você entrou em Casa Aurora."));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["me-workspaces"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["my-workspace-invites"] });
  });

  it("recusar chama a API e não mexe nas marcas", async () => {
    service.declineWorkspaceInvite.mockResolvedValue(undefined);
    const { queryClient } = open();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Recusar convite de Casa Aurora" }));

    await waitFor(() => expect(service.declineWorkspaceInvite).toHaveBeenCalledWith(5));
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ["me-workspaces"] });
    expect(service.acceptWorkspaceInvite).not.toHaveBeenCalled();
  });

  it("erro ao aceitar mostra o texto da API", async () => {
    service.acceptWorkspaceInvite.mockRejectedValue(new Error("Este convite venceu. Peça um novo para a marca."));
    open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Aceitar convite de Casa Aurora" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Este convite venceu. Peça um novo para a marca."),
    );
  });

  it("vários convites: título no plural e uma linha para cada marca", async () => {
    service.listMyWorkspaceInvites.mockResolvedValue([invite(), invite({ id: 6, workspaceName: "Loja Norte" })]);
    open(true);
    expect(await screen.findByRole("heading", { name: "Você tem 2 convites de marcas" })).toBeInTheDocument();
    expect(screen.getByText("Loja Norte")).toBeInTheDocument();
  });
});

describe("expiryLabel", () => {
  const now = new Date("2026-11-03T12:00:00Z").getTime();
  it.each([
    ["2026-11-03T20:00:00Z", "vence hoje"],
    ["2026-11-04T20:00:00Z", "vence amanhã"],
    ["2026-11-08T12:00:00Z", "vence em 5 dias"],
    ["não é data", ""],
  ])("%s -> %s", (iso, label) => {
    expect(expiryLabel(iso, now)).toBe(label);
  });
});

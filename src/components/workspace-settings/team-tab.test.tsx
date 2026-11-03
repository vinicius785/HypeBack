import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PendingWorkspaceInvite } from "@/shared/services/workspace-invites";

import { TeamTab } from "./team-tab";

afterEach(cleanup);

const invite: PendingWorkspaceInvite = {
  id: 9,
  email: "novo@marca.com",
  role: "admin",
  roleLabel: "Administrador",
  invitedByName: "Lúcia Prado",
  createdAt: "2026-11-01T10:00:00Z",
  expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
};

const base = {
  workspaceName: "Casa Aurora",
  members: [],
  loading: false,
  canInvite: true,
  canManagePermissions: true,
  canRemoveMember: () => false,
  removing: false,
  onInvite: vi.fn(),
  onEdit: vi.fn(),
  onRemove: vi.fn(),
};

describe("TeamTab — convites aguardando resposta", () => {
  it("lista quem foi convidado e deixa cancelar", async () => {
    const onCancelInvite = vi.fn();
    render(<TeamTab {...base} pendingInvites={[invite]} onCancelInvite={onCancelInvite} />);

    expect(screen.getByRole("heading", { name: "Convites aguardando resposta" })).toBeInTheDocument();
    expect(screen.getByText("novo@marca.com")).toBeInTheDocument();
    expect(screen.getByText(/Convidado por Lúcia Prado/)).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Cancelar convite de novo@marca.com" }));
    expect(onCancelInvite).toHaveBeenCalledWith(invite);
  });

  it("sem permissão de convidar, vê a lista mas não o botão de cancelar", () => {
    render(<TeamTab {...base} canInvite={false} pendingInvites={[invite]} onCancelInvite={vi.fn()} />);
    expect(screen.getByText("novo@marca.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancelar convite/ })).not.toBeInTheDocument();
  });

  it("sem convites pendentes, a seção não aparece", () => {
    render(<TeamTab {...base} pendingInvites={[]} />);
    expect(screen.queryByRole("heading", { name: "Convites aguardando resposta" })).not.toBeInTheDocument();
  });
});

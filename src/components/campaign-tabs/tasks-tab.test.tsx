import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  board: undefined as unknown,
  can: { canRead: true, canCreate: true, canWrite: true, canDelete: true },
  open: vi.fn(),
  openState: { isPending: false, isError: false, error: null as unknown },
}));

vi.mock("@/hooks/use-agency-projects", () => ({
  useCampaignBoard: () => ({ data: h.board, isLoading: false, error: null, refetch: vi.fn(), isFetching: false }),
  useOpenCampaignBoard: () => ({ mutate: h.open, ...h.openState }),
}));
vi.mock("@/components/agency-projects/use-project-permissions", () => ({ useProjectPermissions: () => h.can }));
vi.mock("@/components/agency-projects/board", () => ({
  ProjectTasksBoard: ({ project }: { project: { name: string } }) => <div data-testid="board">{project.name}</div>,
}));

import { CampaignTasksTab } from "./tasks-tab";

beforeEach(() => {
  h.open.mockReset();
  h.board = undefined;
  h.can = { canRead: true, canCreate: true, canWrite: true, canDelete: true };
  h.openState = { isPending: false, isError: false, error: null };
});
afterEach(() => cleanup());

describe("CampaignTasksTab", () => {
  it("mostra o Kanban do quadro da campanha", () => {
    h.board = { id: "b1", name: "Verão Hype" };
    render(<CampaignTasksTab campaignId="c1" />);
    expect(screen.getByTestId("board")).toHaveTextContent("Verão Hype");
    expect(h.open).not.toHaveBeenCalled();
  });

  it("sem quadro e com permissão de escrita: cria na primeira abertura, uma vez só", async () => {
    h.board = null;
    const { rerender } = render(<CampaignTasksTab campaignId="c1" />);
    await waitFor(() => expect(h.open).toHaveBeenCalledTimes(1));
    rerender(<CampaignTasksTab campaignId="c1" />);
    expect(h.open).toHaveBeenCalledTimes(1);
  });

  it("sem quadro e só leitura: não cria, mostra o estado vazio", () => {
    h.board = null;
    h.can = { canRead: true, canCreate: false, canWrite: false, canDelete: false };
    render(<CampaignTasksTab campaignId="c1" />);
    expect(screen.getByText("Nenhuma tarefa ainda")).toBeInTheDocument();
    expect(h.open).not.toHaveBeenCalled();
  });

  it("falha ao abrir: mostra o erro com a opção de tentar de novo", () => {
    h.board = null;
    h.openState = { isPending: false, isError: true, error: new Error("falhou") };
    render(<CampaignTasksTab campaignId="c1" />);
    expect(screen.getByText("Não foi possível abrir as tarefas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

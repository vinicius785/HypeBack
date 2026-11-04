import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Notification } from "@/shared/services/notifications";

const h = vi.hoisted(() => ({
  notifications: [] as unknown[],
  navigate: vi.fn(),
  markAsRead: vi.fn(),
  selectWorkspace: vi.fn(),
  toast: { error: vi.fn(), info: vi.fn() },
  workspaces: [] as { id: string; name: string; status?: string }[],
  current: "w1" as string | undefined,
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({
    workspaces: h.workspaces,
    selectedWorkspace: h.workspaces.find((w) => w.id === h.current),
    selectWorkspace: h.selectWorkspace,
  }),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@/hooks/use-notifications-socket", () => ({ useNotificationsSocket: vi.fn() }));
vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: () => ({ data: h.notifications, isLoading: false }),
  useMarkNotificationAsRead: () => ({ mutate: h.markAsRead }),
  useMarkAllNotificationsAsRead: () => ({ mutate: vi.fn(), isPending: false }),
  useUnreadNotificationsCount: () => h.notifications.length,
}));

import { NotificationsDropdown } from "./notifications-dropdown";

const base: Notification = {
  id: "n-1",
  type: "team_chat_message",
  title: "Ana Souza",
  message: "Fechado, te mando hoje.",
  boldText: "Ana Souza",
  created_at: new Date().toISOString(),
  read_at: null,
  metadata: { conversation_id: "c-7", workspace_id: "w1", kind: "direct", sender_id: 2, sender_name: "Ana Souza", preview: "Fechado, te mando hoje." },
};

let opened: unknown[] = [];
const onOpen = (e: Event) => opened.push((e as CustomEvent).detail);

beforeEach(() => {
  opened = [];
  h.navigate.mockReset();
  h.markAsRead.mockReset();
  h.selectWorkspace.mockReset();
  h.toast.error.mockReset();
  h.toast.info.mockReset();
  h.workspaces = [
    { id: "w1", name: "Hype", status: "active" },
    { id: "w2", name: "Marca B", status: "active" },
  ];
  h.current = "w1";
  window.addEventListener("hype:open-team-chat", onOpen);
});
afterEach(() => window.removeEventListener("hype:open-team-chat", onOpen));

describe("sino — mensagem da equipe", () => {
  it("o item aparece com 'Abrir chat' e, ao clicar, abre a gaveta na conversa (sem navegar)", async () => {
    h.notifications = [base];
    const user = userEvent.setup();
    render(<NotificationsDropdown />);
    await user.click(screen.getByRole("button", { name: "Notificações" }));
    const item = screen.getByRole("button", { name: /Ana Souza.*Fechado, te mando hoje/s });
    expect(item).toHaveTextContent("Abrir chat");
    await user.click(item);
    expect(opened).toEqual([{ conversationId: "c-7", workspaceId: "w1" }]);
    expect(h.markAsRead).toHaveBeenCalledWith("n-1");
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.selectWorkspace).not.toHaveBeenCalled();
  });

  it("conversa de OUTRO workspace: troca de workspace primeiro e só então abre a conversa", async () => {
    h.notifications = [{ ...base, metadata: { ...base.metadata, workspace_id: "w2" } }];
    const order: string[] = [];
    h.selectWorkspace.mockImplementation(() => order.push("select"));
    const onOpenOrdered = () => order.push("open");
    window.addEventListener("hype:open-team-chat", onOpenOrdered);
    const user = userEvent.setup();
    render(<NotificationsDropdown />);
    await user.click(screen.getByRole("button", { name: "Notificações" }));
    await user.click(screen.getByRole("button", { name: /Ana Souza.*Fechado, te mando hoje/s }));
    window.removeEventListener("hype:open-team-chat", onOpenOrdered);
    expect(h.selectWorkspace).toHaveBeenCalledWith(expect.objectContaining({ id: "w2" }));
    expect(order).toEqual(["select", "open"]);
    expect(opened).toEqual([{ conversationId: "c-7", workspaceId: "w2" }]);
    // A notificação é da lista do workspace de origem (w1): ele vai junto, porque o header muda com a troca.
    expect(h.markAsRead).toHaveBeenCalledWith({ id: "n-1", workspaceId: "w1" });
    expect(h.toast.info).toHaveBeenCalledWith(expect.stringContaining("Marca B"));
  });

  it("workspace da conversa que a pessoa não tem mais: aviso claro, sem abrir nem marcar como lida", async () => {
    h.notifications = [{ ...base, metadata: { ...base.metadata, workspace_id: "w-fantasma" } }];
    const user = userEvent.setup();
    render(<NotificationsDropdown />);
    await user.click(screen.getByRole("button", { name: "Notificações" }));
    await user.click(screen.getByRole("button", { name: /Ana Souza.*Fechado, te mando hoje/s }));
    expect(h.toast.error).toHaveBeenCalledWith(expect.stringMatching(/não tem mais acesso/));
    expect(h.selectWorkspace).not.toHaveBeenCalled();
    expect(opened).toEqual([]);
    expect(h.markAsRead).not.toHaveBeenCalled();
  });

  it("workspace suspenso: avisa com a mensagem de estado e não troca", async () => {
    h.workspaces = [
      { id: "w1", name: "Hype", status: "active" },
      { id: "w2", name: "Marca B", status: "suspended" },
    ];
    h.notifications = [{ ...base, metadata: { ...base.metadata, workspace_id: "w2" } }];
    const user = userEvent.setup();
    render(<NotificationsDropdown />);
    await user.click(screen.getByRole("button", { name: "Notificações" }));
    await user.click(screen.getByRole("button", { name: /Ana Souza.*Fechado, te mando hoje/s }));
    expect(h.toast.error).toHaveBeenCalledWith(expect.stringMatching(/suspenso/));
    expect(h.selectWorkspace).not.toHaveBeenCalled();
    expect(opened).toEqual([]);
  });

  it("notificação sem workspace_id (antiga) abre no workspace atual, sem trocar", async () => {
    const { workspace_id: _ignored, ...metadata } = base.metadata;
    h.notifications = [{ ...base, metadata }];
    const user = userEvent.setup();
    render(<NotificationsDropdown />);
    await user.click(screen.getByRole("button", { name: "Notificações" }));
    await user.click(screen.getByRole("button", { name: /Ana Souza.*Fechado, te mando hoje/s }));
    expect(opened).toEqual([{ conversationId: "c-7" }]);
    expect(h.selectWorkspace).not.toHaveBeenCalled();
  });

  it("notificação de campanha segue navegando para a campanha", async () => {
    h.notifications = [
      {
        ...base,
        id: "n-2",
        type: "new_message",
        title: "Carla",
        message: "Oi",
        boldText: "Carla",
        metadata: { campaign_id: "camp-1", influencer_id: 9 },
      },
    ];
    const user = userEvent.setup();
    render(<NotificationsDropdown />);
    await user.click(screen.getByRole("button", { name: "Notificações" }));
    await user.click(screen.getByRole("button", { name: /Carla/ }));
    expect(opened).toEqual([]);
    expect(h.navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/campaigns/$campaignId", params: { campaignId: "camp-1" } }));
  });

  it("sem notificações o sino renderiza sem quebrar", async () => {
    h.notifications = [];
    render(<NotificationsDropdown />);
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Notificações" })).toBeInTheDocument();
  });
});

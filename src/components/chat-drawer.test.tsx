import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Notification } from "@/shared/services/notifications";
import { TeamChatUnavailableError } from "@/shared/services/team-chat";

const h = vi.hoisted(() => ({
  notifications: [] as unknown[],
  unread: vi.fn(),
  conversations: vi.fn(),
  messages: vi.fn(),
  navigate: vi.fn(),
  teamChat: vi.fn(),
  socketOpened: vi.fn(),
  socketClosed: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({ selectedWorkspace: { id: "ws-1", status: "active" } }),
  useWorkspaceIdForQueries: () => "ws-1",
}));
vi.mock("@/hooks/use-current-user", () => ({ useCurrentUser: () => ({ user: { id: 1 } }) }));
vi.mock("@/lib/workspace-state/query-client", () => ({ shouldRetryQuery: () => false }));
vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: () => ({ data: h.notifications }),
  useMarkChatNotificationsAsRead: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/use-campaign-chat", () => ({
  useInfluencerMessages: () => ({ data: [], isLoading: false }),
  useSendMessage: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/shared/services/campaign-users", () => ({ getCampaignUsers: vi.fn().mockResolvedValue([]) }));
vi.mock("@/hooks/use-team-chat", async () => {
  const { useEffect } = await import("react");
  return {
  useTeamChat: (options: { enabled?: boolean }) => {
    h.teamChat(options);
    // "Socket" aberto enquanto o hook está montado e ligado: mostra quem é o dono da conexão.
    const on = options?.enabled !== false;
    useEffect(() => {
      if (!on) return;
      h.socketOpened();
      return () => h.socketClosed();
    }, [on]);
    return {
      isConnected: true,
      blocked: null,
      sendMessage: vi.fn(),
      markRead: vi.fn(),
      focusConversation: vi.fn(),
      blurConversation: vi.fn(),
    };
  },
  };
});
vi.mock("@/shared/services/team-chat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/team-chat")>()),
  getTeamChatUnread: h.unread,
  listTeamConversations: h.conversations,
  listTeamChatMessages: h.messages,
}));

import { useState } from "react";

import { TeamChatProvider } from "./team-chat/team-chat-provider";
import { ChatDrawerButton, openChatDrawer, openTeamChat } from "./chat-drawer";

const campaign = "11111111-1111-4111-8111-111111111111";
const chatNotification = (id: string, read: boolean): Notification => ({
  id,
  type: "new_message",
  title: "Nova mensagem",
  message: "Oi!",
  boldText: "Carla Criadora",
  created_at: new Date().toISOString(),
  read_at: read ? new Date().toISOString() : null,
  metadata: { campaign_id: campaign, influencer_id: 50, campaign_title: "Verão" },
});

function renderButton() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return render(<ChatDrawerButton />, { wrapper });
}

const conversationFixture = {
  id: "c-1",
  kind: "direct",
  title: "Ana Souza",
  peer: { user_id: 2, name: "Ana Souza", avatar: null },
  last_message: null,
  unread: 3,
  peer_last_read_message_id: null,
};

beforeEach(() => {
  // jsdom não tem `scrollIntoView` (a conversa do criador rola até a última mensagem).
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubEnv("VITE_SERVER_URL", "http://api.test/api/backoffice");
  localStorage.setItem("token", "tok");
  h.notifications = [chatNotification("n1", false), chatNotification("n2", false), chatNotification("n3", true)];
  h.unread.mockReset().mockResolvedValue({ total: 3, by_conversation: { "c-1": 3 } });
  h.conversations.mockReset().mockResolvedValue([conversationFixture]);
  h.messages.mockReset().mockResolvedValue({ messages: [], hasMore: false });
  h.navigate.mockReset();
  h.teamChat.mockReset();
  h.socketOpened.mockReset();
  h.socketClosed.mockReset();
});

describe("ChatDrawerButton", () => {
  it("o contador do botão soma Criadores e Equipe", async () => {
    renderButton();
    expect(await screen.findByRole("button", { name: "Chat, 5 não lidas" })).toBeInTheDocument();
  });

  it("sem nada pendente o botão fica sem aviso", async () => {
    h.notifications = [];
    h.unread.mockResolvedValue({ total: 0, by_conversation: {} });
    renderButton();
    await waitFor(() => expect(h.unread).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
  });

  it("a gaveta tem as abas Criadores e Equipe, cada uma com a sua contagem; abre em Criadores", async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(await screen.findByRole("button", { name: /^Chat/ }));
    const tabs = within(screen.getByRole("tablist", { name: "Tipo de conversa" }));
    const creators = tabs.getByRole("tab", { name: /Criadores/ });
    const team = await tabs.findByRole("tab", { name: /Equipe/ });
    expect(creators).toHaveAttribute("aria-selected", "true");
    expect(creators).toHaveTextContent("2");
    expect(team).toHaveTextContent("3");
    expect(screen.getByText("5 não lidas")).toBeInTheDocument();
    // Aba Criadores segue igual: lista derivada das notificações.
    expect(screen.getByText("Carla Criadora")).toBeInTheDocument();
    await user.click(team);
    expect(screen.getByRole("tab", { name: /Equipe/ })).toHaveAttribute("aria-selected", "true");
    // Trocar de aba não perde o foco do teclado.
    expect(screen.getByRole("tab", { name: /Equipe/ })).toHaveFocus();
    expect(await screen.findByRole("list", { name: "Conversas da equipe" })).toBeInTheDocument();
  });

  it("só a equipe com mensagens pendentes abre direto na aba Equipe", async () => {
    h.notifications = [];
    const user = userEvent.setup();
    renderButton();
    await user.click(await screen.findByRole("button", { name: "Chat, 3 não lidas" }));
    expect(screen.getByRole("tab", { name: /Equipe/ })).toHaveAttribute("aria-selected", "true");
  });

  it("openTeamChat({ conversationId }) abre a gaveta na aba Equipe, já na conversa", async () => {
    renderButton();
    await screen.findByRole("button", { name: /^Chat/ });
    act(() => openTeamChat({ conversationId: "c-1" }));
    expect(screen.getByRole("tab", { name: /Equipe/ })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("log")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Mensagem" })).toBeInTheDocument();
  });

  it("openChatDrawer segue abrindo a conversa do criador na aba Criadores", async () => {
    renderButton();
    await screen.findByRole("button", { name: /^Chat/ });
    act(() => openChatDrawer({ campaignId: campaign, influencerId: "77", name: "Davi Criador", campaign: "Inverno" }));
    expect(screen.getByRole("tab", { name: /Criadores/ })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("button", { name: /Abrir campanha/ })).toBeInTheDocument();
    expect(screen.getAllByText("Davi Criador").length).toBeGreaterThan(0);
  });

  it("API antiga: o contador usa só os criadores, a aba Equipe diz 'Disponível em breve' e o socket não liga", async () => {
    h.unread.mockRejectedValue(new TeamChatUnavailableError());
    h.conversations.mockRejectedValue(new TeamChatUnavailableError());
    const user = userEvent.setup();
    renderButton();
    expect(await screen.findByRole("button", { name: "Chat, 2 não lidas" })).toBeInTheDocument();
    await waitFor(() => expect(h.teamChat).toHaveBeenLastCalledWith({ enabled: false }));
    await user.click(screen.getByRole("button", { name: /^Chat/ }));
    await user.click(screen.getByRole("tab", { name: /Equipe/ }));
    expect(await screen.findByText("Disponível em breve")).toBeInTheDocument();
    // A aba Criadores continua inteira.
    await user.click(screen.getByRole("tab", { name: /Criadores/ }));
    expect(screen.getByText("Carla Criadora")).toBeInTheDocument();
  });

  it("voltar a uma aba não reabre o pedido antigo, e a conversa pedida do criador continua na lista", async () => {
    const user = userEvent.setup();
    renderButton();
    await screen.findByRole("button", { name: /^Chat/ });
    act(() => openChatDrawer({ campaignId: campaign, influencerId: "77", name: "Davi Criador", campaign: "Inverno" }));
    expect(await screen.findByRole("button", { name: /Abrir campanha/ })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Equipe/ }));
    await user.click(screen.getByRole("tab", { name: /Criadores/ }));
    // Sem conversa aberta de novo, mas "Davi Criador" segue na lista (como antes das abas).
    expect(screen.queryByRole("button", { name: /Abrir campanha/ })).not.toBeInTheDocument();
    expect(screen.getByText("Davi Criador")).toBeInTheDocument();
  });

  it("Esc fecha a gaveta", async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(await screen.findByRole("button", { name: /^Chat/ }));
    expect(screen.getByRole("dialog", { name: "Mensagens" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), { timeout: 1500 });
  });

  it("setas movem entre as abas", async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(await screen.findByRole("button", { name: /^Chat/ }));
    screen.getByRole("tab", { name: /Criadores/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Equipe/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Equipe/ })).toHaveFocus();
  });
});

describe("abas acessíveis (tablist / tabpanel)", () => {
  it("cada aba aponta para o painel (aria-controls) e o painel é nomeado pela aba, sem virar caixa do layout", async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(await screen.findByRole("button", { name: /^Chat/ }));
    const creators = screen.getByRole("tab", { name: /Criadores/ });
    const team = await screen.findByRole("tab", { name: /Equipe/ });
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", creators.id);
    expect(creators).toHaveAttribute("aria-controls", panel.id);
    expect(team).not.toHaveAttribute("aria-controls");
    // `display: contents`: as colunas da gaveta continuam filhas diretas do flex (o CSS não muda).
    expect(panel.style.display).toBe("contents");
    expect(panel.parentElement).toHaveClass("ovp");

    await user.click(team);
    const teamPanel = screen.getByRole("tabpanel");
    expect(teamPanel).toHaveAttribute("aria-labelledby", team.id);
    // Cada aba monta a própria barra de abas: busca de novo depois da troca.
    expect(screen.getByRole("tab", { name: /Equipe/ })).toHaveAttribute("aria-controls", teamPanel.id);
    expect(screen.getByRole("tab", { name: /Criadores/ })).not.toHaveAttribute("aria-controls");
    expect(within(teamPanel).getByRole("list", { name: "Conversas da equipe" })).toBeInTheDocument();
  });
});

describe("socket da equipe no provedor do layout", () => {
  function Toggle() {
    const [shown, setShown] = useState(true);
    return (
      <>
        <button type="button" onClick={() => setShown((v) => !v)}>
          alternar topo
        </button>
        {shown && <ChatDrawerButton />}
      </>
    );
  }

  function renderWith(provider: boolean) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, provider ? createElement(TeamChatProvider, null, children) : children);
    return render(<Toggle />, { wrapper });
  }

  it("com provedor: o botão do topo sai e volta (troca de tela) e a conexão não cai", async () => {
    const user = userEvent.setup();
    renderWith(true);
    await screen.findByRole("button", { name: /^Chat/ });
    await waitFor(() => expect(h.socketOpened).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "alternar topo" }));
    expect(screen.queryByRole("button", { name: /^Chat/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "alternar topo" }));
    await screen.findByRole("button", { name: /^Chat/ });
    expect(h.socketOpened).toHaveBeenCalledTimes(1);
    expect(h.socketClosed).not.toHaveBeenCalled();
    // O botão não liga um segundo socket: só o provedor está habilitado.
    expect(h.teamChat).toHaveBeenCalledWith({ enabled: true });
    expect(h.teamChat.mock.calls.filter(([o]) => (o as { enabled: boolean }).enabled).length).toBeGreaterThan(0);
  });

  it("sem provedor: o botão liga o próprio socket (e o perde ao sair), como antes", async () => {
    const user = userEvent.setup();
    renderWith(false);
    await screen.findByRole("button", { name: /^Chat/ });
    await waitFor(() => expect(h.socketOpened).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "alternar topo" }));
    expect(h.socketClosed).toHaveBeenCalledTimes(1);
  });

  it("API antiga: o provedor desliga o socket assim que a API diz que não tem o chat", async () => {
    h.unread.mockRejectedValue(new TeamChatUnavailableError());
    renderWith(true);
    await waitFor(() => expect(h.teamChat).toHaveBeenLastCalledWith({ enabled: false }));
    await waitFor(() => expect(h.socketClosed).toHaveBeenCalledTimes(h.socketOpened.mock.calls.length));
  });
});

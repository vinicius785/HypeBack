import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamChatController } from "@/hooks/use-team-chat";
import { teamChatKeys } from "@/hooks/use-team-chat-queries";
import type { TeamChatConversation, TeamChatMessage } from "@/shared/services/team-chat";
import { TeamChatUnavailableError } from "@/shared/services/team-chat";

const h = vi.hoisted(() => ({
  conversations: vi.fn(),
  members: vi.fn(),
  messages: vi.fn(),
  openDirect: vi.fn(),
  upload: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  ws: { id: "ws-1" },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({ selectedWorkspace: { id: h.ws.id, status: "active" } }),
  useWorkspaceIdForQueries: () => h.ws.id,
}));
vi.mock("@/hooks/use-current-user", () => ({ useCurrentUser: () => ({ user: { id: 1 } }) }));
vi.mock("@/lib/workspace-state/query-client", () => ({ shouldRetryQuery: () => false }));
vi.mock("@/shared/services/team-chat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/team-chat")>()),
  listTeamConversations: h.conversations,
  listTeamChatMembers: h.members,
  listTeamChatMessages: h.messages,
  openDirectConversation: h.openDirect,
  uploadTeamChatAttachment: h.upload,
}));

import { TeamChatTab } from "./team-chat-tab";

const channel: TeamChatConversation = {
  id: "c-0",
  kind: "channel",
  title: "Equipe",
  peer: null,
  last_message: { body: "Bom dia, time", sender_id: 3, sender_name: "Beto Lima", created_at: new Date().toISOString(), has_attachments: false },
  unread: 0,
  peer_last_read_message_id: null,
};
const direct = (over: Partial<TeamChatConversation> = {}): TeamChatConversation => ({
  id: "c-1",
  kind: "direct",
  title: "Ana Souza",
  peer: { user_id: 2, name: "Ana Souza", avatar: null },
  last_message: { body: "Fechado!", sender_id: 2, sender_name: "Ana Souza", created_at: new Date().toISOString(), has_attachments: false },
  unread: 2,
  peer_last_read_message_id: null,
  ...over,
});

const message = (id: string, sender: number, body: string, over: Partial<TeamChatMessage> = {}): TeamChatMessage => ({
  id,
  conversation_id: "c-1",
  sender_id: sender,
  sender_name: sender === 1 ? "Eu" : "Ana Souza",
  sender_avatar: null,
  body,
  attachments: [],
  created_at: new Date().toISOString(),
  client_id: null,
  ...over,
});

function makeChat(over: Partial<TeamChatController> = {}): TeamChatController {
  return {
    isConnected: true,
    blocked: null,
    sendMessage: vi.fn().mockResolvedValue(null),
    markRead: vi.fn(),
    focusConversation: vi.fn(),
    blurConversation: vi.fn(),
    ...over,
  };
}

function renderTab(chat = makeChat(), props: Partial<Parameters<typeof TeamChatTab>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onThreadChange = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  const utils = render(<TeamChatTab top={<h2>Mensagens</h2>} request={null} chat={chat} onThreadChange={onThreadChange} {...props} />, { wrapper });
  return { ...utils, chat, client, onThreadChange };
}

beforeEach(() => {
  h.ws.id = "ws-1";
  vi.stubEnv("VITE_SERVER_URL", "http://api.test/api/backoffice");
  Object.values(h).forEach((v) => "mockReset" in v && v.mockReset());
  h.toast.error.mockReset();
  h.conversations.mockResolvedValue([channel, direct()]);
  h.members.mockResolvedValue([
    { user_id: 2, name: "Ana Souza", avatar: null, role: "admin" },
    { user_id: 3, name: "Beto Lima", avatar: null, role: "observador" },
  ]);
  h.messages.mockResolvedValue({ messages: [], hasMore: false });
});

async function openConversation(name: RegExp) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name }));
  return user;
}

describe("lista de conversas", () => {
  it("mostra o canal fixado no topo, as conversas 1 a 1, prévia e contador", async () => {
    renderTab();
    const list = await screen.findByRole("list", { name: "Conversas da equipe" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Equipe");
    expect(items[0]).toHaveTextContent("Canal geral");
    expect(items[0]).toHaveTextContent("Beto: Bom dia, time");
    expect(items[1]).toHaveTextContent("Ana Souza");
    expect(items[1]).toHaveTextContent("Fechado!");
    expect(within(items[1]).getByLabelText("2 não lidas")).toHaveTextContent("2");
  });

  it("filtra por não lidas e por busca", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByRole("list", { name: "Conversas da equipe" });
    await user.click(screen.getByRole("button", { name: "Não lidas" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Todas" }));
    await user.type(screen.getByRole("textbox", { name: "Buscar conversa" }), "zzz");
    expect(screen.getByText("Nada encontrado")).toBeInTheDocument();
  });

  it("carregando e erro (com tentar de novo)", async () => {
    h.conversations.mockRejectedValueOnce(new Error("falhou")).mockResolvedValueOnce([channel]);
    const user = userEvent.setup();
    renderTab();
    expect(screen.getByText("Carregando conversas...")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar as conversas");
    await user.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByRole("list", { name: "Conversas da equipe" })).toBeInTheDocument();
  });

  it("API antiga: 'Disponível em breve', sem erro", async () => {
    h.conversations.mockRejectedValue(new TeamChatUnavailableError());
    renderTab();
    expect(await screen.findByText("Disponível em breve")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nova conversa/ })).not.toBeInTheDocument();
  });
});

describe("conversa aberta", () => {
  it("abre ao clicar: histórico em ordem, avatar/nome no canal, foco no campo e marca como lida", async () => {
    h.messages.mockResolvedValue({
      messages: [message("11", 2, "segunda"), message("10", 2, "primeira")],
      hasMore: false,
    });
    const { chat, onThreadChange } = renderTab();
    await openConversation(/Ana Souza/);
    const log = await screen.findByRole("log");
    await waitFor(() => expect(within(log).getByText("segunda")).toBeInTheDocument());
    const texts = within(log).getAllByText(/primeira|segunda/).map((n) => n.textContent);
    expect(texts).toEqual(["primeira", "segunda"]);
    expect(screen.getByRole("textbox", { name: "Mensagem" })).toHaveFocus();
    expect(chat.focusConversation).toHaveBeenCalledWith("c-1");
    expect(onThreadChange).toHaveBeenLastCalledWith(true);
    await waitFor(() => expect(chat.markRead).toHaveBeenCalledWith("c-1", "11"));
  });

  it("no canal mostra o nome de quem escreveu", async () => {
    h.messages.mockResolvedValue({
      messages: [message("5", 3, "bom dia", { conversation_id: "c-0", sender_name: "Beto Lima" })],
      hasMore: false,
    });
    renderTab();
    await openConversation(/Equipe/);
    const log = await screen.findByRole("log");
    expect(await within(log).findByText("Beto Lima")).toBeInTheDocument();
  });

  it("estado vazio e carregar anteriores", async () => {
    h.messages
      .mockResolvedValueOnce({ messages: [message("30", 2, "recente")], hasMore: true })
      .mockResolvedValueOnce({ messages: [message("20", 2, "antiga")], hasMore: false });
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole("button", { name: /Ana Souza/ }));
    await screen.findByText("recente");
    await user.click(screen.getByRole("button", { name: "Carregar mensagens anteriores" }));
    await screen.findByText("antiga");
    expect(h.messages).toHaveBeenLastCalledWith("c-1", { before: "30", limit: 30 });
    expect(screen.queryByRole("button", { name: "Carregar mensagens anteriores" })).not.toBeInTheDocument();
  });

  it("sem mensagens: estado vazio", async () => {
    renderTab();
    await openConversation(/Ana Souza/);
    expect(await screen.findByText("Sem mensagens ainda")).toBeInTheDocument();
  });

  it("separa as mensagens por dia", async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    h.messages.mockResolvedValue({
      messages: [message("2", 2, "hoje"), message("1", 2, "ontem", { created_at: yesterday })],
      hasMore: false,
    });
    renderTab();
    await openConversation(/Ana Souza/);
    const log = await screen.findByRole("log");
    await within(log).findByText("hoje");
    expect(within(log).getByText("Ontem")).toBeInTheDocument();
    expect(within(log).getByText("Hoje")).toBeInTheDocument();
  });
});

describe("envio", () => {
  it("Enter envia, limpa o campo e mostra o balão enquanto confirma", async () => {
    let resolve!: (m: TeamChatMessage) => void;
    const chat = makeChat({ sendMessage: vi.fn().mockReturnValue(new Promise((r) => (resolve = r))) });
    renderTab(chat);
    const user = await openConversation(/Ana Souza/);
    const box = await screen.findByRole("textbox", { name: "Mensagem" });
    await user.type(box, "olá, tudo bem?{Enter}");
    expect(chat.sendMessage).toHaveBeenCalledWith("c-1", {
      body: "olá, tudo bem?",
      attachments: [],
      clientId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
    });
    expect(box).toHaveValue("");
    expect(await screen.findByText("Enviando...")).toBeInTheDocument();
    expect(screen.getByText("olá, tudo bem?")).toBeInTheDocument();
    resolve(message("99", 1, "olá, tudo bem?"));
    await waitFor(() => expect(screen.queryByText("Enviando...")).not.toBeInTheDocument());
  });

  it("Shift+Enter quebra a linha e não envia; texto vazio não envia", async () => {
    const { chat } = renderTab();
    const user = await openConversation(/Ana Souza/);
    const box = await screen.findByRole("textbox", { name: "Mensagem" });
    await user.type(box, "{Enter}");
    await user.type(box, "linha 1{Shift>}{Enter}{/Shift}linha 2");
    expect(chat.sendMessage).not.toHaveBeenCalled();
    expect(box).toHaveValue("linha 1\nlinha 2");
    await user.type(box, "{Enter}");
    expect(chat.sendMessage).toHaveBeenCalledWith("c-1", expect.objectContaining({ body: "linha 1\nlinha 2" }));
  });

  it("falha mostra 'Tentar de novo' e reenvia com o mesmo client_id", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("Sem conexão"))
      .mockResolvedValueOnce(message("7", 1, "oi"));
    renderTab(makeChat({ sendMessage }));
    const user = await openConversation(/Ana Souza/);
    await user.type(await screen.findByRole("textbox", { name: "Mensagem" }), "oi{Enter}");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sem conexão");
    await user.click(within(alert).getByRole("button", { name: /Tentar de novo/ }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    expect(sendMessage.mock.calls[1][1].clientId).toBe(sendMessage.mock.calls[0][1].clientId);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("anexo: sobe ao escolher, aparece no campo e vai junto na mensagem", async () => {
    const attachment = { url: "/uploads/team-chat/c-1/f.pdf", name: "contrato.pdf", mime_type: "application/pdf", size: 2048 };
    h.upload.mockResolvedValue(attachment);
    const { chat } = renderTab();
    const user = await openConversation(/Ana Souza/);
    await screen.findByRole("textbox", { name: "Mensagem" });
    const file = new File(["%PDF"], "contrato.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("team-chat-file"), file);
    expect(h.upload).toHaveBeenCalledWith("c-1", file);
    const drafts = await screen.findByRole("list", { name: "Anexos da mensagem" });
    expect(within(drafts).getByText("contrato.pdf")).toBeInTheDocument();
    await waitFor(() => expect(within(drafts).getByText("4 B")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    expect(chat.sendMessage).toHaveBeenCalledWith("c-1", { body: "", attachments: [attachment], clientId: expect.any(String) });
    expect(screen.queryByRole("list", { name: "Anexos da mensagem" })).not.toBeInTheDocument();
  });

  it("anexo grande demais é recusado antes de subir; remover tira da mensagem", async () => {
    h.upload.mockResolvedValue({ url: "/u/a.png", name: "a.png", mime_type: "image/png", size: 10 });
    renderTab();
    const user = await openConversation(/Ana Souza/);
    await screen.findByRole("textbox", { name: "Mensagem" });
    const big = new File(["x"], "enorme.mov", { type: "video/quicktime" });
    Object.defineProperty(big, "size", { value: 30 * 1024 * 1024 });
    await user.upload(screen.getByTestId("team-chat-file"), big);
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.toast.error).toHaveBeenCalledWith(expect.stringContaining("enorme.mov"));

    await user.upload(screen.getByTestId("team-chat-file"), new File(["x"], "a.png", { type: "image/png" }));
    await user.click(await screen.findByRole("button", { name: "Remover a.png" }));
    expect(screen.queryByRole("list", { name: "Anexos da mensagem" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar mensagem" })).toBeDisabled();
  });

  it("balões mostram imagem com pré-visualização e arquivo com nome e tamanho", async () => {
    h.messages.mockResolvedValue({
      messages: [
        message("2", 2, "", {
          attachments: [
            { url: "https://cdn.test/foto.png", name: "foto.png", mime_type: "image/png", size: 1000 },
            { url: "https://cdn.test/plano.pdf", name: "plano.pdf", mime_type: "application/pdf", size: 1536000 },
          ],
        }),
      ],
      hasMore: false,
    });
    renderTab();
    await openConversation(/Ana Souza/);
    const img = await screen.findByAltText("foto.png");
    expect(img).toHaveAttribute("src", "https://cdn.test/foto.png");
    expect(img.closest("a")).toHaveAttribute("target", "_blank");
    const file = screen.getByRole("link", { name: "Abrir arquivo plano.pdf" });
    expect(file).toHaveTextContent("1,5 MB");
    expect(file).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("Visto", () => {
  const mine = (id: string) => message(id, 1, `minha ${id}`);

  it("aparece só abaixo da última mensagem própria quando a outra pessoa já leu", async () => {
    h.conversations.mockResolvedValue([channel, direct({ unread: 0, peer_last_read_message_id: "12" })]);
    h.messages.mockResolvedValue({ messages: [mine("12"), message("11", 2, "dela"), mine("10")], hasMore: false });
    renderTab();
    await openConversation(/Ana Souza/);
    await screen.findByText("minha 12");
    expect(screen.getAllByText("Visto")).toHaveLength(1);
    const own12 = screen.getByText("minha 12").closest(".cm-w") as HTMLElement;
    expect(within(own12).getByText("Visto")).toBeInTheDocument();
    const own10 = screen.getByText("minha 10").closest(".cm-w") as HTMLElement;
    expect(within(own10).queryByText("Visto")).not.toBeInTheDocument();
  });

  it("não aparece se a última mensagem própria ainda não foi lida", async () => {
    h.conversations.mockResolvedValue([channel, direct({ unread: 0, peer_last_read_message_id: "10" })]);
    h.messages.mockResolvedValue({ messages: [mine("12"), mine("10")], hasMore: false });
    renderTab();
    await openConversation(/Ana Souza/);
    await screen.findByText("minha 12");
    expect(screen.queryByText("Visto")).not.toBeInTheDocument();
  });

  it("não existe no canal", async () => {
    h.messages.mockResolvedValue({ messages: [message("5", 1, "no canal", { conversation_id: "c-0" })], hasMore: false });
    renderTab();
    await openConversation(/^Equipe/);
    await screen.findByText("no canal");
    expect(screen.queryByText("Visto")).not.toBeInTheDocument();
  });
});

describe("estado do workspace", () => {
  const archived = { code: "WORKSPACE_ARCHIVED", message: "Este workspace está arquivado e permite apenas consulta." } as const;

  it("arquivado: campo e anexo desabilitados com a mensagem de estado, sem marcar como lida", async () => {
    const chat = makeChat({ blocked: archived });
    renderTab(chat);
    await screen.findByRole("list", { name: "Conversas da equipe" });
    expect(screen.getByRole("button", { name: /Nova conversa/ })).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Ana Souza/ }));
    expect(await screen.findByRole("textbox", { name: "Mensagem" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("arquivado");
    expect(screen.getByRole("button", { name: "Anexar arquivo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar mensagem" })).toBeDisabled();
    expect(chat.markRead).not.toHaveBeenCalled();
  });
});

describe("nova conversa e pedidos de abertura", () => {
  it("escolhe uma pessoa, abre a conversa 1 a 1 e entra nela", async () => {
    h.conversations.mockResolvedValue([channel]);
    h.openDirect.mockResolvedValue(direct({ id: "c-9", title: "Beto Lima", peer: { user_id: 3, name: "Beto Lima", avatar: null }, unread: 0, last_message: null }));
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole("button", { name: /Nova conversa/ }));
    const people = await screen.findByRole("list", { name: "Pessoas do workspace" });
    expect(within(people).getByText("Observador")).toBeInTheDocument();
    await user.click(within(people).getByRole("button", { name: /Beto Lima/ }));
    expect(h.openDirect).toHaveBeenCalledWith(3);
    expect(await screen.findByRole("log")).toBeInTheDocument();
    expect(screen.getAllByText("Beto Lima").length).toBeGreaterThan(0);
  });

  it("pedido por conversa (clique no sino) abre direto nela", async () => {
    renderTab(makeChat(), { request: { conversationId: "c-1" } });
    expect(await screen.findByRole("log")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Mensagem" })).toBeInTheDocument();
  });

  it("pedido por pessoa usa a conversa 1 a 1 que já existe", async () => {
    renderTab(makeChat(), { request: { userId: 2 } });
    expect(await screen.findByRole("log")).toBeInTheDocument();
    expect(h.openDirect).not.toHaveBeenCalled();
  });

  it("conversa pedida que não existe volta para a lista", async () => {
    renderTab(makeChat(), { request: { conversationId: "nao-existe" } });
    await screen.findByRole("list", { name: "Conversas da equipe" });
    await waitFor(() => expect(screen.getByText("Selecione uma conversa")).toBeInTheDocument());
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
  });
});

describe("client_id: a mensagem do servidor substitui o balão otimista", () => {
  const messagesCache = (client: QueryClient, list: TeamChatMessage[]) =>
    client.setQueryData(teamChatKeys.messages("c-1", "ws-1"), {
      pages: [{ messages: [...list].reverse(), hasMore: false }],
      pageParams: [undefined],
    });

  it("envio que falhou só na resposta: quando a mensagem chega com o mesmo client_id, o balão com erro some e o texto aparece uma vez", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("O envio demorou demais."));
    const { client } = renderTab(makeChat({ sendMessage }));
    const user = await openConversation(/Ana Souza/);
    await user.type(await screen.findByRole("textbox", { name: "Mensagem" }), "oi time{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("O envio demorou demais.");
    const clientId = sendMessage.mock.calls[0][1].clientId as string;
    act(() => {
      messagesCache(client, [message("srv-1", 1, "oi time", { client_id: clientId })]);
    });
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getAllByText("oi time")).toHaveLength(1);
    expect(screen.queryByText("Enviando...")).not.toBeInTheDocument();
  });

  it("enviando: a mensagem do servidor com o mesmo client_id troca o balão na hora (sem esperar o ack)", async () => {
    const sendMessage = vi.fn().mockReturnValue(new Promise(() => {}));
    const { client } = renderTab(makeChat({ sendMessage }));
    const user = await openConversation(/Ana Souza/);
    await user.type(await screen.findByRole("textbox", { name: "Mensagem" }), "rápido{Enter}");
    expect(await screen.findByText("Enviando...")).toBeInTheDocument();
    const clientId = sendMessage.mock.calls[0][1].clientId as string;
    act(() => {
      messagesCache(client, [message("srv-2", 1, "rápido", { client_id: clientId })]);
    });
    await waitFor(() => expect(screen.queryByText("Enviando...")).not.toBeInTheDocument());
    expect(screen.getAllByText("rápido")).toHaveLength(1);
  });

  it("cada envio ganha o próprio client_id", async () => {
    const sendMessage = vi.fn().mockReturnValue(new Promise(() => {}));
    renderTab(makeChat({ sendMessage }));
    const user = await openConversation(/Ana Souza/);
    const box = await screen.findByRole("textbox", { name: "Mensagem" });
    await user.type(box, "um{Enter}");
    await user.type(box, "dois{Enter}");
    expect(sendMessage.mock.calls[0][1].clientId).not.toBe(sendMessage.mock.calls[1][1].clientId);
  });
});

describe("rolagem quando a imagem carrega depois", () => {
  const withImage = () =>
    h.messages.mockResolvedValue({
      messages: [
        message("2", 2, "", { attachments: [{ url: "https://cdn.test/foto.png", name: "foto.png", mime_type: "image/png", size: 1000 }] }),
      ],
      hasMore: false,
    });

  function fakeScroll(log: HTMLElement) {
    let top = 0;
    Object.defineProperty(log, "scrollTop", { configurable: true, get: () => top, set: (v: number) => (top = v) });
    Object.defineProperty(log, "scrollHeight", { configurable: true, value: 900 });
    Object.defineProperty(log, "clientHeight", { configurable: true, value: 300 });
    return { top: () => top, set: (v: number) => (top = v) };
  }

  it("quem estava no fim continua no fim quando a imagem termina de carregar", async () => {
    withImage();
    renderTab();
    await openConversation(/Ana Souza/);
    const img = await screen.findByAltText("foto.png");
    const scroll = fakeScroll(screen.getByRole("log"));
    fireEvent.load(img);
    expect(scroll.top()).toBe(900);
  });

  it("quem subiu para ler o histórico não é puxado para baixo", async () => {
    withImage();
    renderTab();
    await openConversation(/Ana Souza/);
    const img = await screen.findByAltText("foto.png");
    const log = screen.getByRole("log");
    const scroll = fakeScroll(log);
    scroll.set(0);
    fireEvent.scroll(log);
    fireEvent.load(img);
    expect(scroll.top()).toBe(0);
  });

  it("imagem que falha também reajusta (o texto alternativo muda a altura)", async () => {
    withImage();
    renderTab();
    await openConversation(/Ana Souza/);
    const img = await screen.findByAltText("foto.png");
    const scroll = fakeScroll(screen.getByRole("log"));
    fireEvent.error(img);
    expect(scroll.top()).toBe(900);
  });
});

describe("acessibilidade do histórico (role=log)", () => {
  it("não anuncia o histórico inteiro na primeira carga: aria-live só liga depois", async () => {
    h.messages.mockResolvedValue({ messages: [message("2", 2, "segunda"), message("1", 2, "primeira")], hasMore: false });
    renderTab();
    await openConversation(/Ana Souza/);
    const log = await screen.findByRole("log");
    expect(log).toHaveAttribute("aria-live", "off");
    await screen.findByText("segunda");
    expect(log).toHaveAttribute("aria-live", "off");
    await waitFor(() => expect(log).toHaveAttribute("aria-live", "polite"));
    expect(log).toHaveAttribute("aria-relevant", "additions");
  });

  it("carregar mensagens anteriores não é anunciado; depois volta a anunciar o que chega", async () => {
    h.messages
      .mockResolvedValueOnce({ messages: [message("30", 2, "recente")], hasMore: true })
      .mockResolvedValueOnce({ messages: [message("20", 2, "antiga")], hasMore: false });
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole("button", { name: /Ana Souza/ }));
    await screen.findByText("recente");
    const log = screen.getByRole("log");
    await waitFor(() => expect(log).toHaveAttribute("aria-live", "polite"));
    await user.click(screen.getByRole("button", { name: "Carregar mensagens anteriores" }));
    expect(log).toHaveAttribute("aria-live", "off");
    await screen.findByText("antiga");
    expect(log).toHaveAttribute("aria-live", "off");
    await waitFor(() => expect(log).toHaveAttribute("aria-live", "polite"));
  });
});

describe("pedido de outro workspace (clique no sino)", () => {
  it("espera o workspace atual ser o do pedido antes de abrir a conversa", async () => {
    h.ws.id = "ws-1";
    const request = { conversationId: "c-1", workspaceId: "ws-2" };
    const { rerender } = renderTab(makeChat(), { request });
    await screen.findByRole("list", { name: "Conversas da equipe" });
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.getByText("Selecione uma conversa")).toBeInTheDocument();

    // Troca de workspace concluída: agora a conversa abre (a lista do novo workspace é a que a procura).
    h.ws.id = "ws-2";
    rerender(<TeamChatTab top={<h2>Mensagens</h2>} request={request} chat={makeChat()} onThreadChange={vi.fn()} />);
    expect(await screen.findByRole("log")).toBeInTheDocument();
  });

  it("pedido do workspace atual abre direto", async () => {
    renderTab(makeChat(), { request: { conversationId: "c-1", workspaceId: "ws-1" } });
    expect(await screen.findByRole("log")).toBeInTheDocument();
  });
});

describe("handshake recusado", () => {
  const forbidden = { code: "TEAM_CHAT_FORBIDDEN", message: "Você não faz parte deste workspace, então não pode usar o chat da equipe dele." } as const;

  it("mostra a mensagem clara na lista e na conversa, sem 'reconectando...'", async () => {
    const chat = makeChat({ isConnected: false, blocked: forbidden });
    renderTab(chat);
    expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent("não faz parte deste workspace");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Ana Souza/ }));
    expect(await screen.findByRole("textbox", { name: "Mensagem" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("não faz parte deste workspace");
    expect(screen.queryByText(/reconectando/)).not.toBeInTheDocument();
  });

  it("sem bloqueio e desconectado, mostra 'reconectando...'", async () => {
    renderTab(makeChat({ isConnected: false }));
    await openConversation(/Ana Souza/);
    expect(await screen.findByText(/reconectando/)).toBeInTheDocument();
  });
});

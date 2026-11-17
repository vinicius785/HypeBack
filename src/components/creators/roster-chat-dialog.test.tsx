import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ list: vi.fn(), send: vi.fn(), remove: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast: api.toast }));
vi.mock("@/shared/services/agency-roster", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/agency-roster")>()),
  listRosterChat: api.list,
  sendRosterChat: api.send,
  deleteRosterChat: api.remove,
}));
vi.mock("@/hooks/use-workspace-query-key", () => ({ useWorkspaceQueryKey: () => "ws", withWorkspaceKey: (key: unknown[]) => key }));
vi.mock("@/hooks/use-agency-brands", () => ({ useIsAgencyWorkspace: () => true }));
vi.mock("@/hooks/use-current-user", () => ({ useCurrentUser: () => ({ user: { id: 1 } }) }));
vi.mock("@/styles/agency-roster.css", () => ({}));

import type { RosterChatMessage, RosterMember } from "@/shared/services/agency-roster";

import { RosterChatDialog } from "./roster-chat-dialog";

const member = { id: "r1", status: "active", creator: { id: 7, name: "Bia Alves", photo: null, username: "bia", followers_total: 0, networks: [] } } as unknown as RosterMember;
const message = (id: string, text: string, authorId: string, name: string, extra: Partial<RosterChatMessage> = {}): RosterChatMessage => ({
  id,
  text,
  created_at: "2026-11-16T12:00:00.000Z",
  image_url: null,
  video_url: null,
  video_thumbnail_url: null,
  attachments: null,
  author: { id: authorId, name, username: name.toLowerCase(), avatar_url: null },
  ...extra,
});

function renderChat(canWrite = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RosterChatDialog member={member} canWrite={canWrite} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollTo = vi.fn();
  // A API devolve da mais nova para a mais antiga.
  api.list.mockResolvedValue([message("m2", "Pode ser amanhã?", "7", "Bia Alves"), message("m1", "Oi Bia, tudo certo?", "1", "Agência", { attachments: ["/uploads/x.pdf"] })]);
  api.send.mockResolvedValue(message("m3", "ok", "1", "Agência"));
  api.remove.mockResolvedValue(undefined);
});

describe("Conversa com o criador", () => {
  it("lê as mensagens da mais antiga para a mais nova, com PDF e quem escreveu", async () => {
    renderChat();
    const feed = await screen.findByRole("list", { name: "Mensagens" });
    const texts = within(feed).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);
    expect(texts).toEqual(["Oi Bia, tudo certo?", "Pode ser amanhã?"]);
    expect(within(feed).getByRole("link", { name: /Documento 1/ })).toHaveAttribute("href", expect.stringContaining("x.pdf"));
    expect(within(feed).getByText(/^Você ·/)).toBeInTheDocument();
    expect(within(feed).getByText(/^Bia Alves ·/)).toBeInTheDocument();
  });

  it("envia texto e só apaga a própria mensagem", async () => {
    const user = userEvent.setup();
    renderChat();
    await screen.findByRole("list", { name: "Mensagens" });
    await user.type(screen.getByLabelText("Mensagem para Bia Alves"), "Combinado!");
    await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    await waitFor(() => expect(api.send).toHaveBeenCalledWith("r1", { text: "Combinado!" }));
    expect(screen.getAllByRole("button", { name: "Apagar mensagem" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Apagar mensagem" }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("r1", "m1"));
  });

  it("quem só lê não tem campo de envio", async () => {
    renderChat(false);
    await screen.findByRole("list", { name: "Mensagens" });
    expect(screen.queryByLabelText("Mensagem para Bia Alves")).toBeNull();
    expect(screen.getByText("Só quem gerencia o elenco envia mensagens.")).toBeInTheDocument();
  });
});

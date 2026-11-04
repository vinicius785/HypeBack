import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  messages: [] as unknown[],
  mutateAsync: vi.fn(),
  markRead: vi.fn(),
}));

vi.mock("@/hooks/use-current-user", () => ({ useCurrentUser: () => ({ user: { id: 1 } }) }));
vi.mock("@/hooks/use-campaign-chat", () => ({
  useInfluencerMessages: () => ({ data: h.messages, isLoading: false }),
  useSendMessage: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/use-notifications", () => ({ useMarkChatNotificationsAsRead: () => ({ mutate: h.markRead }) }));
vi.mock("@/shared/services/chat", () => ({ uploadChatAttachment: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CreatorThread } from "./creator-thread";

const conv = { id: "c1", campaignId: "9", influencerId: "5", name: "Bia Lima", avatar: "", campaign: "Verão" } as never;
const msg = (id: string, sender: number, iso: string, extra: Record<string, unknown> = {}) => ({
  id,
  sender_id: String(sender),
  sender_name: sender === 1 ? "Gestor" : "Bia Lima",
  sender_avatar: null,
  message: `m${id}`,
  attachments: [],
  read_at: null,
  created_at: iso,
  ...extra,
});

const renderThread = () => render(<CreatorThread conv={conv} onBack={vi.fn()} onOpenCampaign={vi.fn()} />);

describe("CreatorThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.messages = [];
  });

  it("estado da própria mensagem vem de read_at: lida ou enviada", () => {
    h.messages = [
      msg("1", 1, "2026-11-03T12:00:00Z", { read_at: "2026-11-03T12:05:00Z" }),
      msg("2", 1, "2026-11-03T13:00:00Z"),
    ];
    renderThread();
    expect(screen.getByRole("img", { name: "Lida" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Enviada" })).toBeInTheDocument();
  });

  it("divisor 'Novas mensagens' antes da primeira não lida do criador e hora de cada uma", () => {
    h.messages = [msg("1", 1, "2026-11-03T12:00:00Z"), msg("2", 5, "2026-11-03T15:00:00Z"), msg("3", 5, "2026-11-03T15:01:00Z")];
    renderThread();
    expect(screen.getByText("Novas mensagens")).toBeInTheDocument();
    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.getByText("12:01")).toBeInTheDocument();
  });

  it("envia com Enter, mostra 'Enviando...' e usa o texto digitado", async () => {
    let finish: (v: unknown) => void = () => undefined;
    h.mutateAsync.mockReturnValue(new Promise((r) => (finish = r)));
    renderThread();
    const box = screen.getByLabelText("Mensagem");
    fireEvent.change(box, { target: { value: "olá!" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(h.mutateAsync).toHaveBeenCalledWith({ message: "olá!", attachments: [] });
    expect(await screen.findByText("Enviando...")).toBeInTheDocument();
    finish({ id: "x" });
    await waitFor(() => expect(screen.queryByText("Enviando...")).not.toBeInTheDocument());
  });

  it("Shift + Enter não envia", () => {
    renderThread();
    const box = screen.getByLabelText("Mensagem");
    fireEvent.change(box, { target: { value: "linha" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("falha no envio mostra o motivo e tenta de novo", async () => {
    h.mutateAsync.mockRejectedValueOnce({ message: "Mensagem é obrigatória" }).mockResolvedValueOnce({ id: "z" });
    renderThread();
    const box = screen.getByLabelText("Mensagem");
    fireEvent.change(box, { target: { value: "oi" } });
    fireEvent.keyDown(box, { key: "Enter" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Mensagem é obrigatória");
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(2));
  });
});

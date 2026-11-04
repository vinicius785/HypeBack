import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import type { ChatLine } from "./flow";
import { MessageFlow } from "./message-flow";

const line = (id: string, who: "me" | "ana", iso: string, extra: Partial<ChatLine> = {}): ChatLine => ({
  id,
  mine: who === "me",
  senderKey: who,
  senderName: who === "me" ? "Você" : "Ana Souza",
  body: `texto ${id}`,
  attachments: [],
  createdAt: iso,
  ...extra,
});
const handlers = () => ({ onRetry: vi.fn(), onDiscard: vi.fn() });

describe("MessageFlow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mostra o nome e o avatar só na primeira do grupo e a hora em todas, em 24 h de São Paulo", () => {
    render(
      <MessageFlow
        lines={[line("1", "ana", "2026-11-03T17:30:00Z"), line("2", "ana", "2026-11-03T17:31:00Z"), line("3", "me", "2026-11-03T21:05:00Z")]}
        handlers={handlers()}
      />,
    );
    expect(screen.getAllByText("Ana Souza")).toHaveLength(1);
    expect(screen.getByText("14:30")).toBeInTheDocument();
    expect(screen.getByText("14:31")).toBeInTheDocument();
    expect(screen.getByText("18:05")).toBeInTheDocument();
  });

  it("a hora tem tooltip com a data completa", () => {
    render(<MessageFlow lines={[line("1", "ana", "2026-11-03T17:30:00Z")]} handlers={handlers()} />);
    expect(screen.getByText("14:30")).toHaveAttribute("title", "3 de novembro de 2026 às 14:30");
  });

  it("estados reais: enviada, lida e enviando", () => {
    render(
      <MessageFlow
        lines={[
          line("1", "me", "2026-11-03T12:00:00Z", { status: "sent" }),
          line("2", "me", "2026-11-03T12:10:00Z", { status: "read" }),
          line("3", "me", "2026-11-03T12:20:00Z", { status: "sending", localId: "p3" }),
        ]}
        handlers={handlers()}
      />,
    );
    expect(screen.getByRole("img", { name: "Enviada" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Lida" })).toBeInTheDocument();
    expect(screen.getByText("Enviando...")).toBeInTheDocument();
  });

  it("falha mostra o motivo e oferece tentar de novo e descartar", () => {
    const h = handlers();
    render(
      <MessageFlow
        lines={[line("p1", "me", "2026-11-03T12:00:00Z", { status: "failed", localId: "p1", error: "Sem conexão." })]}
        handlers={h}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Sem conexão.");
    fireEvent.click(within(alert).getByRole("button", { name: /Tentar de novo/ }));
    fireEvent.click(within(alert).getByRole("button", { name: "Descartar" }));
    expect(h.onRetry).toHaveBeenCalledTimes(1);
    expect(h.onDiscard).toHaveBeenCalledTimes(1);
  });

  it("links do texto abrem em outra aba, sem opener", () => {
    render(<MessageFlow lines={[line("1", "ana", "2026-11-03T12:00:00Z", { body: "veja https://hype.com/x." })]} handlers={handlers()} />);
    const a = screen.getByRole("link", { name: "https://hype.com/x" });
    expect(a).toHaveAttribute("target", "_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("menu da mensagem copia o texto", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<MessageFlow lines={[line("1", "ana", "2026-11-03T12:00:00Z", { body: "copie isto" })]} handlers={handlers()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ações da mensagem" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Copiar texto" }));
    expect(writeText).toHaveBeenCalledWith("copie isto");
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Mensagem copiada"));
  });

  it("separador de data e divisor de novas mensagens", () => {
    render(
      <MessageFlow
        lines={[line("1", "me", "2026-01-10T12:00:00Z"), line("2", "ana", "2026-01-11T12:00:00Z")]}
        unreadFromId="2"
        handlers={handlers()}
      />,
    );
    expect(screen.getByText("10 de janeiro de 2026")).toBeInTheDocument();
    expect(screen.getByText("Novas mensagens")).toBeInTheDocument();
  });
});

describe("MessageFlow: animação de entrada", () => {
  it("o histórico não anima; mensagem recebida depois entra animada; a própria confirmada pelo servidor não repete", () => {
    const base = [line("1", "ana", "2026-11-03T12:00:00Z"), line("2", "me", "2026-11-03T12:01:00Z", { status: "sent" })];
    const { container, rerender } = render(<MessageFlow lines={base} handlers={{}} />);
    expect(container.querySelectorAll(".cx-in")).toHaveLength(0);
    rerender(<MessageFlow lines={[...base, line("3", "ana", "2026-11-03T12:05:00Z")]} handlers={{}} />);
    expect(container.querySelectorAll(".cx-in")).toHaveLength(1);
    // Envio local anima ao entrar; quando vira mensagem do servidor (outro id), não anima de novo.
    const withLocal = [...base, line("p1", "me", "2026-11-03T12:06:00Z", { status: "sending", localId: "p1" })];
    rerender(<MessageFlow lines={withLocal} handlers={{}} />);
    expect(container.querySelectorAll(".cx-in.me")).toHaveLength(1);
    rerender(<MessageFlow lines={[...base, line("srv1", "me", "2026-11-03T12:06:00Z", { status: "sent" })]} handlers={{}} />);
    expect(container.querySelectorAll(".cx-in.me")).toHaveLength(0);
  });
});

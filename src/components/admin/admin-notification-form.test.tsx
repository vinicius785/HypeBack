/**
 * Envio de notificação pelo admin (push, e-mail e WhatsApp para os criadores).
 *
 * O que não pode acontecer:
 * - "Enviar agora" disparar na hora, sem o admin ver e confirmar o alcance;
 * - reenviar o mesmo conteúdo (após erro de rede) com outra Idempotency-Key — o
 *   servidor não reconheceria o reenvio e todos receberiam duas vezes;
 * - o agendamento, que dá para cancelar, ficar atrás de confirmação.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const createMutate = vi.fn();
const estimateMutate = vi.fn();
const onClose = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock("@/hooks/use-admin-notifications", () => ({
  useCreateAdminNotification: () => ({
    mutateAsync: createMutate,
    isPending: false,
  }),
  useEstimateAdminAudience: () => ({ mutateAsync: estimateMutate }),
  useAdminCampaignLookup: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/use-niches", () => ({
  useNiches: () => ({ data: [] }),
}));

import { AdminNotificationForm } from "./admin-notification-form";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONFIRM_TEXT = /Um envio imediato não pode ser desfeito/;

type User = ReturnType<typeof userEvent.setup>;

/** Escreve a mensagem e avança até o último passo ("Envio"). */
async function goToSendStep(user: User) {
  await user.type(
    screen.getByPlaceholderText(/Nova campanha aberta/),
    "Nova campanha aberta",
  );
  await user.type(
    screen.getByPlaceholderText(/Escreva o que os criadores vão ler/),
    "Entre no app e confira.",
  );
  // O alcance é calculado sozinho (com debounce); só com ele dá para avançar.
  await screen.findByText("1.200 criadores");
  await user.click(screen.getByRole("button", { name: /Continuar/ }));
  await user.click(screen.getByRole("button", { name: /Continuar/ }));
}

/** O botão de envio fica no rodapé: é o último com esse nome na tela. */
const footerButton = (name: string) =>
  screen.getAllByRole("button", { name }).at(-1)!;

/** Chaves de idempotência de cada chamada ao POST, na ordem. */
const sentKeys = () =>
  createMutate.mock.calls.map(([arg]) => arg.idempotencyKey as string);

describe("AdminNotificationForm — envio", () => {
  beforeEach(() => {
    createMutate.mockReset().mockResolvedValue({ id: "n-1" });
    estimateMutate.mockReset().mockResolvedValue({
      total_recipients: 1200,
      by_channel: { push: 1200 },
    });
    onClose.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("pede confirmação, com o alcance, antes de enviar na hora", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    await goToSendStep(user);

    await user.click(footerButton("Enviar agora"));

    expect(createMutate).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Enviar agora para 1\.200 criadores \(Push no app\)\?/),
    ).toBeInTheDocument();
    expect(screen.getByText(CONFIRM_TEXT)).toBeInTheDocument();
  });

  it("só envia depois de confirmar, com o conteúdo e uma Idempotency-Key", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    await goToSendStep(user);

    await user.click(footerButton("Enviar agora"));
    await user.click(screen.getByRole("button", { name: "Confirmar envio" }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate).toHaveBeenCalledWith({
      payload: {
        title: "Nova campanha aberta",
        body: "Entre no app e confira.",
        cta_url: null,
        channels: ["push"],
        audience: { type: "all" },
        scheduled_at: null,
      },
      idempotencyKey: expect.stringMatching(UUID_RE),
    });
    expect(toastSuccess).toHaveBeenCalledWith("Notificação enviada para a fila.");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reenvia o mesmo conteúdo com a mesma Idempotency-Key após falha de rede", async () => {
    createMutate.mockRejectedValueOnce(new Error("Failed to fetch"));
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    await goToSendStep(user);

    await user.click(footerButton("Enviar agora"));
    await user.click(screen.getByRole("button", { name: "Confirmar envio" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Failed to fetch"),
    );

    // Continua na confirmação, pronto para tentar de novo.
    await user.click(screen.getByRole("button", { name: "Confirmar envio" }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(2));
    const [first, second] = sentKeys();
    expect(first).toMatch(UUID_RE);
    expect(second).toBe(first);
  });

  it("troca a Idempotency-Key quando o envio muda (agendar em vez de reenviar)", async () => {
    createMutate.mockRejectedValueOnce(new Error("Failed to fetch"));
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    await goToSendStep(user);

    await user.click(footerButton("Enviar agora"));
    await user.click(screen.getByRole("button", { name: "Confirmar envio" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /Agendar para depois/ }));
    await user.click(screen.getByRole("button", { name: "Agendar envio" }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(2));
    const [first, second] = sentKeys();
    expect(second).toMatch(UUID_RE);
    expect(second).not.toBe(first);
  });

  it("agendamento não pede confirmação (dá para cancelar depois)", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    await goToSendStep(user);

    await user.click(screen.getByRole("button", { name: /Agendar para depois/ }));
    await user.click(screen.getByRole("button", { name: "Agendar envio" }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(CONFIRM_TEXT)).not.toBeInTheDocument();
    expect(createMutate.mock.calls[0][0].payload.scheduled_at).toEqual(
      expect.any(String),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Envio agendado.");
  });

  it("trocar para agendamento fecha a confirmação do envio imediato", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    await goToSendStep(user);
    await user.click(footerButton("Enviar agora"));
    expect(screen.getByText(CONFIRM_TEXT)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Agendar para depois/ }));

    expect(screen.queryByText(CONFIRM_TEXT)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Agendar envio" }),
    ).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("Esc na confirmação volta ao resumo sem fechar o formulário", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    await goToSendStep(user);
    await user.click(footerButton("Enviar agora"));

    await user.keyboard("{Escape}");

    expect(screen.queryByText(CONFIRM_TEXT)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

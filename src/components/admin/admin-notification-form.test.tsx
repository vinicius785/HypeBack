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
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Digitar o conteúdo tecla a tecla é lento quando o computador está ocupado (todo o conjunto de testes em paralelo).
vi.setConfig({ testTimeout: 20_000 });

const createMutate = vi.fn();
const estimateMutate = vi.fn();
const sendingState = vi.hoisted(() => ({ pending: false }));
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
    isPending: sendingState.pending,
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
    sendingState.pending = false;
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("limita o título a 31 caracteres (emoji conta 1, os ** não contam) e a mensagem a 106", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    const title = screen.getByPlaceholderText(/Nova campanha aberta/);
    const body = screen.getByPlaceholderText(/Escreva o que os criadores vão ler/);

    await user.click(title);
    await user.paste("🎉 " + "a".repeat(60));
    expect(title).toHaveValue("🎉 " + "a".repeat(29));
    expect(screen.getByText("31/31")).toBeInTheDocument();

    await user.clear(title);
    await user.paste("**" + "b".repeat(31) + "**");
    expect(title).toHaveValue("**" + "b".repeat(31) + "**");
    expect(screen.getByText("31/31")).toBeInTheDocument();

    await user.click(body);
    await user.paste("c".repeat(300));
    expect(body).toHaveValue("c".repeat(106));
    expect(screen.getByText("106/106")).toBeInTheDocument();
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
    expect(toastSuccess).toHaveBeenCalledWith("Notificação enviada para a fila.", expect.anything());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reenvia o mesmo conteúdo com a mesma Idempotency-Key após falha de rede", async () => {
    createMutate.mockRejectedValueOnce(new Error("Failed to fetch"));
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    await goToSendStep(user);

    await user.click(footerButton("Enviar agora"));
    await user.click(screen.getByRole("button", { name: "Confirmar envio" }));
    // Erro técnico (sem status) nunca vai cru para a tela: o aviso é a frase do kit.
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Não foi possível criar a notificação.", expect.anything()),
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
    expect(toastSuccess).toHaveBeenCalledWith("Envio agendado.", expect.anything());
  });

  it("agenda em qualquer horário, inclusive de madrugada (relógio, sem lista de 09h às 21h)", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    await goToSendStep(user);
    await user.click(screen.getByRole("button", { name: /Agendar para depois/ }));

    const hora = screen.getByLabelText("Hora");
    const minutos = screen.getByLabelText("Minutos");
    await user.clear(hora);
    await user.type(hora, "06");
    await user.clear(minutos);
    await user.type(minutos, "30");
    expect(hora).toHaveValue("06");
    expect(minutos).toHaveValue("30");

    await user.click(screen.getByRole("button", { name: "Agendar envio" }));
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const sentAt = new Date(createMutate.mock.calls[0][0].payload.scheduled_at as string);
    expect(sentAt.getHours()).toBe(6);
    expect(sentAt.getMinutes()).toBe(30);
  });

  it("apagar o campo da hora não deixa o horário vazio: volta ao último valor válido e agenda normalmente", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    await goToSendStep(user);
    await user.click(screen.getByRole("button", { name: /Agendar para depois/ }));

    const hora = screen.getByLabelText("Hora");
    await user.clear(hora);
    await user.tab();
    expect(hora).toHaveValue("10");

    await user.click(screen.getByRole("button", { name: "Agendar envio" }));
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(new Date(createMutate.mock.calls[0][0].payload.scheduled_at as string).getHours()).toBe(10);
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

describe("AdminNotificationForm — diálogo", () => {
  beforeEach(() => {
    createMutate.mockReset().mockResolvedValue({ id: "n-1" });
    estimateMutate.mockReset().mockResolvedValue({ total_recipients: 1200, by_channel: { push: 1200 } });
    onClose.mockReset();
    sendingState.pending = false;
    document.body.style.overflow = "";
  });

  it("é um diálogo modal nomeado pelo título, com o foco no primeiro campo e a rolagem da página travada", async () => {
    render(<AdminNotificationForm onClose={onClose} />);

    const dialog = screen.getByRole("dialog", { name: "Nova notificação" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(screen.getByLabelText("Título")).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("os campos têm rótulo de verdade e o erro do campo vira a descrição dele", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);

    expect(screen.getByLabelText("Mensagem")).toBeInTheDocument();
    expect(screen.getByLabelText(/Link ao tocar/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Continuar/ }));

    const title = screen.getByLabelText("Título");
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAccessibleDescription("Escreva um título");
  });

  it("o passo atual é anunciado (aria-current=step)", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    await goToSendStep(user);

    const steps = screen.getByRole("group", { name: "Passos da notificação" });
    const buttons = within(steps).getAllByRole("button");
    expect(buttons[2]).toHaveAttribute("aria-current", "step");
    expect(buttons[0]).not.toHaveAttribute("aria-current");
  });

  it("o resumo de alcance é uma região viva (polite)", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationForm onClose={onClose} />);
    await user.type(screen.getByPlaceholderText(/Nova campanha aberta/), "Aviso");
    await user.type(screen.getByPlaceholderText(/Escreva o que os criadores vão ler/), "Texto");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));

    // O número também aparece no resumo da prévia; a região viva é a do bloco de alcance.
    const matches = await screen.findAllByText("1.200 criadores");
    const reach = matches.map((el) => el.closest("[aria-live]")).find(Boolean);
    expect(reach).toHaveAttribute("aria-live", "polite");
  });

  it("clique no fundo fecha o formulário vazio, mas não quando há algo digitado (Esc e Fechar continuam fechando)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<AdminNotificationForm onClose={onClose} />);
    await user.click(document.querySelector(".ovb") as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    onClose.mockReset();
    render(<AdminNotificationForm onClose={onClose} />);
    await user.type(screen.getByPlaceholderText(/Nova campanha aberta/), "Aviso");
    await user.click(document.querySelector(".ovb") as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("duplicar: o que veio preenchido não conta como digitado; mexer em algo conta", async () => {
    const user = userEvent.setup();
    render(
      <AdminNotificationForm
        onClose={onClose}
        initial={{ title: "Aviso", body: "Texto", ctaUrl: "", channels: ["push"], audience: { type: "all" } }}
      />,
    );
    await user.click(document.querySelector(".ovb") as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockReset();
    await user.type(screen.getByPlaceholderText(/Nova campanha aberta/), "!");
    await user.click(document.querySelector(".ovb") as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("gravando, os botões de passo ficam desabilitados", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AdminNotificationForm onClose={onClose} />);
    await goToSendStep(user);
    const steps = screen.getByRole("group", { name: "Passos da notificação" });
    expect(within(steps).getAllByRole("button")[0]).toBeEnabled();

    sendingState.pending = true;
    rerender(<AdminNotificationForm onClose={onClose} />);

    for (const button of within(steps).getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("Esc fecha; gravando, Esc, o fundo e o botão de fechar não fecham", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AdminNotificationForm onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockReset();
    sendingState.pending = true;
    rerender(<AdminNotificationForm onClose={onClose} />);

    const dialog = screen.getByRole("dialog", { name: "Nova notificação" });
    expect(dialog).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await user.click(document.querySelector(".ovb") as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });
});

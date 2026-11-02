import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminConfirmDialog, typedConfirmationMatches, type AdminConfirmDialogProps } from "./admin-confirm-dialog";

function setup(props: Partial<AdminConfirmDialogProps> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <AdminConfirmDialog
      open
      title="Suspender workspace"
      confirmLabel="Suspender"
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
  );
  return { ...view, onConfirm, onClose, user: userEvent.setup() };
}

const confirmButton = () => screen.getByRole("button", { name: /Suspender|Aguarde/ });

afterEach(() => {
  document.body.style.overflow = "";
});

describe("AdminConfirmDialog", () => {
  it("é um diálogo modal acessível, nomeado pelo título", () => {
    setup({ description: "O time perde o acesso." });
    const dialog = screen.getByRole("dialog", { name: "Suspender workspace" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("O time perde o acesso.");
  });

  it("ação destrutiva é alertdialog com botão vermelho; a neutra tem botão preto", () => {
    const { unmount } = setup({ tone: "danger" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(confirmButton()).toHaveClass("dng");
    unmount();
    setup({ tone: "neutral" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(confirmButton()).not.toHaveClass("dng");
  });

  it("não renderiza nada fechado", () => {
    setup({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("o botão fica desabilitado até o motivo ter 5 caracteres (depois de aparar)", async () => {
    const { user, onConfirm } = setup();
    const reason = screen.getByLabelText(/Motivo/);
    expect(confirmButton()).toBeDisabled();

    await user.type(reason, "abcd");
    expect(confirmButton()).toBeDisabled();

    await user.clear(reason);
    await user.type(reason, "  ab  ");
    expect(confirmButton()).toBeDisabled(); // 2 caracteres úteis

    await user.clear(reason);
    await user.type(reason, "abcde");
    expect(confirmButton()).toBeEnabled();

    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith({ reason: "abcde", confirmText: "" });
  });

  it("o motivo vai aparado para onConfirm", async () => {
    const { user, onConfirm } = setup();
    await user.type(screen.getByLabelText(/Motivo/), "   inadimplência há 60 dias   ");
    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith({ reason: "inadimplência há 60 dias", confirmText: "" });
  });

  it("limite de 500 caracteres: o campo trava e o contador mostra 500/500", async () => {
    const { user } = setup();
    const reason = screen.getByLabelText(/Motivo/) as HTMLTextAreaElement;
    expect(reason).toHaveAttribute("maxlength", "500");
    expect(screen.getByText("0/500")).toBeInTheDocument();

    await user.click(reason);
    await user.paste("x".repeat(600));
    expect(reason.value).toHaveLength(500);
    expect(screen.getByText("500/500")).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  it("mostra o contador enquanto digita", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/Motivo/), "abc");
    expect(screen.getByText("3/500")).toBeInTheDocument();
  });

  it("explica o que falta só depois de a pessoa sair do campo", async () => {
    const { user } = setup();
    const reason = screen.getByLabelText(/Motivo/);
    await user.type(reason, "ab");
    expect(screen.queryByText(/pelo menos 5 caracteres/)).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByText("Descreva o motivo com pelo menos 5 caracteres.")).toBeInTheDocument();
    expect(reason).toHaveAttribute("aria-invalid", "true");
  });

  it("abrir o diálogo não mostra erro de campo vazio, nem no StrictMode do dev (que devolve o foco a quem abriu e o traz de volta)", () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            abrir
          </button>
          <AdminConfirmDialog open={open} title="Suspender workspace" confirmLabel="Suspender" onConfirm={() => {}} onClose={() => setOpen(false)} />
        </>
      );
    }
    render(
      <StrictMode>
        <Host />
      </StrictMode>,
    );
    // Como no navegador: o clique leva o foco ao botão, e é para ele que o foco volta a cada desmontagem.
    const opener = screen.getByRole("button", { name: "abrir" });
    opener.focus();
    act(() => {
      opener.click();
    });
    expect(screen.getByLabelText(/Motivo/)).toHaveFocus();
    expect(screen.queryByText(/pelo menos 5 caracteres/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo/)).not.toHaveAttribute("aria-invalid");
  });

  it("limites do motivo são configuráveis", async () => {
    const { user } = setup({ reason: { min: 10, max: 20, label: "Justificativa" } });
    const reason = screen.getByLabelText(/Justificativa/);
    expect(reason).toHaveAttribute("maxlength", "20");
    await user.type(reason, "123456789");
    expect(confirmButton()).toBeDisabled();
    await user.type(reason, "0");
    expect(confirmButton()).toBeEnabled();
  });

  it("sem campo de motivo: habilita direto e confirma com motivo vazio", async () => {
    const { user, onConfirm } = setup({ reason: false });
    expect(screen.queryByLabelText(/Motivo/)).not.toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith({ reason: "", confirmText: "" });
  });

  it("confirmação digitada: só habilita quando o nome confere (sem diferenciar maiúsculas nem pontas)", async () => {
    const { user, onConfirm } = setup({ tone: "danger", typedConfirmation: { expected: "Acme Ltda" } });
    await user.type(screen.getByLabelText(/Motivo/), "encerramento do contrato");
    const typed = screen.getByLabelText(/Para confirmar, digite/);
    expect(confirmButton()).toBeDisabled();

    await user.type(typed, "Acme");
    expect(confirmButton()).toBeDisabled();

    await user.clear(typed);
    await user.type(typed, "  acme ltda  ");
    expect(confirmButton()).toBeEnabled();

    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith({ reason: "encerramento do contrato", confirmText: "  acme ltda  " });
  });

  it("o nome certo não basta sem motivo válido: os dois precisam valer", async () => {
    const { user } = setup({ typedConfirmation: { expected: "Acme" } });
    await user.type(screen.getByLabelText(/Para confirmar, digite/), "Acme");
    expect(confirmButton()).toBeDisabled(); // falta o motivo
    await user.type(screen.getByLabelText(/Motivo/), "motivo válido");
    expect(confirmButton()).toBeEnabled();
  });

  it("typedConfirmationMatches ignora caixa, pontas e acentuação composta, mas não aceita vazio", () => {
    expect(typedConfirmationMatches("ACME", "acme")).toBe(true);
    expect(typedConfirmationMatches("  Açaí Bar ", "açaí bar")).toBe(true);
    expect(typedConfirmationMatches("Café", "Café")).toBe(true); // NFD x NFC
    expect(typedConfirmationMatches("Acme 2", "Acme")).toBe(false);
    expect(typedConfirmationMatches("", "")).toBe(false);
    expect(typedConfirmationMatches("   ", "   ")).toBe(false);
  });

  it("gravando: tudo trava, o botão mostra 'Aguarde…' e Escape, X e clique fora não fecham", async () => {
    const { user, onClose, onConfirm } = setup({ pending: true, reason: false });
    expect(screen.getByRole("button", { name: "Aguarde…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled();

    await user.keyboard("{Escape}");
    await user.click(document.querySelector(".adm-overlay") as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
  });

  it("Escape fecha, e o clique no fundo também (mas não o clique dentro do diálogo)", async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(document.querySelector(".adm-overlay") as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("com motivo digitado, o clique fora NÃO fecha (não joga o texto fora); Escape e Cancelar continuam fechando", async () => {
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText(/Motivo/), "Cobrança em aberto");

    await user.click(document.querySelector(".adm-overlay") as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Motivo/)).toHaveValue("Cobrança em aberto");

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("com a confirmação digitada pela metade o clique fora também não fecha", async () => {
    const { user, onClose } = setup({ reason: false, typedConfirmation: { expected: "Acme" } });
    await user.type(screen.getByLabelText(/digite/), "Ac");
    await user.click(document.querySelector(".adm-overlay") as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("`dirty` do chamador (campos nos children) também segura o clique fora; só espaços no motivo não contam", async () => {
    const { user, onClose, rerender, onConfirm } = setup({ dirty: true });
    await user.click(document.querySelector(".adm-overlay") as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();

    rerender(<AdminConfirmDialog open title="Suspender workspace" confirmLabel="Suspender" onConfirm={onConfirm} onClose={onClose} dirty={false} />);
    await user.type(screen.getByLabelText(/Motivo/), "   ");
    await user.click(document.querySelector(".adm-overlay") as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("o botão Cancelar e o X fecham", async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("o foco entra no campo de motivo e fica preso dentro do diálogo (Tab e Shift+Tab dão a volta)", async () => {
    const { user } = setup();
    const dialog = screen.getByRole("dialog");
    const reason = screen.getByLabelText(/Motivo/);
    expect(reason).toHaveFocus();

    // Tab até o fim: motivo → fechar? ordem do DOM: Fechar, motivo, Cancelar, (Suspender desabilitado)
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.tab(); // passou do último habilitado: volta ao primeiro
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    await user.tab({ shift: true }); // do primeiro para trás: vai ao último habilitado
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("sem campos, o foco inicial fica em 'Cancelar' (Enter não confirma por acidente)", () => {
    setup({ reason: false, tone: "danger" });
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("devolve o foco a quem abriu o diálogo quando ele fecha", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <AdminConfirmDialog open={open} title="Teste" confirmLabel="Ok" reason={false} onConfirm={() => undefined} onClose={() => setOpen(false)} />
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Abrir" });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("trava a rolagem da página enquanto aberto e libera ao fechar", () => {
    document.body.style.overflow = "auto";
    const { rerender } = setup();
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<AdminConfirmDialog open={false} title="x" confirmLabel="y" onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe("auto");
  });

  it("lista as consequências e mostra conteúdo extra (resumo de impacto)", () => {
    setup({
      consequences: ["O time perde o acesso.", "Criadores continuam recebendo."],
      consequencesTitle: "O que muda",
      children: <p>Saldo em custódia: R$ 0,00</p>,
    });
    expect(screen.getByText("O que muda")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["O time perde o acesso.", "Criadores continuam recebendo."]);
    expect(screen.getByText("Saldo em custódia: R$ 0,00")).toBeInTheDocument();
  });

  it("confirmDisabled trava o botão mesmo com tudo preenchido (impacto ainda não carregou)", async () => {
    const { user } = setup({ confirmDisabled: true });
    await user.type(screen.getByLabelText(/Motivo/), "motivo válido");
    expect(confirmButton()).toBeDisabled();
  });

  it("o erro da última tentativa aparece dentro do diálogo, que continua aberto", () => {
    setup({ error: "O nome digitado não confere." });
    expect(screen.getByRole("alert")).toHaveTextContent("O nome digitado não confere.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Enter no campo de confirmação digitada confirma quando válido (e não antes)", async () => {
    const { user, onConfirm } = setup({ reason: false, typedConfirmation: { expected: "Acme" } });
    const typed = screen.getByLabelText(/Para confirmar, digite/);
    await user.type(typed, "Ac{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
    await user.type(typed, "me{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("durante a gravação o texto não muda (campos somente leitura)", () => {
    setup({ pending: true, typedConfirmation: { expected: "Acme" } });
    expect(screen.getByLabelText(/Motivo/)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/Para confirmar, digite/)).toHaveAttribute("readonly");
  });

  it("reabrir começa do zero (o texto de uma ação não vaza para a outra)", async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)}>
            alternar
          </button>
          <AdminConfirmDialog open={open} title="Teste" confirmLabel="Ok" onConfirm={() => undefined} onClose={() => setOpen(false)} />
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(/Motivo/), "texto antigo");
    await user.click(screen.getByRole("button", { name: "alternar" })); // fecha
    await user.click(screen.getByRole("button", { name: "alternar" })); // abre
    expect(screen.getByLabelText(/Motivo/)).toHaveValue("");
  });
});

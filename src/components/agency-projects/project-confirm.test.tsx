import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useProjectConfirm, type ProjectConfirmOptions } from "./project-confirm";

function Harness({ options, onResult }: { options: ProjectConfirmOptions; onResult: (ok: boolean) => void }) {
  const { confirm, dialog } = useProjectConfirm();
  return (
    <>
      <button type="button" onClick={() => void confirm(options).then(onResult)}>
        abrir
      </button>
      {dialog}
    </>
  );
}

describe("useProjectConfirm", () => {
  it("confirmar resolve true; cancelar resolve false; o diálogo some nos dois casos", async () => {
    const onResult = vi.fn();
    const user = userEvent.setup();
    render(<Harness options={{ title: "Arquivar projeto?", description: "Nada é apagado.", confirmLabel: "Arquivar" }} onResult={onResult} />);

    await user.click(screen.getByRole("button", { name: "abrir" }));
    const dialog = within(screen.getByRole("dialog", { name: "Arquivar projeto?" }));
    expect(dialog.getByText("Nada é apagado.")).toBeInTheDocument();
    // Sem campo de motivo (o do Admin pede motivo; aqui não).
    expect(dialog.queryByLabelText(/Motivo/)).not.toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Cancelar" }));
    expect(onResult).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "abrir" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Arquivar" }));
    expect(onResult).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tom 'danger' é um alertdialog com as consequências listadas", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        options={{ title: "Excluir projeto?", consequences: ["As tarefas serão apagadas.", "Não pode ser desfeita."], confirmLabel: "Excluir", tone: "danger" }}
        onResult={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "abrir" }));
    const dialog = within(screen.getByRole("alertdialog", { name: "Excluir projeto?" }));
    expect(dialog.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["As tarefas serão apagadas.", "Não pode ser desfeita."]);
  });

  it("com `run`: trava em 'Aguarde…' enquanto trabalha e só resolve true quando termina", async () => {
    let finish!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const onResult = vi.fn();
    const user = userEvent.setup();
    render(<Harness options={{ title: "Excluir?", confirmLabel: "Excluir", run }} onResult={onResult} />);
    await user.click(screen.getByRole("button", { name: "abrir" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Aguarde…" })).toBeDisabled();
    expect(onResult).not.toHaveBeenCalled();
    finish();
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("com `run` que falha: erro dentro do diálogo, continua aberto e permite tentar de novo", async () => {
    const run = vi.fn().mockRejectedValueOnce(Object.assign(new Error("x"), { code: "PROJECT_NOT_FOUND" })).mockResolvedValueOnce(undefined);
    const onResult = vi.fn();
    const user = userEvent.setup();
    render(<Harness options={{ title: "Excluir?", confirmLabel: "Excluir", run }} onResult={onResult} />);
    await user.click(screen.getByRole("button", { name: "abrir" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esse projeto não existe mais ou não pertence a este workspace.");
    expect(onResult).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" }));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("Escape cancela", async () => {
    const onResult = vi.fn();
    const user = userEvent.setup();
    render(<Harness options={{ title: "Arquivar?", confirmLabel: "Arquivar" }} onResult={onResult} />);
    await user.click(screen.getByRole("button", { name: "abrir" }));
    await user.keyboard("{Escape}");
    expect(onResult).toHaveBeenCalledWith(false);
  });
});

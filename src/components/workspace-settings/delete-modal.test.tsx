/**
 * Diálogo de exclusão do workspace: nome digitado confirma, texto honesto (a exclusão é lógica) e os
 * impedimentos (409 WORKSPACE_DELETE_BLOCKED) aparecem dentro dele, que continua aberto.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DeleteBlocker } from "@/lib/workspace-state/delete-blockers";

import { DeleteModal } from "./delete-modal";

const NBSP = " ";

function setup(props: Partial<React.ComponentProps<typeof DeleteModal>> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(<DeleteModal name="Acme Ltda" pending={false} onClose={onClose} onConfirm={onConfirm} {...props} />);
  const dialog = within(screen.getByRole("dialog", { name: "Excluir workspace" }));
  return { onClose, onConfirm, dialog };
}

const confirmButton = (dialog: ReturnType<typeof setup>["dialog"]) => dialog.getByRole("button", { name: /Excluir workspace|Excluindo/ });

describe("DeleteModal: texto", () => {
  it("diz o que acontece sem prometer destruição: some para a equipe, nada é apagado, só o suporte restaura", () => {
    const { dialog } = setup();
    const body = screen.getByRole("dialog").textContent ?? "";
    expect(body).toContain("Acme Ltda deixa de aparecer para você e para toda a equipe");
    expect(body).toContain("Nada é apagado dos nossos registros");
    expect(body).toContain("só o suporte pode restaurar o workspace");
    expect(body).not.toMatch(/para sempre|definitiv|permanente|irrevers/i);
    expect(confirmButton(dialog)).toHaveTextContent("Excluir workspace");
  });
});

describe("DeleteModal: confirmação pelo nome", () => {
  it("o botão só habilita com o nome exato do workspace (espaços nas pontas não contam)", async () => {
    const { dialog, onConfirm } = setup();
    const button = confirmButton(dialog);
    expect(button).toBeDisabled();

    const field = dialog.getByLabelText("Nome do workspace");
    await userEvent.type(field, "Acme");
    expect(button).toBeDisabled();
    await userEvent.type(field, " Ltd");
    expect(button).toBeDisabled();
    await userEvent.type(field, "a  ");
    expect(button).toBeEnabled();

    await userEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("enquanto exclui, o botão fica desabilitado e diz 'Excluindo…'", async () => {
    const { dialog } = setup({ pending: true });
    await userEvent.type(dialog.getByLabelText("Nome do workspace"), "Acme Ltda");
    expect(confirmButton(dialog)).toBeDisabled();
    expect(confirmButton(dialog)).toHaveTextContent("Excluindo…");
  });

  it("Cancelar e Esc fecham", async () => {
    const { dialog, onClose } = setup();
    await userEvent.click(dialog.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("DeleteModal: impedimentos (409 WORKSPACE_DELETE_BLOCKED)", () => {
  const blockers: DeleteBlocker[] = [
    { code: "HAS_CUSTODY_BALANCE", message: "Saldo em custódia", amount_cents: 125000 },
    { code: "HAS_COMMITTED_FUNDS", message: "Valor comprometido", amount_cents: 30050 },
    { code: "HAS_PENDING_CHARGES", message: "Cobranças pendentes", count: 2 },
    { code: "HAS_WITHDRAWALS_IN_FLIGHT", message: "Saques em andamento", count: 1 },
    { code: "HAS_PUBLISHED_CAMPAIGNS", message: "Campanhas publicadas", count: 3 },
  ];

  it("sem impedimentos (ou null), nenhum painel", () => {
    setup();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra os cinco em pt-BR claro, com valores exatos, e o que fazer: resolver ou falar com o suporte", () => {
    setup({ blockers });
    const alert = screen.getByRole("alert");
    expect(within(alert).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      `Há R$${NBSP}1.250,00 de saldo no workspace.`,
      `Há R$${NBSP}300,50 reservados para criadores.`,
      "Há 2 cobranças PIX aguardando pagamento.",
      "Há 1 saque de criador em andamento.",
      "Há 3 campanhas publicadas.",
    ]);
    expect(alert).toHaveTextContent("Resolva esses itens e tente de novo, ou fale com o suporte.");
    expect(within(alert).getByRole("link", { name: "fale com o suporte" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:suporte@hypeapp.com.br?subject="),
    );
  });

  it("o diálogo continua aberto e dá para tentar de novo: o nome digitado e o botão seguem lá", async () => {
    const { dialog, onClose, onConfirm } = setup({ blockers });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.type(dialog.getByLabelText("Nome do workspace"), "Acme Ltda");
    await userEvent.click(confirmButton(dialog));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("o servidor bloqueou mas não detalhou: o diálogo ainda explica", () => {
    setup({ blockers: [] });
    expect(screen.getByRole("alert")).toHaveTextContent("Há algo pendente neste workspace");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

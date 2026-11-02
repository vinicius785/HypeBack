import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceActionsMenu } from "./workspace-actions-menu";

const trigger = () => screen.getByRole("button", { name: "Ações" });

describe("WorkspaceActionsMenu", () => {
  it("sem nenhuma ação permitida não desenha nada (nem um botão vazio)", () => {
    const { container } = render(<WorkspaceActionsMenu actions={[]} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("fechado: só o botão, anunciado como menu; aberto: os itens, na ordem recebida", async () => {
    render(<WorkspaceActionsMenu actions={["reactivate", "archive", "delete"]} onSelect={vi.fn()} />);

    expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(trigger());
    expect(screen.getByRole("menu", { name: "Ações do workspace" })).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Reativar", "Arquivar", "Excluir"]);
    expect(trigger()).toHaveAttribute("aria-controls", screen.getByRole("menu").id);
  });

  it("escolher um item avisa quem chamou UMA vez, fecha o menu e devolve o foco ao botão", async () => {
    const onSelect = vi.fn();
    render(<WorkspaceActionsMenu actions={["suspend", "archive"]} onSelect={onSelect} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("menuitem", { name: "Arquivar" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("archive");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("teclado: seta para baixo no botão abre; Home, End e as setas percorrem em círculo; Enter escolhe", async () => {
    const onSelect = vi.fn();
    render(<WorkspaceActionsMenu actions={["suspend", "archive", "delete"]} onSelect={onSelect} />);
    trigger().focus();
    await userEvent.keyboard("{ArrowDown}");

    const [first, second, third] = screen.getAllByRole("menuitem");
    expect(first).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(third).toHaveFocus(); // do primeiro volta ao último
    await userEvent.keyboard("{Home}");
    expect(first).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(second).not.toBeInTheDocument(); // o menu fechou
    expect(onSelect).toHaveBeenCalledWith("archive");
  });

  it("Tab fecha o menu (o foco segue o caminho natural) e Escape não vaza para a tela por baixo", async () => {
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    render(<WorkspaceActionsMenu actions={["suspend"]} onSelect={vi.fn()} />);
    await userEvent.click(trigger());
    await userEvent.keyboard("{Tab}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(trigger());
    outer.mockClear();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    document.removeEventListener("keydown", outer);
  });

  it("clicar no botão de novo fecha; só 'Excluir' é perigoso", async () => {
    render(<WorkspaceActionsMenu actions={["suspend", "delete"]} onSelect={vi.fn()} />);
    await userEvent.click(trigger());
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toHaveAttribute("data-danger", "true");
    expect(screen.getByRole("menuitem", { name: "Suspender" })).not.toHaveAttribute("data-danger");

    await userEvent.click(trigger());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

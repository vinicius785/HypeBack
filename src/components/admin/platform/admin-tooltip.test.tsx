import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminIconButton, AdminTooltip } from "./admin-tooltip";

/** jsdom não tem PointerEvent: monta o evento com o `pointerType` que o React lê do evento nativo. */
function pointer(type: string, element: Element, pointerType: "mouse" | "touch") {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  act(() => {
    element.dispatchEvent(event);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AdminTooltip", () => {
  it("o filho ganha aria-describedby apontando para o texto, que fica sempre no DOM", () => {
    render(
      <AdminTooltip content="Copiar link">
        <button type="button">Copiar</button>
      </AdminTooltip>,
    );
    const button = screen.getByRole("button", { name: "Copiar" });
    expect(button).toHaveAccessibleDescription("Copiar link");
    // sem a dica visível, não há role=tooltip
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("preserva o aria-describedby que o filho já tinha", () => {
    render(
      <>
        <p id="ajuda">Ajuda existente</p>
        <AdminTooltip content="Dica nova">
          <button type="button" aria-describedby="ajuda">
            Botão
          </button>
        </AdminTooltip>
      </>,
    );
    expect(screen.getByRole("button", { name: "Botão" })).toHaveAccessibleDescription("Ajuda existente Dica nova");
  });

  it("aparece ao focar por teclado, na hora, e some ao sair do foco", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Antes</button>
        <AdminTooltip content="Copiar link">
          <button type="button">Copiar</button>
        </AdminTooltip>
      </>,
    );
    await user.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("button", { name: "Copiar" })).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Copiar link");
    await user.tab({ shift: true });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("aparece ao passar o mouse (delay 0) e some ao sair", async () => {
    const user = userEvent.setup();
    render(
      <AdminTooltip content="Copiar link" delay={0}>
        <button type="button">Copiar</button>
      </AdminTooltip>,
    );
    await user.hover(screen.getByRole("button", { name: "Copiar" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Copiar link");
    await user.unhover(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("no mouse espera o atraso antes de mostrar", () => {
    vi.useFakeTimers();
    render(
      <AdminTooltip content="Copiar link" delay={400}>
        <button type="button">Copiar</button>
      </AdminTooltip>,
    );
    fireEvent.pointerEnter(screen.getByRole("button"), { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("sair antes do atraso cancela a dica", () => {
    vi.useFakeTimers();
    render(
      <AdminTooltip content="Copiar link" delay={400}>
        <button type="button">Copiar</button>
      </AdminTooltip>,
    );
    const button = screen.getByRole("button");
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("o mouse pode atravessar o vão e pousar na dica sem ela sumir", () => {
    vi.useFakeTimers();
    render(
      <AdminTooltip content="Copiar link" delay={0}>
        <button type="button">Copiar</button>
      </AdminTooltip>,
    );
    const button = screen.getByRole("button");
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    const tip = screen.getByRole("tooltip");
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.pointerEnter(tip, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.pointerLeave(tip, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("em toque não aparece (passar o dedo não é passar o mouse)", () => {
    render(
      <AdminTooltip content="Copiar link" delay={0}>
        <button type="button">Copiar</button>
      </AdminTooltip>,
    );
    pointer("pointerover", screen.getByRole("button"), "touch");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("o foco que veio de um clique/toque não abre a dica", () => {
    render(
      <AdminTooltip content="Copiar link">
        <button type="button">Copiar</button>
      </AdminTooltip>,
    );
    const button = screen.getByRole("button");
    pointer("pointerdown", button, "touch");
    act(() => button.focus());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    pointer("pointerup", button, "touch");
  });

  it("clicar com o mouse tira a dica que estava aberta", async () => {
    const user = userEvent.setup();
    render(
      <AdminTooltip content="Copiar link" delay={0}>
        <button type="button">Copiar</button>
      </AdminTooltip>,
    );
    await user.hover(screen.getByRole("button"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.click(screen.getByRole("button"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("Escape dispensa a dica sem fechar o que está por baixo, e o foco continua no botão", async () => {
    const user = userEvent.setup();
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <AdminTooltip content="Copiar link">
          <button type="button">Copiar</button>
        </AdminTooltip>
      </div>,
    );
    await user.tab();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar" })).toHaveFocus();
    expect(outer).not.toHaveBeenCalled();
    // sem dica aberta, o Escape segue para quem estiver por baixo
    await user.keyboard("{Escape}");
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it("some ao rolar a página e ao redimensionar", async () => {
    const user = userEvent.setup();
    render(
      <AdminTooltip content="Copiar link">
        <button type="button">Copiar</button>
      </AdminTooltip>,
    );
    await user.tab();
    // a rolagem que MOVE o gatilho (o jsdom não faz layout: simulamos o retângulo andando) dispensa a dica
    const wrap = screen.getByRole("button", { name: "Copiar" }).parentElement as HTMLElement;
    wrap.getBoundingClientRect = () => ({ top: 120, left: 0, bottom: 150, right: 40, width: 40, height: 30, x: 0, y: 120, toJSON: () => ({}) });
    act(() => {
      document.body.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    await user.tab({ shift: true });
    await user.tab();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("a rolagem que o próprio foco provoca (Tab até um botão fora da tela) não dispensa a dica", async () => {
    const user = userEvent.setup();
    render(
      <AdminTooltip content="Copiar link">
        <button type="button">Copiar</button>
      </AdminTooltip>,
    );
    await user.tab();
    // o gatilho não saiu do lugar em relação à janela desde que a dica foi posicionada
    act(() => {
      document.body.dispatchEvent(new Event("scroll"));
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("o texto de apoio mora dentro do invólucro, não solto ao lado dele", () => {
    render(
      <div data-testid="cell">
        <AdminTooltip content="Copiar link">
          <button type="button">Copiar</button>
        </AdminTooltip>
      </div>,
    );
    const cell = screen.getByTestId("cell");
    expect(cell.children).toHaveLength(1);
    const description = document.getElementById(screen.getByRole("button", { name: "Copiar" }).getAttribute("aria-describedby") ?? "");
    expect(cell.firstElementChild).toContainElement(description);
  });

  it("a dica é um portal com posição calculada (fixed), fora do contêiner com overflow", async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="card" style={{ overflow: "hidden" }}>
        <AdminTooltip content="Copiar link">
          <button type="button">Copiar</button>
        </AdminTooltip>
      </div>,
    );
    await user.tab();
    const tip = screen.getByRole("tooltip");
    expect(screen.getByTestId("card")).not.toContainElement(tip);
    expect(tip.style.top).not.toBe("");
    expect(tip.style.left).not.toBe("");
    expect(tip.dataset.placement).toMatch(/^(top|bottom)$/);
  });

  it("inverte para baixo quando não cabe em cima", async () => {
    const user = userEvent.setup();
    render(
      <AdminTooltip content="Copiar link" placement="top">
        <button type="button">Copiar</button>
      </AdminTooltip>,
    );
    // jsdom não faz layout: o gatilho fica em top 0, então em cima não cabe
    await user.tab();
    expect(screen.getByRole("tooltip").dataset.placement).toBe("bottom");
  });

  it("describe={false} não liga o aria-describedby", () => {
    render(
      <AdminTooltip content="Copiar link" describe={false}>
        <button type="button">Copiar</button>
      </AdminTooltip>,
    );
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-describedby");
  });

  it("botão desabilitado recebe a dica pelo mouse (o invólucro pega o evento)", async () => {
    render(
      <AdminTooltip content="Sem permissão" delay={0}>
        <button type="button" disabled>
          Apagar
        </button>
      </AdminTooltip>,
    );
    fireEvent.pointerEnter(screen.getByRole("button").parentElement as HTMLElement, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Sem permissão");
  });
});

describe("AdminIconButton", () => {
  it("o rótulo é o nome acessível e o texto da dica; não é lido duas vezes", async () => {
    const user = userEvent.setup();
    render(<AdminIconButton label="Remover membro" icon="x" />);
    const button = screen.getByRole("button", { name: "Remover membro" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveAttribute("aria-describedby");
    expect(button.querySelector("svg")).not.toBeNull();
    await user.tab();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Remover membro");
  });

  it("clique e teclado (Enter e Espaço) chamam onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AdminIconButton label="Remover membro" icon="x" onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("desabilitado não dispara onClick e não entra na ordem de tabulação", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <AdminIconButton label="Remover membro" icon="x" onClick={onClick} disabled />
        <button type="button">Depois</button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Remover membro" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Remover membro" }));
    expect(onClick).not.toHaveBeenCalled();
    await user.tab();
    expect(screen.getByRole("button", { name: "Depois" })).toHaveFocus();
  });

  it("tom e tamanho viram atributos de estilo, com padrão default/md", () => {
    const { rerender } = render(<AdminIconButton label="Mais" icon="more" />);
    expect(screen.getByRole("button")).toHaveAttribute("data-tone", "default");
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "md");
    rerender(<AdminIconButton label="Excluir" icon="x" tone="danger" size="sm" />);
    expect(screen.getByRole("button")).toHaveAttribute("data-tone", "danger");
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "sm");
  });

  it("repassa atributos do botão (data-*, aria-pressed) e a classe extra", () => {
    render(<AdminIconButton label="Favoritar" icon="x" aria-pressed data-testid="fav" className="extra" />);
    const button = screen.getByTestId("fav");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass("adm-ibtn", "extra");
  });

  it("aceita um elemento pronto como ícone", () => {
    render(<AdminIconButton label="Custom" icon={<svg data-testid="custom" />} />);
    expect(screen.getByTestId("custom")).toBeInTheDocument();
  });

  it("Escape dispensa a dica sem tirar o foco do botão", async () => {
    const user = userEvent.setup();
    render(<AdminIconButton label="Remover membro" icon="x" />);
    await user.tab();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveFocus();
  });
});

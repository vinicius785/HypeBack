import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminDialog, AdminDrawer, type AdminDialogProps } from "./admin-dialog";

type Variant = typeof AdminDialog;

function setup(props: Partial<AdminDialogProps> = {}, Component: Variant = AdminDialog) {
  const onClose = vi.fn();
  const view = render(
    <Component open title="Renomear grupo" onClose={onClose} {...props}>
      {props.children ?? <input aria-label="Nome" />}
    </Component>,
  );
  return { ...view, onClose, user: userEvent.setup() };
}

afterEach(() => {
  document.body.style.overflow = "";
});

describe.each([
  ["AdminDialog", AdminDialog],
  ["AdminDrawer", AdminDrawer],
] as const)("%s", (_name, Component) => {
  it("é um diálogo modal nomeado pelo título e descrito pela descrição", () => {
    setup({ description: "Aparece para todo o time." }, Component);
    const dialog = screen.getByRole("dialog", { name: "Renomear grupo" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Aparece para todo o time.");
    expect(screen.getByRole("heading", { level: 2, name: "Renomear grupo" })).toBeInTheDocument();
  });

  it("sem descrição não tem aria-describedby", () => {
    setup({}, Component);
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-describedby");
  });

  it("não renderiza nada fechado", () => {
    setup({ open: false }, Component);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renderiza em portal dentro de um contêiner .pv, fora do ponto onde foi montado", () => {
    const { container } = setup({}, Component);
    const dialog = screen.getByRole("dialog");
    expect(container).not.toContainElement(dialog);
    expect(dialog.closest(".pv")).not.toBeNull();
    expect(dialog.closest(".pv")?.parentElement).toBe(document.body);
  });

  it("o foco inicial vai para o primeiro campo do conteúdo, não para o botão Fechar", () => {
    setup({}, Component);
    expect(screen.getByLabelText("Nome")).toHaveFocus();
  });

  it("sem campos no conteúdo, o foco vai para o primeiro botão do rodapé", () => {
    setup(
      {
        children: <p>Só texto.</p>,
        footer: (
          <>
            <button type="button">Cancelar</button>
            <button type="button">Salvar</button>
          </>
        ),
      },
      Component,
    );
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("initialFocusRef escolhe quem recebe o foco", () => {
    const ref = createRef<HTMLButtonElement>();
    setup(
      {
        initialFocusRef: ref,
        children: (
          <>
            <input aria-label="Nome" />
            <button type="button" ref={ref}>
              Escolhido
            </button>
          </>
        ),
      },
      Component,
    );
    expect(screen.getByRole("button", { name: "Escolhido" })).toHaveFocus();
  });

  it("respeita [data-adm-autofocus] do conteúdo", () => {
    setup(
      {
        children: (
          <>
            <input aria-label="Primeiro" />
            <input aria-label="Segundo" data-adm-autofocus />
          </>
        ),
      },
      Component,
    );
    expect(screen.getByLabelText("Segundo")).toHaveFocus();
  });

  it("prende o Tab e o Shift+Tab dentro do painel", async () => {
    const { user } = setup(
      { children: <input aria-label="Nome" />, footer: <button type="button">Salvar</button> },
      Component,
    );
    const close = screen.getByRole("button", { name: "Fechar" });
    const name = screen.getByLabelText("Nome");
    const save = screen.getByRole("button", { name: "Salvar" });

    expect(name).toHaveFocus();
    await user.tab();
    expect(save).toHaveFocus();
    await user.tab(); // do último volta ao primeiro (o Fechar do cabeçalho)
    expect(close).toHaveFocus();
    await user.tab({ shift: true }); // do primeiro volta ao último
    expect(save).toHaveFocus();
  });

  it("Escape pede para fechar uma vez e não chega a quem está por baixo", async () => {
    const below = vi.fn();
    document.addEventListener("keydown", below);
    const { user, onClose } = setup({}, Component);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(below).not.toHaveBeenCalled();
    document.removeEventListener("keydown", below);
  });

  it("o botão Fechar tem o nome padrão e pede para fechar; closeLabel troca o nome", async () => {
    const { user, onClose, unmount } = setup({}, Component);
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    setup({ closeLabel: "Dispensar painel" }, Component);
    expect(screen.getByRole("button", { name: "Dispensar painel" })).toBeInTheDocument();
  });

  it("clique no fundo fecha; clique dentro do painel não", () => {
    const { onClose } = setup({}, Component);
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog);
    fireEvent.mouseDown(screen.getByLabelText("Nome"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dirty: o clique no fundo não fecha, mas Escape e Fechar continuam fechando", async () => {
    const { user, onClose } = setup({ dirty: true }, Component);
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("busy: Escape, clique no fundo e Fechar não fecham; aria-busy e botão desabilitado", async () => {
    const { user, onClose } = setup({ busy: true }, Component);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-busy", "true");
    const close = screen.getByRole("button", { name: "Fechar" });
    expect(close).toBeDisabled();

    await user.keyboard("{Escape}");
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    fireEvent.click(close);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sem busy não há aria-busy", () => {
    setup({}, Component);
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-busy");
  });

  it("busy muda enquanto aberto: o Escape passa a respeitar o valor atual", async () => {
    function Harness() {
      const [busy, setBusy] = useState(false);
      return (
        <Component open title="Salvar" busy={busy} onClose={onClose}>
          <button type="button" onClick={() => setBusy((b) => !b)}>
            alternar
          </button>
        </Component>
      );
    }
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "alternar" }));
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "alternar" }));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("busy: o botão que estava com o foco fica desabilitado e o foco não se perde no body", async () => {
    function Harness() {
      const [busy, setBusy] = useState(false);
      return (
        <Component
          open
          title="Salvar"
          busy={busy}
          onClose={() => {}}
          footer={
            <button type="button" disabled={busy} onClick={() => setBusy(true)}>
              Salvar
            </button>
          }
        >
          <p>Texto.</p>
        </Component>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    expect(document.body).not.toHaveFocus();
  });

  it("botão direito no fundo não fecha", () => {
    const { onClose } = setup({}, Component);
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement, { button: 2 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("trava a rolagem da página enquanto aberto e solta ao fechar", () => {
    const { rerender } = setup({}, Component);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <Component open={false} title="Renomear grupo" onClose={() => {}}>
        x
      </Component>,
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("devolve o foco a quem abriu ao fechar", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <Component open={open} title="Renomear grupo" onClose={() => setOpen(false)}>
            <input aria-label="Nome" />
          </Component>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Nome")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("o conteúdo reinicia a cada abertura", async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen((o) => !o)}>
            alternar
          </button>
          <Component open={open} title="Renomear grupo" onClose={() => setOpen(false)}>
            <input aria-label="Nome" />
          </Component>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("Nome"), "abc");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "alternar" }));
    expect(screen.getByLabelText("Nome")).toHaveValue("");
  });

  it("funciona no StrictMode: foco no campo, um Escape fecha uma vez e a rolagem solta no fim", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(
      <StrictMode>
        <Component open title="Renomear grupo" onClose={onClose}>
          <input aria-label="Nome" />
        </Component>
      </StrictMode>,
    );
    expect(screen.getByLabelText("Nome")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("mostra o rodapé na ordem dada (secundária primeiro, principal por último) e some sem rodapé", () => {
    const { unmount } = setup(
      {
        footer: (
          <>
            <button type="button" className="btn out">
              Cancelar
            </button>
            <button type="button" className="btn">
              Salvar
            </button>
          </>
        ),
      },
      Component,
    );
    const footer = screen.getByRole("contentinfo");
    const labels = Array.from(footer.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toEqual(["Cancelar", "Salvar"]);
    unmount();

    setup({}, Component);
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("o tamanho padrão é md e size troca o atributo de estilo", () => {
    const { unmount } = setup({}, Component);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-size", "md");
    unmount();
    setup({ size: "lg" }, Component);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-size", "lg");
  });
});

describe("variantes", () => {
  it("AdminDialog é centralizado e AdminDrawer é o painel lateral", () => {
    const { unmount } = setup({}, AdminDialog);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-variant", "dialog");
    unmount();
    setup({}, AdminDrawer);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-variant", "drawer");
  });

  it("um diálogo aberto de dentro de uma gaveta: o Escape fecha só o de cima", async () => {
    const closeDrawer = vi.fn();
    const closeDialog = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <AdminDrawer open title="Gaveta" onClose={closeDrawer}>
          <input aria-label="Campo da gaveta" />
        </AdminDrawer>
        <AdminDialog open title="Diálogo" onClose={closeDialog}>
          <input aria-label="Campo do diálogo" />
        </AdminDialog>
      </>,
    );
    await user.keyboard("{Escape}");
    expect(closeDialog).toHaveBeenCalledTimes(1);
    expect(closeDrawer).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe("hidden");
  });
});

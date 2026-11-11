import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminActionMenu, type AdminActionMenuItem } from "./admin-action-menu";

function makeItems(overrides: Partial<Record<string, Partial<AdminActionMenuItem>>> = {}) {
  const spies = { edit: vi.fn(), archive: vi.fn(), remove: vi.fn() };
  const items: AdminActionMenuItem[] = [
    { id: "edit", label: "Editar", onSelect: spies.edit, ...overrides.edit },
    { id: "archive", label: "Arquivar", onSelect: spies.archive, ...overrides.archive },
    { id: "remove", label: "Excluir", tone: "danger", onSelect: spies.remove, ...overrides.remove },
  ];
  return { items, spies };
}

const trigger = () => screen.getByRole("button", { name: "Mais" });

describe("AdminActionMenu: gatilho", () => {
  it("botão com rótulo padrão 'Mais', fechado e anunciando o menu", () => {
    render(<AdminActionMenu items={makeItems().items} />);
    expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("aceita rótulo próprio e, só-ícone, usa o ariaLabel como nome", () => {
    const { rerender } = render(<AdminActionMenu items={makeItems().items} label="Ações" />);
    expect(screen.getByRole("button", { name: "Ações" })).toBeInTheDocument();
    rerender(<AdminActionMenu items={makeItems().items} iconOnly ariaLabel="Mais ações de Acme" />);
    const icon = screen.getByRole("button", { name: "Mais ações de Acme" });
    expect(icon).toHaveAttribute("data-icon-only", "true");
    expect(icon).not.toHaveTextContent(/\S/);
  });

  it("só-ícone sem ariaLabel cai no rótulo", () => {
    render(<AdminActionMenu items={makeItems().items} iconOnly label="Opções" />);
    expect(screen.getByRole("button", { name: "Opções" })).toBeInTheDocument();
  });

  it("a variante ghost não usa o fundo branco do botão de contorno", () => {
    render(<AdminActionMenu items={makeItems().items} variant="ghost" />);
    expect(trigger()).toHaveAttribute("data-variant", "ghost");
    expect(trigger()).not.toHaveClass("out");
  });

  it("sem itens não renderiza nada", () => {
    const { container } = render(<AdminActionMenu items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("AdminActionMenu: abrir", () => {
  it("clique abre e foca o primeiro item", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems().items} />);
    await user.click(trigger());
    expect(screen.getByRole("menu", { name: "Mais" })).toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Editar" })).toHaveFocus();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Espaço", " "],
    ["seta para baixo", "{ArrowDown}"],
  ])("%s no botão abre e foca o primeiro item", async (_name, keys) => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems().items} />);
    trigger().focus();
    await user.keyboard(keys);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Editar" })).toHaveFocus();
  });

  it("seta para cima no botão abre pelo último item", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems().items} />);
    trigger().focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toHaveFocus();
  });

  it("o primeiro item habilitado recebe o foco quando o primeiro está desabilitado", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems({ edit: { disabled: true, disabledReason: "Sem permissão" } }).items} />);
    await user.click(trigger());
    expect(screen.getByRole("menuitem", { name: "Arquivar" })).toHaveFocus();
  });

  it("tudo desabilitado: o foco vai ao menu (Escape continua funcionando)", async () => {
    const user = userEvent.setup();
    render(
      <AdminActionMenu
        items={[
          { id: "a", label: "A", onSelect: vi.fn(), disabled: true },
          { id: "b", label: "B", onSelect: vi.fn(), disabled: true },
        ]}
      />,
    );
    await user.click(trigger());
    expect(screen.getByRole("menu")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("clicar de novo no botão fecha", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems().items} />);
    await user.click(trigger());
    await user.click(trigger());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("o menu sai do contêiner do botão (portal), para não ser cortado por overflow de tabela/cartão", async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="card" style={{ overflow: "hidden" }}>
        <AdminActionMenu items={makeItems().items} />
      </div>,
    );
    await user.click(trigger());
    expect(screen.getByTestId("card")).not.toContainElement(screen.getByRole("menu"));
    expect(screen.getByRole("menu").closest(".pv")).not.toBeNull();
  });
});

describe("AdminActionMenu: teclado dentro do menu", () => {
  it("setas percorrem os itens e dão a volta", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems().items} />);
    await user.click(trigger());
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Arquivar" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Editar" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toHaveFocus();
  });

  it("Home e End vão ao primeiro e ao último", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems().items} />);
    await user.click(trigger());
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "Editar" })).toHaveFocus();
  });

  it("digitar a inicial vai ao item que começa com ela (sem acento e sem caixa); repetir percorre", async () => {
    const user = userEvent.setup();
    render(
      <AdminActionMenu
        items={[
          { id: "a", label: "Arquivar", onSelect: vi.fn() },
          { id: "e", label: "Editar", onSelect: vi.fn() },
          { id: "ex", label: "Exportar", onSelect: vi.fn() },
          { id: "ac", label: "Ágil", onSelect: vi.fn() },
        ]}
      />,
    );
    await user.click(trigger());
    await user.keyboard("e");
    expect(screen.getByRole("menuitem", { name: "Editar" })).toHaveFocus();
    await user.keyboard("e");
    expect(screen.getByRole("menuitem", { name: "Exportar" })).toHaveFocus();
    // passada a janela da busca, a próxima letra recomeça do zero
    await new Promise((resolve) => setTimeout(resolve, 700));
    await user.keyboard("a");
    expect(screen.getByRole("menuitem", { name: "Ágil" })).toHaveFocus();
  });

  it("digitar várias letras seguidas afina a busca", async () => {
    const user = userEvent.setup();
    render(
      <AdminActionMenu
        items={[
          { id: "e", label: "Editar", onSelect: vi.fn() },
          { id: "ex", label: "Exportar", onSelect: vi.fn() },
          { id: "exc", label: "Excluir", onSelect: vi.fn() },
        ]}
      />,
    );
    await user.click(trigger());
    await user.keyboard("exc");
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toHaveFocus();
  });

  it("Escape fecha e devolve o foco ao botão", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems().items} />);
    await user.click(trigger());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape não vaza para quem está por baixo (um diálogo, por exemplo)", async () => {
    const user = userEvent.setup();
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <AdminActionMenu items={makeItems().items} />
      </div>,
    );
    await user.click(trigger());
    await user.keyboard("{Escape}");
    expect(outer).not.toHaveBeenCalled();
  });

  it("Tab fecha o menu e o foco segue do botão para o próximo campo", async () => {
    const user = userEvent.setup();
    render(
      <>
        <AdminActionMenu items={makeItems().items} />
        <button type="button">Depois</button>
      </>,
    );
    await user.click(trigger());
    await user.tab();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Depois" })).toHaveFocus();
  });

  it("Shift+Tab fecha o menu e volta ao campo antes do botão", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Antes</button>
        <AdminActionMenu items={makeItems().items} />
      </>,
    );
    await user.click(trigger());
    await user.tab({ shift: true });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Antes" })).toHaveFocus();
  });
});

describe("AdminActionMenu: fechar por fora", () => {
  it("clique fora fecha", async () => {
    const user = userEvent.setup();
    render(
      <>
        <AdminActionMenu items={makeItems().items} />
        <p>Fora</p>
      </>,
    );
    await user.click(trigger());
    await user.click(screen.getByText("Fora"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("rolar a página fecha, mas rolar o próprio menu não", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems().items} />);
    await user.click(trigger());
    act(() => {
      screen.getByRole("menu").dispatchEvent(new Event("scroll"));
    });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    act(() => {
      document.body.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("redimensionar a janela fecha", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems().items} />);
    await user.click(trigger());
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
});

describe("AdminActionMenu: escolher", () => {
  it("clique no item chama onSelect uma vez, fecha e devolve o foco ao botão", async () => {
    const user = userEvent.setup();
    const { items, spies } = makeItems();
    render(<AdminActionMenu items={items} />);
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: "Arquivar" }));
    expect(spies.archive).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("Enter no item escolhe", async () => {
    const user = userEvent.setup();
    const { items, spies } = makeItems();
    render(<AdminActionMenu items={items} />);
    await user.click(trigger());
    await user.keyboard("{ArrowDown}{Enter}");
    expect(spies.archive).toHaveBeenCalledTimes(1);
    expect(trigger()).toHaveFocus();
  });

  it("o foco já está no botão quando onSelect roda (o diálogo aberto por ele devolve o foco ali)", async () => {
    const user = userEvent.setup();
    let focusedAtSelect: Element | null = null;
    render(
      <AdminActionMenu
        items={[
          {
            id: "x",
            label: "Fazer",
            onSelect: () => {
              focusedAtSelect = document.activeElement;
            },
          },
        ]}
      />,
    );
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: "Fazer" }));
    expect(focusedAtSelect).toBe(trigger());
  });
});

describe("AdminActionMenu: itens desabilitados", () => {
  const disabledItems = () => makeItems({ archive: { disabled: true, disabledReason: "Já está arquivado" } });

  it("continuam focáveis, com aria-disabled e o motivo como descrição", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={disabledItems().items} />);
    await user.click(trigger());
    await user.keyboard("{ArrowDown}");
    const item = screen.getByRole("menuitem", { name: "Arquivar" });
    expect(item).toHaveFocus();
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAccessibleDescription("Já está arquivado");
    // o motivo aparece na tela, mas não entra no nome do item
    expect(screen.getByText("Já está arquivado")).toBeInTheDocument();
  });

  it("clique e Enter não executam nem fecham o menu", async () => {
    const user = userEvent.setup();
    const { items, spies } = disabledItems();
    render(<AdminActionMenu items={items} />);
    await user.click(trigger());
    await user.click(screen.getByRole("menuitem", { name: "Arquivar" }));
    await user.keyboard("{Enter}");
    expect(spies.archive).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("sem motivo, não há descrição", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems({ archive: { disabled: true } }).items} />);
    await user.click(trigger());
    expect(screen.getByRole("menuitem", { name: "Arquivar" })).not.toHaveAttribute("aria-describedby");
  });

  it("o motivo só aparece enquanto o item está desabilitado", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems({ archive: { disabledReason: "Já está arquivado" } }).items} />);
    await user.click(trigger());
    expect(screen.queryByText("Já está arquivado")).not.toBeInTheDocument();
  });
});

describe("AdminActionMenu: item destrutivo e separadores", () => {
  it("o item danger vem marcado e depois de um separador automático", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={makeItems().items} />);
    await user.click(trigger());
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toHaveAttribute("data-tone", "danger");
    const separators = screen.getAllByRole("separator");
    expect(separators).toHaveLength(1);
    expect(separators[0].nextElementSibling).toBe(screen.getByRole("menuitem", { name: "Excluir" }));
  });

  it("separatorBefore: false tira o automático; true força um em item comum", async () => {
    const user = userEvent.setup();
    const { items } = makeItems({ remove: { separatorBefore: false }, archive: { separatorBefore: true } });
    render(<AdminActionMenu items={items} />);
    await user.click(trigger());
    const separators = screen.getAllByRole("separator");
    expect(separators).toHaveLength(1);
    expect(separators[0].nextElementSibling).toBe(screen.getByRole("menuitem", { name: "Arquivar" }));
  });

  it("separador não aparece antes do primeiro item", async () => {
    const user = userEvent.setup();
    render(<AdminActionMenu items={[{ id: "r", label: "Excluir", tone: "danger", onSelect: vi.fn() }]} />);
    await user.click(trigger());
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("dois danger seguidos compartilham o mesmo separador", async () => {
    const user = userEvent.setup();
    render(
      <AdminActionMenu
        items={[
          { id: "a", label: "Editar", onSelect: vi.fn() },
          { id: "b", label: "Suspender", tone: "danger", onSelect: vi.fn() },
          { id: "c", label: "Excluir", tone: "danger", onSelect: vi.fn() },
        ]}
      />,
    );
    await user.click(trigger());
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });

  it("ícone por nome do protótipo ou elemento pronto", async () => {
    const user = userEvent.setup();
    render(
      <AdminActionMenu
        items={[
          { id: "a", label: "Fechar", icon: "x", onSelect: vi.fn() },
          { id: "b", label: "Outro", icon: <svg data-testid="custom" />, onSelect: vi.fn() },
        ]}
      />,
    );
    await user.click(trigger());
    expect(screen.getByRole("menuitem", { name: "Fechar" }).querySelector("svg")).not.toBeNull();
    expect(screen.getByTestId("custom")).toBeInTheDocument();
  });
});

describe("AdminActionMenu: menu de ordenação (triggerIcon, round e selected)", () => {
  it("o gatilho só-ícone pode trocar o ícone e ser redondo", () => {
    const { items } = makeItems();
    render(<AdminActionMenu items={items} iconOnly round triggerIcon="sort" ariaLabel="Ordenar" />);
    const button = screen.getByRole("button", { name: "Ordenar" });
    expect(button).toHaveAttribute("data-round", "true");
    expect(button).toHaveAttribute("data-icon-only", "true");
  });

  it("a opção escolhida leva aria-current e um ✓; as outras não", async () => {
    const { items } = makeItems({ archive: { selected: true } });
    const user = userEvent.setup();
    render(<AdminActionMenu items={items} />);
    await user.click(trigger());
    const chosen = await screen.findByRole("menuitem", { name: "Arquivar" });
    expect(chosen).toHaveAttribute("aria-current", "true");
    expect(chosen.querySelector(".adm-actmenu-sel")).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: "Editar" })).not.toHaveAttribute("aria-current");
  });
});

describe("AdminActionMenu: grupos e texto curto", () => {
  it("mostra o título do grupo uma vez, antes do primeiro item, e o texto curto (o nome acessível segue completo)", async () => {
    const user = userEvent.setup();
    render(
      <AdminActionMenu
        ariaLabel="Ordenar"
        iconOnly
        items={[
          { id: "a", label: "Cadastro: mais recentes", shortLabel: "Mais recentes", group: "Cadastro", onSelect: vi.fn() },
          { id: "b", label: "Cadastro: mais antigos", shortLabel: "Mais antigos", group: "Cadastro", onSelect: vi.fn() },
          { id: "c", label: "Nome: A–Z", shortLabel: "A–Z", group: "Nome", onSelect: vi.fn() },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ordenar" }));
    const titles = Array.from(document.querySelectorAll(".adm-actmenu-group")).map((el) => el.textContent);
    expect(titles).toEqual(["Cadastro", "Nome"]);
    const first = await screen.findByRole("menuitem", { name: "Cadastro: mais recentes" });
    expect(first).toHaveTextContent("Mais recentes");
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminLoadMore } from "./admin-load-more";

const css = readFileSync(resolve(__dirname, "../../../styles/admin-kit-load-more.css"), "utf8");

type Props = React.ComponentProps<typeof AdminLoadMore>;

function setup(props: Partial<Props> = {}) {
  const onLoadMore = vi.fn();
  const base: Props = { loaded: 25, hasMore: true, loading: false, onLoadMore };
  const view = render(<AdminLoadMore {...base} {...props} />);
  const rerender = (next: Partial<Props>) => view.rerender(<AdminLoadMore {...base} {...props} {...next} />);
  return { ...view, onLoadMore, rerender };
}

describe("AdminLoadMore: contador", () => {
  it("sem total: 'N carregados'", () => {
    setup({ loaded: 25 });
    expect(screen.getByRole("status")).toHaveTextContent("25 carregados");
  });

  it("com total: 'N de M', com milhares separados", () => {
    setup({ loaded: 25, total: 1340 });
    expect(screen.getByRole("status")).toHaveTextContent("25 de 1.340");
  });

  it("com o substantivo: 'N de M eventos' e 'N eventos carregados'", () => {
    const noun = { singular: "evento", plural: "eventos" };
    const { unmount } = setup({ loaded: 25, total: 90, noun });
    expect(screen.getByRole("status")).toHaveTextContent("25 de 90 eventos");
    unmount();
    setup({ loaded: 25, noun });
    expect(screen.getByRole("status")).toHaveTextContent("25 eventos carregados");
  });

  it("concorda singular e feminino", () => {
    const { unmount } = setup({ loaded: 1, noun: { singular: "movimentação", plural: "movimentações", feminine: true } });
    expect(screen.getByRole("status")).toHaveTextContent("1 movimentação carregada");
    unmount();
    setup({ loaded: 2, noun: { singular: "movimentação", plural: "movimentações", feminine: true } });
    expect(screen.getByRole("status")).toHaveTextContent("2 movimentações carregadas");
  });

  it("na última página: 'fim da lista' e o botão some", () => {
    setup({ loaded: 90, total: 90, hasMore: false });
    expect(screen.getByRole("status")).toHaveTextContent("90 carregados · fim da lista");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("um total menor que o carregado (dado velho) é ignorado em vez de mostrar '25 de 10'", () => {
    setup({ loaded: 25, total: 10 });
    expect(screen.getByRole("status")).toHaveTextContent("25 carregados");
  });

  it("lista vazia e sem mais páginas não renderiza nada", () => {
    const { container } = setup({ loaded: 0, hasMore: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("o contador é uma região viva educada e lida inteira", () => {
    setup();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  it("o texto do contador não muda enquanto carrega (nada a anunciar até chegar a página)", () => {
    const { rerender } = setup({ loaded: 25, total: 90 });
    const before = screen.getByRole("status").textContent;
    rerender({ loading: true });
    expect(screen.getByRole("status").textContent).toBe(before);
    rerender({ loading: false, loaded: 50 });
    expect(screen.getByRole("status")).toHaveTextContent("50 de 90");
  });
});

describe("AdminLoadMore: botão", () => {
  it("clique chama onLoadMore", async () => {
    const { onLoadMore } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("funciona só com o teclado (Tab, Enter e Espaço)", async () => {
    const { onLoadMore } = setup();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Carregar mais" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it("carregando: spinner, texto 'Carregando…', aria-disabled, e o clique é ignorado", async () => {
    const { onLoadMore, container } = setup({ loading: true });
    const button = screen.getByRole("button", { name: "Carregando…" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(container.querySelector(".adm-lm-spin")).toHaveAttribute("aria-hidden", "true");
    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("o foco permanece no botão quando começa a carregar (não é `disabled`)", async () => {
    const { rerender } = setup();
    await userEvent.tab();
    const button = screen.getByRole("button");
    expect(button).toHaveFocus();
    rerender({ loading: true });
    expect(screen.getByRole("button")).toBe(button);
    expect(button).toHaveFocus();
    expect(button).not.toBeDisabled();
  });

  it("quando a lista cresce o foco não salta", async () => {
    const { rerender } = setup({ loaded: 25 });
    await userEvent.tab();
    const button = screen.getByRole("button");
    rerender({ loading: true });
    rerender({ loading: false, loaded: 50 });
    expect(screen.getByRole("button", { name: "Carregar mais" })).toBe(button);
    expect(button).toHaveFocus();
  });

  it("na última página o foco vai para o contador, não para o body", async () => {
    const { rerender } = setup({ loaded: 25 });
    await userEvent.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    rerender({ loading: false, loaded: 30, hasMore: false });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("fim da lista");
  });

  it("o foco chega ao contador mesmo que o navegador dispare `blur` na remoção (Chrome), com o botão ainda conectado", async () => {
    const { rerender } = setup({ loaded: 25 });
    await userEvent.tab();
    const button = screen.getByRole("button");
    expect(button).toHaveFocus();
    fireEvent.blur(button); // o foco real ainda está no botão: só o evento chegou
    rerender({ loading: false, loaded: 30, hasMore: false });
    expect(screen.getByRole("status")).toHaveFocus();
  });

  it("na última página, quem não estava no botão não tem o foco roubado", async () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    const { rerender } = setup({ loaded: 25 });
    rerender({ loaded: 30, hasMore: false });
    expect(outside).toHaveFocus();
    outside.remove();
  });
});

describe("CSS do 'Carregar mais'", () => {
  it("foco com o anel do kit, alvo de toque do kit e giro desligado com movimento reduzido", () => {
    expect(css).toMatch(/\.adm-lm-btn:focus-visible[^}]*box-shadow:\s*var\(--adm-ring\)/);
    expect(css).toMatch(/min-height:\s*var\(--adm-hit\)/);
    expect(css.slice(css.indexOf("@media (prefers-reduced-motion"))).toMatch(/\.adm-lm-spin\s*\{\s*animation:\s*none/);
  });

  it("sem sombra, e tudo sob .pv", () => {
    expect(css).not.toMatch(/box-shadow:\s*0/);
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/^[^\s@{}][^{}]*(?=\{)/gm) ?? [];
    selectors.forEach((selector) => expect(selector.trim()).toMatch(/^\.pv /));
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminRefreshButton } from "./admin-refresh-button";

const status = () => screen.getByRole("status");

describe("AdminRefreshButton", () => {
  it("botão 'Atualizar' que chama onClick", async () => {
    const onClick = vi.fn();
    render(<AdminRefreshButton onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Atualizar" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("aceita outro texto", () => {
    render(<AdminRefreshButton onClick={() => {}} label="Atualizar lista" />);
    expect(screen.getByRole("button", { name: "Atualizar lista" })).toBeInTheDocument();
  });

  it("funciona pelo teclado: Enter e Espaço", async () => {
    const onClick = vi.fn();
    render(<AdminRefreshButton onClick={onClick} />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "Atualizar" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("só ícone: o nome acessível e a dica vêm do rótulo e não há texto visível", () => {
    render(<AdminRefreshButton onClick={() => {}} iconOnly label="Atualizar atividades" />);
    const button = screen.getByRole("button", { name: "Atualizar atividades" });
    expect(button).toHaveAttribute("title", "Atualizar atividades");
    expect(button).toHaveAttribute("data-icon-only", "true");
    expect(button).toHaveTextContent("");
  });

  it("com texto não repete o rótulo em `title` nem em aria-label", () => {
    render(<AdminRefreshButton onClick={() => {}} />);
    const button = screen.getByRole("button", { name: "Atualizar" });
    expect(button).not.toHaveAttribute("title");
    expect(button).not.toHaveAttribute("aria-label");
  });

  it("ao abrir a página a região de status existe e está vazia (nada é lido)", () => {
    render(<AdminRefreshButton onClick={() => {}} />);
    expect(status()).toBeEmptyDOMElement();
    const loading = render(<AdminRefreshButton onClick={() => {}} loading />);
    expect(loading.getAllByRole("status")[1]).toBeEmptyDOMElement();
  });

  it("montou já atualizando: o fim da primeira carga não é anunciado, as seguintes são", () => {
    const { rerender } = render(<AdminRefreshButton onClick={() => {}} loading />);
    rerender(<AdminRefreshButton onClick={() => {}} />);
    expect(status()).toBeEmptyDOMElement();
    rerender(<AdminRefreshButton onClick={() => {}} loading />);
    expect(status()).toHaveTextContent("Atualizando…");
    rerender(<AdminRefreshButton onClick={() => {}} />);
    expect(status()).toHaveTextContent("Atualizado");
  });

  it("atualizando: aria-busy, aria-disabled, clique ignorado e o foco continua no botão", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<AdminRefreshButton onClick={onClick} />);
    const user = userEvent.setup();
    await user.tab();
    const button = screen.getByRole("button", { name: "Atualizar" });
    expect(button).toHaveFocus();
    expect(button).not.toHaveAttribute("aria-busy");

    rerender(<AdminRefreshButton onClick={onClick} loading />);
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    // `disabled` nativo tiraria o foco do teclado: o botão segue focado
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();

    await user.click(button);
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("o texto de status só muda quando o estado muda: Atualizando… e depois Atualizado", () => {
    const { rerender } = render(<AdminRefreshButton onClick={() => {}} />);
    expect(status()).toHaveTextContent("");

    rerender(<AdminRefreshButton onClick={() => {}} loading />);
    expect(status()).toHaveTextContent("Atualizando…");

    // re-render com o mesmo estado não mexe no texto
    rerender(<AdminRefreshButton onClick={() => {}} loading label="Atualizar" />);
    expect(status()).toHaveTextContent("Atualizando…");

    rerender(<AdminRefreshButton onClick={() => {}} />);
    expect(status()).toHaveTextContent("Atualizado");
    expect(screen.getByRole("button", { name: "Atualizar" })).not.toHaveAttribute("aria-busy");
  });

  it("os textos de status podem ser trocados e ficam só para leitor de tela", () => {
    const { rerender } = render(<AdminRefreshButton onClick={() => {}} loadingLabel="Buscando…" doneLabel="Pronto" />);
    rerender(<AdminRefreshButton onClick={() => {}} loading loadingLabel="Buscando…" doneLabel="Pronto" />);
    expect(status()).toHaveTextContent("Buscando…");
    expect(status()).toHaveClass("adm-sr");
    rerender(<AdminRefreshButton onClick={() => {}} loadingLabel="Buscando…" doneLabel="Pronto" />);
    expect(status()).toHaveTextContent("Pronto");
  });

  it("o nome visível não troca durante a atualização (o nome acessível fica estável)", () => {
    render(<AdminRefreshButton onClick={() => {}} loading />);
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeInTheDocument();
  });

  it("announce={false}: a região de status existe, mas não anuncia nada (refetch automático)", () => {
    const { rerender } = render(<AdminRefreshButton onClick={() => {}} announce={false} />);
    expect(status()).toBeEmptyDOMElement();
    rerender(<AdminRefreshButton onClick={() => {}} announce={false} loading />);
    expect(status()).toBeEmptyDOMElement();
    // o estado visual/AT do botão continua valendo
    expect(screen.getByRole("button", { name: "Atualizar" })).toHaveAttribute("aria-busy", "true");
    rerender(<AdminRefreshButton onClick={() => {}} announce={false} />);
    expect(status()).toBeEmptyDOMElement();
  });

  it("announce padrão é true; ligar o anúncio depois volta a anunciar o próximo ciclo", () => {
    const { rerender } = render(<AdminRefreshButton onClick={() => {}} announce={false} />);
    rerender(<AdminRefreshButton onClick={() => {}} announce={false} loading />);
    rerender(<AdminRefreshButton onClick={() => {}} announce={false} />);
    rerender(<AdminRefreshButton onClick={() => {}} loading />);
    expect(status()).toHaveTextContent("Atualizando…");
  });

  it("desabilitado de verdade fica fora do teclado e não clica", async () => {
    const onClick = vi.fn();
    render(<AdminRefreshButton onClick={onClick} disabled />);
    const button = screen.getByRole("button", { name: "Atualizar" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("CSS do AdminRefreshButton", () => {
  // O Vitest entrega CSS vazio por import: lê do disco.
  const css = readFileSync(resolve(__dirname, "../../../styles/admin-kit-refresh-button.css"), "utf8");

  it("tem um giro só e respeita prefers-reduced-motion", () => {
    expect(css.match(/@keyframes adm-refresh-spin/g)).toHaveLength(1);
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\[aria-busy="true"\] \.ico \{ animation: none/);
  });

  it("alvo de toque do token e anel de foco do kit", () => {
    expect(css).toMatch(/height: var\(--adm-hit\)/);
    expect(css).toMatch(/:focus-visible \{ outline: 0; box-shadow: var\(--adm-ring\)/);
  });
});

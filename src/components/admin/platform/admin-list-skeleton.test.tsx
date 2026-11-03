import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminListSkeleton } from "./admin-list-skeleton";

const css = readFileSync(resolve(__dirname, "../../../styles/admin-kit-list-skeleton.css"), "utf8");

describe("AdminListSkeleton", () => {
  it("é uma única região de status com 'Carregando…' lido uma vez", () => {
    render(<AdminListSkeleton />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getAllByText("Carregando…")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(/^Carregando…$/);
  });

  it("o texto fica em .adm-sr e os blocos são decorativos (aria-hidden)", () => {
    const { container } = render(<AdminListSkeleton rows={2} />);
    expect(screen.getByText("Carregando…")).toHaveClass("adm-sr");
    const blocks = container.querySelectorAll(".adm-sk");
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((block) => expect(block).toHaveAttribute("aria-hidden", "true"));
  });

  it("não marca a região viva como ocupada (leitores de tela calariam o anúncio)", () => {
    render(<AdminListSkeleton />);
    expect(screen.getByRole("status")).not.toHaveAttribute("aria-busy");
  });

  it("ariaLabel troca o texto lido, sem duplicá-lo", () => {
    render(<AdminListSkeleton ariaLabel="Carregando alertas…" />);
    expect(screen.getAllByText("Carregando alertas…")).toHaveLength(1);
    expect(screen.queryByText("Carregando…")).not.toBeInTheDocument();
  });

  it("rows define quantas linhas: 5 por padrão, e o valor é limitado entre 1 e 30", () => {
    const { container, rerender } = render(<AdminListSkeleton />);
    expect(container.querySelectorAll(".adm-lsk-row")).toHaveLength(5);
    rerender(<AdminListSkeleton rows={3} />);
    expect(container.querySelectorAll(".adm-lsk-row")).toHaveLength(3);
    rerender(<AdminListSkeleton rows={0} />);
    expect(container.querySelectorAll(".adm-lsk-row")).toHaveLength(1);
    rerender(<AdminListSkeleton rows={500} />);
    expect(container.querySelectorAll(".adm-lsk-row")).toHaveLength(30);
    rerender(<AdminListSkeleton rows={Number.NaN} />);
    expect(container.querySelectorAll(".adm-lsk-row")).toHaveLength(5);
  });

  it("cada variante desenha o seu formato", () => {
    const { container, rerender } = render(<AdminListSkeleton rows={1} variant="rows" />);
    expect(container.querySelector(".adm-lsk")).toHaveAttribute("data-variant", "rows");
    expect(container.querySelector(".adm-lsk-dot")).toBeNull();
    expect(container.querySelector(".adm-lsk-tags")).toBeNull();

    rerender(<AdminListSkeleton rows={1} variant="timeline" />);
    expect(container.querySelector(".adm-lsk")).toHaveAttribute("data-variant", "timeline");
    expect(container.querySelector(".adm-lsk-dot")).not.toBeNull();

    rerender(<AdminListSkeleton rows={1} variant="alerts" />);
    expect(container.querySelector(".adm-lsk")).toHaveAttribute("data-variant", "alerts");
    expect(container.querySelectorAll(".adm-lsk-tags .adm-sk")).toHaveLength(1);
  });

  it("alerts: um selo por linha, em todas as linhas", () => {
    const { container } = render(<AdminListSkeleton rows={4} variant="alerts" />);
    expect(container.querySelectorAll(".adm-lsk-row")).toHaveLength(4);
    container.querySelectorAll(".adm-lsk-row").forEach((row) => expect(row.querySelectorAll(".adm-lsk-tags .adm-sk")).toHaveLength(1));
  });

  it("strip: uma faixa de 4 itens curtos lado a lado, sem linhas; rows não vale", () => {
    const { container } = render(<AdminListSkeleton variant="strip" rows={9} ariaLabel="Carregando o sistema…" />);
    expect(container.querySelector(".adm-lsk")).toHaveAttribute("data-variant", "strip");
    expect(container.querySelectorAll(".adm-lsk-strip")).toHaveLength(1);
    const cells = container.querySelectorAll(".adm-lsk-cell");
    expect(cells).toHaveLength(4);
    cells.forEach((cell) => expect(cell.querySelectorAll(".adm-sk")).toHaveLength(2));
    expect(container.querySelectorAll(".adm-lsk-row")).toHaveLength(0);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(/^Carregando o sistema…$/);
    container.querySelectorAll(".adm-sk").forEach((block) => expect(block).toHaveAttribute("aria-hidden", "true"));
  });

  it("é determinístico: as mesmas larguras em toda renderização", () => {
    const first = render(<AdminListSkeleton rows={4} />).container.innerHTML;
    const second = render(<AdminListSkeleton rows={4} />).container.innerHTML;
    expect(second).toBe(first);
  });
});

describe("CSS do esqueleto de lista", () => {
  it("a faixa tem 4 colunas e cai para 2 no celular", () => {
    expect(css).toMatch(/\.adm-lsk-strip\s*\{[^}]*repeat\(4,/);
    const mobile = css.slice(css.indexOf("@media (max-width: 560px)"));
    expect(mobile).toMatch(/\.adm-lsk-strip\s*\{[^}]*repeat\(2,/);
  });

  it("tira a animação sob prefers-reduced-motion", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion"));
    expect(block).toMatch(/\.adm-sk\s*\{\s*animation:\s*none/);
  });

  it("tudo sob .pv, sem hex solto nem sombra", () => {
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/^[^\s@{}][^{}]*(?=\{)/gm) ?? [];
    expect(selectors.length).toBeGreaterThan(0);
    selectors.forEach((selector) => expect(selector.trim()).toMatch(/^\.pv /));
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/box-shadow:\s*0/);
  });
});

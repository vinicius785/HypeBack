import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminInfoPopover } from "./admin-info-popover";

afterEach(() => vi.restoreAllMocks());

describe("AdminInfoPopover", () => {
  it("nome acessível padrão: 'Como é calculado: <label>'", () => {
    render(<AdminInfoPopover label="Aportes recebidos">Soma dos aportes.</AdminInfoPopover>);
    const info = screen.getByRole("button", { name: "Como é calculado: Aportes recebidos" });
    expect(info).toHaveAccessibleDescription("Soma dos aportes.");
  });

  it("prefix troca o início; prefix vazio usa só o label", () => {
    const { rerender } = render(
      <AdminInfoPopover label="Liberado e pago" prefix="Entenda">
        x
      </AdminInfoPopover>,
    );
    expect(screen.getByRole("button", { name: "Entenda: Liberado e pago" })).toBeInTheDocument();
    rerender(
      <AdminInfoPopover label="Linha do tempo" prefix="">
        x
      </AdminInfoPopover>,
    );
    expect(screen.getByRole("button", { name: "Linha do tempo" })).toBeInTheDocument();
  });

  it("triggerLabel substitui o nome inteiro (prefix e label ignorados)", () => {
    render(
      <AdminInfoPopover label="Workspaces" prefix="Entenda" triggerLabel="Quem são os outros 3 workspaces">
        Lista dos demais.
      </AdminInfoPopover>,
    );
    expect(screen.getByRole("button", { name: "Quem são os outros 3 workspaces" })).toHaveAccessibleDescription("Lista dos demais.");
    expect(screen.queryByRole("button", { name: /Como é calculado/ })).toBeNull();
  });

  it("sem label nem triggerLabel o nome cai no prefix", () => {
    render(<AdminInfoPopover>x</AdminInfoPopover>);
    expect(screen.getByRole("button", { name: "Como é calculado" })).toBeInTheDocument();
  });

  it("vários parágrafos dentro de um <p> não geram <p> aninhado nem aviso do React", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <p>
        Subtítulo{" "}
        <AdminInfoPopover label="Subtítulo">
          <AdminInfoPopover.Paragraph>Primeiro.</AdminInfoPopover.Paragraph>
          <AdminInfoPopover.Paragraph>Segundo.</AdminInfoPopover.Paragraph>
        </AdminInfoPopover>
      </p>,
    );
    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelectorAll("p p")).toHaveLength(0);
    expect(container.querySelectorAll(".adm-info-p")).toHaveLength(2);
    expect(container.querySelector(".adm-info-p")?.tagName).toBe("SPAN");
    expect(screen.getByRole("button")).toHaveAccessibleDescription(/Primeiro\.\s*Segundo\./);
  });

  it("o balão repete os parágrafos e não entra na árvore de acessibilidade", async () => {
    const user = userEvent.setup();
    render(
      <AdminInfoPopover label="X">
        <AdminInfoPopover.Paragraph>Um.</AdminInfoPopover.Paragraph>
        <AdminInfoPopover.Paragraph className="realce">Dois.</AdminInfoPopover.Paragraph>
      </AdminInfoPopover>,
    );
    await user.tab();
    await user.keyboard("{Enter}");
    const pop = document.querySelector(".adm-pop") as HTMLElement;
    expect(pop).toHaveAttribute("aria-hidden", "true");
    expect(pop.querySelectorAll(".adm-info-p")).toHaveLength(2);
    expect(pop.querySelector(".realce")).toHaveClass("adm-info-p");
    await user.keyboard("{Escape}");
    expect(document.querySelector(".adm-pop")).toBeNull();
    expect(screen.getByRole("button")).toHaveFocus();
  });
});

describe("CSS do AdminInfoPopover", () => {
  const css = readFileSync(resolve(__dirname, "../../../styles/admin-kit-info-popover.css"), "utf8");

  it("parágrafo em bloco, sob .pv, com especificidade baixa para o realce ganhar", () => {
    expect(css).toMatch(/\.pv \.adm-info-p \{ display: block; margin: 0; \}/);
    expect(css).toMatch(/\.pv \.adm-pop :where\(\.adm-info-p \+ \.adm-info-p\)/);
  });
});

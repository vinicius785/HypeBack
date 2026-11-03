import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminEntityCell } from "./admin-entity-cell";

describe("AdminEntityCell: selo e apoio em 2 linhas", () => {
  it("sem badge o nome segue direto no texto (estrutura de antes)", () => {
    const { container } = render(<AdminEntityCell name="Acme" subtitle="dono@acme.com" />);
    expect(container.querySelector(".adm-entity-title")).toBeNull();
    expect(container.querySelector(".adm-entity-text > b")).toHaveTextContent("Acme");
    expect(container.querySelector("small")).not.toHaveAttribute("data-wrap");
  });

  it("badge aparece ao lado do nome, depois dele", () => {
    const { container } = render(<AdminEntityCell name="Acme" badge={<span>Verificado</span>} />);
    const title = container.querySelector(".adm-entity-title") as HTMLElement;
    expect(title).toBeInTheDocument();
    expect(title.firstElementChild?.tagName).toBe("B");
    expect(title.firstElementChild).toHaveAttribute("title", "Acme");
    expect(screen.getByText("Verificado").closest(".adm-entity-badge")).toBeInTheDocument();
  });

  it("subtitleWrap marca o apoio para até 2 linhas", () => {
    const { container } = render(<AdminEntityCell name="Acme" subtitle="Texto longo de apoio" subtitleWrap />);
    expect(container.querySelector("small")).toHaveAttribute("data-wrap", "true");
  });

  it("subtitleWrap sem subtitle não cria nada", () => {
    const { container } = render(<AdminEntityCell name="Acme" subtitleWrap badge="Novo" />);
    expect(container.querySelector("small")).toBeNull();
  });
});

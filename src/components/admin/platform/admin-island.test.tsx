import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/styles/management-board.css", () => ({}));
vi.mock("@/styles/admin-island.css", () => ({}));
vi.mock("@/styles/admin-island-bar.css", () => ({}));

import { AdminIsland } from "./admin-island";

function setup(props: Partial<Parameters<typeof AdminIsland>[0]> = {}) {
  return render(
    <AdminIsland
      ariaLabel="Teste"
      sheetLabel="Folha"
      chevronLabel={{ open: "Abrir", close: "Fechar" }}
      start={<button type="button">Pílula</button>}
      end={<span>Número vivo</span>}
      sheet={<p>Conteúdo da folha</p>}
      {...props}
    />,
  );
}

describe("AdminIsland (casca das ilhas)", () => {
  it("cabeçalho: início, fim e, por último, a seta de expandir (sempre no canto direito)", () => {
    setup();
    const region = screen.getByRole("region", { name: "Teste" });
    expect(region).toHaveClass("isl", "isl-x");
    const header = region.querySelector(".isl-x-h") as HTMLElement;
    expect(Array.from(header.children).map((c) => c.className)).toEqual(["isl-x-start", "isl-x-end", "isl-chev isl-x-chev"]);
    expect(within(header).getByRole("button", { name: "Abrir" })).toBe(header.lastElementChild);
  });

  it("a folha abre e fecha pela seta (e fica inerte enquanto fechada)", async () => {
    setup();
    const toggle = screen.getByRole("button", { name: "Abrir" });
    const sheet = screen.getByRole("region", { name: "Folha" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(sheet).toHaveAttribute("inert");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveAttribute("aria-expanded", "true");
    expect(sheet).not.toHaveAttribute("inert");
    expect(screen.getByRole("region", { name: "Teste" })).toHaveClass("isl-open");
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(sheet).toHaveAttribute("inert");
  });

  it("controlada: avisa a tela quando abre (para pedir dados só então)", async () => {
    const onOpenChange = vi.fn();
    setup({ open: false, onOpenChange });
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("a segunda linha só existe com `tools` (ou o encaixe `toolsRef`)", () => {
    const { unmount } = setup();
    expect(document.querySelector(".isl-tools")).toBeNull();
    unmount();
    setup({ tools: <input aria-label="Buscar" /> });
    expect(within(document.querySelector(".isl-tools") as HTMLElement).getByLabelText("Buscar")).toBeInTheDocument();
  });

  it("`still` tira a animação de entrada; sem `end`, não sobra bloco vazio", () => {
    setup({ still: true, end: undefined });
    expect(screen.getByRole("region", { name: "Teste" })).toHaveClass("isl-still");
    expect(document.querySelector(".isl-x-end")).toBeNull();
  });
});

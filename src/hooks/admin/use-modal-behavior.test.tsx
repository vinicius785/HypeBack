import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useModalBehavior } from "./use-modal-behavior";

function Harness({ onEscape }: { onEscape: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalBehavior({ open: true, containerRef: ref, onEscape });
  return (
    <div ref={ref} role="dialog" aria-label="Diálogo">
      <button type="button">Primeiro</button>
    </div>
  );
}

describe("useModalBehavior", () => {
  it("Escape chama onEscape", () => {
    const onEscape = vi.fn();
    render(<Harness onEscape={onEscape} />);
    fireEvent.keyDown(screen.getByText("Primeiro"), { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("com um popover do kit aberto (portal fora do diálogo), Escape é do popover e o diálogo continua", () => {
    const onEscape = vi.fn();
    render(<Harness onEscape={onEscape} />);
    const layer = document.createElement("div");
    layer.setAttribute("data-adm-layer", "");
    document.body.appendChild(layer);
    fireEvent.keyDown(screen.getByText("Primeiro"), { key: "Escape" });
    expect(onEscape).not.toHaveBeenCalled();
    layer.remove();
    fireEvent.keyDown(screen.getByText("Primeiro"), { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("Tab que vem de dentro de um popover não puxa o foco de volta ao diálogo", () => {
    render(<Harness onEscape={() => {}} />);
    const layer = document.createElement("div");
    layer.setAttribute("data-adm-layer", "");
    const input = document.createElement("input");
    layer.appendChild(input);
    document.body.appendChild(layer);
    input.focus();
    fireEvent.keyDown(input, { key: "Tab" });
    expect(document.activeElement).toBe(input);
    layer.remove();
  });
});

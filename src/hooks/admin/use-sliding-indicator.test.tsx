import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSlidingIndicator } from "./use-sliding-indicator";

/** O jsdom não faz layout: cada botão informa a sua geometria por `data-left`/`data-width`. */
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return Number((this as HTMLElement).dataset.width ?? 0);
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
    configurable: true,
    get() {
      return Number((this as HTMLElement).dataset.left ?? 0);
    },
  });
});

afterEach(() => {
  // @ts-expect-error: devolve o comportamento do jsdom
  delete HTMLElement.prototype.offsetWidth;
  // @ts-expect-error: devolve o comportamento do jsdom
  delete HTMLElement.prototype.offsetLeft;
});

function Tabs({ active }: { active: "a" | "b" }) {
  const { containerRef, indicatorRef } = useSlidingIndicator<HTMLDivElement>(active, "a|b", "[aria-selected='true']");
  return (
    <div ref={containerRef} data-testid="tabs">
      <button aria-selected={active === "a"} data-left="0" data-width="90">
        A
      </button>
      <button aria-selected={active === "b"} data-left="100" data-width="140">
        B
      </button>
      <i ref={indicatorRef} data-testid="indicator" />
    </div>
  );
}

describe("useSlidingIndicator", () => {
  it("posiciona o indicador sob o item ativo e o acompanha quando o ativo muda", () => {
    const view = render(<Tabs active="a" />);
    const indicator = view.getByTestId("indicator");
    expect(indicator.style.width).toBe("90px");
    expect(indicator.style.transform).toBe("translateX(0px)");

    view.rerender(<Tabs active="b" />);
    expect(indicator.style.width).toBe("140px");
    expect(indicator.style.transform).toBe("translateX(100px)");
  });

  it("a primeira posição não anima (o indicador não 'cresce' de largura 0 ao abrir a página); as trocas seguintes animam", () => {
    const writes: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, "transition");
    // Só registra as escritas em `transition`; o comportamento original continua valendo.
    const setter = vi.fn(function (this: CSSStyleDeclaration, value: string) {
      writes.push(value);
      descriptor?.set?.call(this, value);
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "transition", { configurable: true, get: descriptor?.get, set: setter });

    try {
      const view = render(<Tabs active="a" />);
      // Desliga durante o posicionamento inicial e devolve a transição do CSS logo depois.
      expect(writes).toEqual(["none", ""]);
      expect(view.getByTestId("indicator").style.transition).toBe("");

      view.rerender(<Tabs active="b" />);
      // Trocar de item não mexe na transição: o CSS anima.
      expect(writes).toEqual(["none", ""]);
    } finally {
      if (descriptor) Object.defineProperty(CSSStyleDeclaration.prototype, "transition", descriptor);
    }
  });

  it("remede quando a janela é redimensionada", () => {
    const view = render(<Tabs active="a" />);
    const indicator = view.getByTestId("indicator");
    view.getByText("A").dataset.width = "120";
    window.dispatchEvent(new Event("resize"));
    expect(indicator.style.width).toBe("120px");
  });

  it("sem item ativo (valor que não existe) não quebra nem mexe no indicador", () => {
    function Empty() {
      const { containerRef, indicatorRef } = useSlidingIndicator<HTMLDivElement>("x", "", "[aria-selected='true']");
      return (
        <div ref={containerRef}>
          <button aria-selected={false}>A</button>
          <i ref={indicatorRef} data-testid="indicator" />
        </div>
      );
    }
    const view = render(<Empty />);
    expect(view.getByTestId("indicator").style.width).toBe("");
  });
});

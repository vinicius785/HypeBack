import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useScrollEdges } from "./use-scroll-edges";

/** O jsdom não faz layout: a geometria da lista é informada pelo teste. */
function setGeometry(el: HTMLElement, geometry: { scrollTop: number; clientHeight: number; scrollHeight: number }) {
  Object.defineProperty(el, "clientHeight", { configurable: true, value: geometry.clientHeight });
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: geometry.scrollHeight });
  el.scrollTop = geometry.scrollTop;
}

function Probe() {
  const { ref, edges } = useScrollEdges<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="list" data-before={edges.before ? "true" : undefined} data-after={edges.after ? "true" : undefined}>
      itens
    </div>
  );
}

function setup(geometry: { scrollTop: number; clientHeight: number; scrollHeight: number }) {
  const view = render(<Probe />);
  const list = view.getByTestId("list");
  setGeometry(list, geometry);
  // Uma nova renderização remede (é o que acontece quando o menu muda).
  view.rerender(<Probe />);
  return { list, view };
}

describe("useScrollEdges", () => {
  it("lista maior que a área, no topo: continua para baixo (e só para baixo)", () => {
    const { list } = setup({ scrollTop: 0, clientHeight: 300, scrollHeight: 600 });
    expect(list).toHaveAttribute("data-after", "true");
    expect(list).not.toHaveAttribute("data-before");
  });

  it("no meio: continua para os dois lados", () => {
    const { list } = setup({ scrollTop: 120, clientHeight: 300, scrollHeight: 600 });
    expect(list).toHaveAttribute("data-before", "true");
    expect(list).toHaveAttribute("data-after", "true");
  });

  it("no fim: só continua para cima", () => {
    const { list } = setup({ scrollTop: 300, clientHeight: 300, scrollHeight: 600 });
    expect(list).toHaveAttribute("data-before", "true");
    expect(list).not.toHaveAttribute("data-after");
  });

  it("tudo cabe: nenhuma borda (uma diferença de 1px de arredondamento não conta)", () => {
    const { list } = setup({ scrollTop: 0, clientHeight: 300, scrollHeight: 301 });
    expect(list).not.toHaveAttribute("data-before");
    expect(list).not.toHaveAttribute("data-after");
  });

  it("acompanha a rolagem e o redimensionamento da janela", () => {
    const { list } = setup({ scrollTop: 0, clientHeight: 300, scrollHeight: 600 });
    expect(list).toHaveAttribute("data-after", "true");

    act(() => {
      setGeometry(list, { scrollTop: 300, clientHeight: 300, scrollHeight: 600 });
      list.dispatchEvent(new Event("scroll"));
    });
    expect(list).toHaveAttribute("data-before", "true");
    expect(list).not.toHaveAttribute("data-after");

    // A janela cresceu e agora tudo cabe.
    act(() => {
      setGeometry(list, { scrollTop: 0, clientHeight: 600, scrollHeight: 600 });
      window.dispatchEvent(new Event("resize"));
    });
    expect(list).not.toHaveAttribute("data-before");
    expect(list).not.toHaveAttribute("data-after");
  });
});

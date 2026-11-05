import type { KeyboardCoordinateGetter } from "@dnd-kit/core";
import { describe, expect, it, vi } from "vitest";

import { columnKeyboardCoordinates } from "./board-dnd";

type Args = Parameters<KeyboardCoordinateGetter>[1];
type Context = Args["context"];

/** Quatro colunas lado a lado (o jsdom não mede nada, então o contexto do dnd-kit é montado à mão). */
function context(centerX: number, columns = ["aberto", "em_andamento", "em_aprovacao", "em_ajustes"]): Context {
  const rects = new Map(columns.map((status, i) => [`column:${status}`, { left: i * 300, top: 40, width: 280, height: 500 }]));
  rects.set("outro-alvo", { left: 5000, top: 0, width: 10, height: 10 });
  return {
    active: { id: "t1" },
    collisionRect: { left: centerX - 100, top: 100, width: 200, height: 80 },
    droppableRects: rects,
    droppableContainers: { getEnabled: () => [...rects.keys()].map((id) => ({ id })) },
  } as unknown as Context;
}

const press = (code: string, ctx: Context) => {
  const event = { code, preventDefault: vi.fn() } as unknown as KeyboardEvent;
  const result = columnKeyboardCoordinates(event, { active: "t1", currentCoordinates: { x: 0, y: 0 }, context: ctx });
  return { result, event };
};

describe("teclado no quadro", () => {
  it("seta para a direita leva o cartão ao canto da coluna seguinte", () => {
    const { result, event } = press("ArrowRight", context(140));
    expect(result).toEqual({ x: 300 + 12, y: 40 + 12 });
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("seta para a esquerda volta uma coluna", () => {
    expect(press("ArrowLeft", context(440)).result).toEqual({ x: 0 + 12, y: 40 + 12 });
  });

  it("nas pontas não anda; só colunas contam como destino (o outro alvo é ignorado)", () => {
    expect(press("ArrowLeft", context(140)).result).toBeUndefined();
    expect(press("ArrowRight", context(940)).result).toBeUndefined();
  });

  it("outras teclas ficam com o sensor", () => {
    const { result, event } = press("Space", context(140));
    expect(result).toBeUndefined();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(press("ArrowDown", context(140)).result).toBeUndefined();
  });
});

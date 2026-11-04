import { describe, expect, it } from "vitest";

import { clusterPoints } from "./cluster-points";

describe("clusterPoints", () => {
  it("separa pontos distantes e reúne os próximos, sem perder ninguém", () => {
    const out = clusterPoints(
      [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 10, y: 5 },
        { id: 3, x: 500, y: 500 },
      ],
      40,
    );
    expect(out).toHaveLength(2);
    expect(out.flatMap((c) => c.ids).sort()).toEqual([1, 2, 3]);
    expect(out.find((c) => c.ids.includes(1))?.ids).toEqual([1, 2]);
  });

  it("pontos idênticos formam um grupo só", () => {
    const out = clusterPoints([{ id: "a", x: 5, y: 5 }, { id: "b", x: 5, y: 5 }], 40);
    expect(out).toHaveLength(1);
    expect(out[0].ids).toEqual(["a", "b"]);
  });

  it("ao afastar os pontos (zoom maior) os grupos se desfazem", () => {
    const pts = (k: number) => [{ id: 1, x: 0, y: 0 }, { id: 2, x: 10 * k, y: 0 }];
    expect(clusterPoints(pts(1), 40)).toHaveLength(1);
    expect(clusterPoints(pts(8), 40)).toHaveLength(2);
  });

  it("o centro é a média dos membros", () => {
    const [c] = clusterPoints([{ id: 1, x: 0, y: 0 }, { id: 2, x: 20, y: 0 }], 40);
    expect(c.x).toBe(10);
  });
});

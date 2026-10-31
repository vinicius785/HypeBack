import { describe, expect, it } from "vitest";

import { spreadAvatars, type AvatarPoint } from "./avatar-layout";

const MIN = 40;

function minGap(points: AvatarPoint[]): number {
  let min = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      min = Math.min(min, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
    }
  }
  return min;
}

describe("spreadAvatars", () => {
  it("não mexe em quem está longe dos outros", () => {
    const pts: AvatarPoint[] = [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 200, y: 10 },
      { id: 3, x: -150, y: 300 },
    ];
    expect(spreadAvatars(pts, MIN)).toEqual(pts);
  });

  it("mostra todos mesmo com coordenadas idênticas, sem sobrepor", () => {
    const pts = Array.from({ length: 23 }, (_, i): AvatarPoint => ({ id: i, x: 500, y: 500 }));
    const out = spreadAvatars(pts, MIN);
    expect(out).toHaveLength(23);
    expect(new Set(out.map((p) => p.id)).size).toBe(23);
    expect(minGap(out)).toBeGreaterThanOrEqual(MIN - 1e-6);
  });

  it("o primeiro de um ponto fica no lugar e os outros se afastam pouco", () => {
    const pts = Array.from({ length: 12 }, (_, i): AvatarPoint => ({ id: i, x: 100, y: 100 }));
    const out = spreadAvatars(pts, MIN);
    expect(out[0]).toEqual({ id: 0, x: 100, y: 100 });
    // 12 avatares cabem num raio de poucas "casas" (nada voa para longe).
    for (const p of out) expect(Math.hypot(p.x - 100, p.y - 100)).toBeLessThan(MIN * 3);
  });

  it("separa vizinhos próximos e mantém a ordem e os ids", () => {
    const pts: AvatarPoint[] = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 10, y: 5 },
      { id: "c", x: 20, y: -5 },
      { id: "d", x: 300, y: 300 },
    ];
    const out = spreadAvatars(pts, MIN);
    expect(out.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(minGap(out)).toBeGreaterThanOrEqual(MIN - 1e-6);
    expect(out[3]).toEqual(pts[3]);
  });

  it("novos itens no fim não empurram os que já estavam posicionados", () => {
    const base = Array.from({ length: 8 }, (_, i): AvatarPoint => ({ id: i, x: 50 + i * 3, y: 50 }));
    const before = spreadAvatars(base, MIN);
    const extra: AvatarPoint[] = [...base, { id: 99, x: 52, y: 51 }, { id: 100, x: 60, y: 49 }];
    const after = spreadAvatars(extra, MIN);
    expect(after.slice(0, 8)).toEqual(before);
    expect(minGap(after)).toBeGreaterThanOrEqual(MIN - 1e-6);
  });

  it("é determinístico e aguenta uma lista grande rápido", () => {
    const pts = Array.from({ length: 800 }, (_, i): AvatarPoint => ({
      id: i,
      x: 1000 + (i % 7) * 4,
      y: 1000 + (i % 5) * 4,
    }));
    const t0 = performance.now();
    const a = spreadAvatars(pts, MIN);
    const elapsed = performance.now() - t0;
    expect(spreadAvatars(pts, MIN)).toEqual(a);
    expect(minGap(a)).toBeGreaterThanOrEqual(MIN - 1e-6);
    expect(elapsed).toBeLessThan(2000);
  });
});

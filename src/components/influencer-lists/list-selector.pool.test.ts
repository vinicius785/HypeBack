import { describe, it, expect } from "vitest";
import { runPool } from "./list-selector";

describe("runPool", () => {
  it("processa todos os itens preservando a ordem dos resultados", async () => {
    const results = await runPool(
      [1, 2, 3, 4, 5],
      async (n) => n * 2,
      2
    );
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([
      2, 4, 6, 8, 10,
    ]);
  });

  it("isola falhas por item (partial success) sem interromper os demais", async () => {
    const results = await runPool(
      [1, 2, 3],
      async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      },
      3
    );
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    expect(results[2].status).toBe("fulfilled");
  });

  it("respeita o limite de concorrência (nunca excede o teto simultâneo)", async () => {
    let active = 0;
    let peak = 0;
    await runPool(
      Array.from({ length: 10 }, (_, i) => i),
      async () => {
        active++;
        peak = Math.max(peak, active);
        await Promise.resolve();
        await Promise.resolve();
        active--;
      },
      3
    );
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("lida com lista vazia", async () => {
    const results = await runPool([], async (x) => x, 4);
    expect(results).toEqual([]);
  });
});

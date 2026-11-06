import { describe, expect, it } from "vitest";

import { historyActor, nextPanelId, panelNeighbours, recentHistory, rejectionReason, revealDelta } from "./panel-nav";

describe("panelNeighbours", () => {
  const ids = ["a", "b", "c"];
  it("devolve anterior, próximo e a posição na ordem do quadro", () => {
    expect(panelNeighbours(ids, "b")).toEqual({ position: 2, total: 3, prevId: "a", nextId: "c" });
  });
  it("nas pontas não há vizinho do outro lado", () => {
    expect(panelNeighbours(ids, "a")).toMatchObject({ prevId: null, nextId: "b" });
    expect(panelNeighbours(ids, "c")).toMatchObject({ prevId: "b", nextId: null });
  });
  it("sem seleção ou com um criador fora da lista (filtrado) não navega", () => {
    expect(panelNeighbours(ids, null)).toEqual({ position: 0, total: 3, prevId: null, nextId: null });
    expect(panelNeighbours(ids, "z")).toMatchObject({ position: 0, prevId: null, nextId: null });
  });
});

describe("nextPanelId", () => {
  it("clicar de novo no aberto recolhe; clicar em outro troca", () => {
    expect(nextPanelId("a", "a")).toBeNull();
    expect(nextPanelId("a", "b")).toBe("b");
    expect(nextPanelId(null, "b")).toBe("b");
  });
});

describe("rejectionReason", () => {
  it("usa a observação mais recente de uma recusa", () => {
    const history = [
      { status: "rejected", notes: "Perfil fora do nicho", timestamp: "2026-11-01T10:00:00Z" },
      { status: "applications", notes: "x", timestamp: "2026-11-02T10:00:00Z" },
      { status: "rejected", notes: "  Sem engajamento  ", timestamp: "2026-11-03T10:00:00Z" },
    ];
    expect(rejectionReason(history)).toEqual({ notes: "Sem engajamento", timestamp: "2026-11-03T10:00:00Z" });
  });
  it("sem observação registrada devolve null (não inventa motivo)", () => {
    expect(rejectionReason([{ status: "rejected", timestamp: "2026-11-01T10:00:00Z" }])).toBeNull();
    expect(rejectionReason(undefined)).toBeNull();
  });
});

describe("historyActor", () => {
  it("traduz a origem registrada; origem desconhecida não vira nome inventado", () => {
    expect(historyActor("backoffice")).toBe("Equipe");
    expect(historyActor("app")).toBe("Criador");
    expect(historyActor("scheduler")).toBe("Automático");
    expect(historyActor("system")).toBe("Automático");
    expect(historyActor(null)).toBeNull();
    expect(historyActor("outra")).toBeNull();
  });
});

describe("recentHistory", () => {
  it("devolve as últimas n, da mais recente para a mais antiga", () => {
    const h = [
      { id: "a", timestamp: "2026-11-01T10:00:00Z" },
      { id: "c", timestamp: "2026-11-03T10:00:00Z" },
      { id: "b", timestamp: "2026-11-02T10:00:00Z" },
    ];
    expect(recentHistory(h, 2).map((x) => x.id)).toEqual(["c", "b"]);
    expect(recentHistory(undefined, 3)).toEqual([]);
  });
});

describe("revealDelta", () => {
  const view = { left: 100, right: 900 };
  it("coluna toda à vista não rola", () => {
    expect(revealDelta({ left: 300, right: 560 }, view, 8)).toBe(0);
  });
  it("coluna cortada na direita rola até ela caber (com folga)", () => {
    expect(revealDelta({ left: 700, right: 960 }, view, 8)).toBe(68);
  });
  it("coluna cortada na esquerda rola de volta até a borda esquerda", () => {
    expect(revealDelta({ left: 40, right: 300 }, view, 8)).toBe(-68);
  });
  it("coluna mais larga que a área alinha a borda esquerda", () => {
    expect(revealDelta({ left: 300, right: 1000 }, { left: 100, right: 500 }, 8)).toBe(192);
  });
});

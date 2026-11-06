import { describe, expect, it } from "vitest";

import { nextPanelId, panelNeighbours, rejectionReason } from "./panel-nav";

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

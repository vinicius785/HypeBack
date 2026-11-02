import { describe, expect, it } from "vitest";

import { buildPageList, clampPage, pageRange, totalPagesFor } from "./pagination";

describe("totalPagesFor", () => {
  it("arredonda para cima e devolve 0 para lista vazia (como total_pages do contrato)", () => {
    expect(totalPagesFor(0, 25)).toBe(0);
    expect(totalPagesFor(1, 25)).toBe(1);
    expect(totalPagesFor(25, 25)).toBe(1);
    expect(totalPagesFor(26, 25)).toBe(2);
    expect(totalPagesFor(312, 25)).toBe(13);
    expect(totalPagesFor(100, 100)).toBe(1);
  });

  it("entradas inválidas não quebram", () => {
    expect(totalPagesFor(Number.NaN, 25)).toBe(0);
    expect(totalPagesFor(10, 0)).toBe(0);
    expect(totalPagesFor(-5, 25)).toBe(0);
  });
});

describe("clampPage", () => {
  it("mantém a página dentro de 1..total", () => {
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(-3, 10)).toBe(1);
    expect(clampPage(11, 10)).toBe(10);
    expect(clampPage(4.7, 10)).toBe(4);
    expect(clampPage(5, 0)).toBe(1);
    expect(clampPage(Number.NaN, 10)).toBe(1);
  });
});

describe("pageRange ('X–Y de Z')", () => {
  it("primeira, do meio e última página", () => {
    expect(pageRange(1, 25, 312)).toEqual({ from: 1, to: 25 });
    expect(pageRange(2, 25, 312)).toEqual({ from: 26, to: 50 });
    expect(pageRange(13, 25, 312)).toEqual({ from: 301, to: 312 });
  });

  it("página única e página quebrada", () => {
    expect(pageRange(1, 25, 7)).toEqual({ from: 1, to: 7 });
    expect(pageRange(1, 50, 50)).toEqual({ from: 1, to: 50 });
  });

  it("lista vazia é 0–0", () => {
    expect(pageRange(1, 25, 0)).toEqual({ from: 0, to: 0 });
  });

  it("página além do fim é ajustada para a última", () => {
    expect(pageRange(99, 25, 60)).toEqual({ from: 51, to: 60 });
  });
});

describe("buildPageList", () => {
  it("poucas páginas aparecem todas", () => {
    expect(buildPageList(1, 1)).toEqual([1]);
    expect(buildPageList(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPageList(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("lista vazia não tem botões", () => {
    expect(buildPageList(1, 0)).toEqual([]);
  });

  it("no começo: 1 2 3 4 5 … 20", () => {
    expect(buildPageList(1, 20)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 20]);
    expect(buildPageList(3, 20)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 20]);
    expect(buildPageList(4, 20)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 20]);
  });

  it("no meio: 1 … 9 10 11 … 20", () => {
    expect(buildPageList(10, 20)).toEqual([1, "ellipsis-start", 9, 10, 11, "ellipsis-end", 20]);
  });

  it("no fim: 1 … 16 17 18 19 20", () => {
    expect(buildPageList(20, 20)).toEqual([1, "ellipsis-start", 16, 17, 18, 19, 20]);
    expect(buildPageList(17, 20)).toEqual([1, "ellipsis-start", 16, 17, 18, 19, 20]);
  });

  it("a largura é constante (7 itens) a partir de 8 páginas", () => {
    for (let total = 8; total <= 40; total++) {
      for (let page = 1; page <= total; page++) expect(buildPageList(page, total)).toHaveLength(7);
    }
  });

  it("a página atual sempre aparece e a primeira e a última também", () => {
    for (let total = 1; total <= 40; total++) {
      for (let page = 1; page <= total; page++) {
        const items = buildPageList(page, total);
        expect(items).toContain(page);
        expect(items[0]).toBe(1);
        expect(items[items.length - 1]).toBe(total);
      }
    }
  });

  it("os números são crescentes e sem repetição", () => {
    for (let total = 1; total <= 40; total++) {
      for (let page = 1; page <= total; page++) {
        const numbers = buildPageList(page, total).filter((i): i is number => typeof i === "number");
        expect(numbers).toEqual([...new Set(numbers)].sort((a, b) => a - b));
      }
    }
  });

  it("um '…' nunca esconde uma única página (ela mesma apareceria)", () => {
    // total 9, atual 5: 1 … 4 5 6 … 9 (cada … esconde 2 páginas)
    expect(buildPageList(5, 9)).toEqual([1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 9]);
    // total 8, atual 4: 1 2 3 4 5 … 8 (o buraco da esquerda seria uma página só: mostra a página)
    expect(buildPageList(4, 8)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 8]);
  });
});

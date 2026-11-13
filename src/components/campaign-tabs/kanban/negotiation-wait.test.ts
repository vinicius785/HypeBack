/**
 * Tempo de espera das negociações de valor (Contraproposta recebida e Proposta enviada).
 *
 * O QUE PRECISA FUNCIONAR: dias desde a última mudança de status; âmbar a partir de 7, vermelho a partir de 21; do mais antigo
 * para o mais novo; resumo da coluna (total e quantos esperam 7 dias ou mais).
 * O QUE NÃO PODE ACONTECER: inventar tempo para quem veio sem histórico.
 */
import { describe, expect, it } from "vitest";

import { isNegotiationColumn, sortByWait, waitBadgeText, waitDays, waitSummary, waitText, waitTone } from "./negotiation-wait";

const NOW = new Date("2026-11-20T12:00:00Z").getTime();
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
const inf = (name: string, ...changes: number[]) => ({
  name,
  statusHistory: changes.length ? changes.map((d, i) => ({ id: String(i), status: "price_countered", timestamp: ago(d) })) : undefined,
});

describe("waitDays", () => {
  it("conta os dias desde a ÚLTIMA mudança de status", () => {
    expect(waitDays(inf("a", 60, 12), NOW)).toBe(12);
    expect(waitDays(inf("a", 0), NOW)).toBe(0);
  });

  it("sem histórico (ou com datas inválidas) não há tempo para mostrar", () => {
    expect(waitDays(inf("a"), NOW)).toBeUndefined();
    expect(waitDays({ statusHistory: [] }, NOW)).toBeUndefined();
    expect(waitDays({ statusHistory: [{ id: "1", status: "x", timestamp: "não é data" }] }, NOW)).toBeUndefined();
  });
});

describe("waitTone", () => {
  it("nada até 6 dias, âmbar a partir de 7, vermelha a partir de 21", () => {
    expect(waitTone(undefined)).toBe("none");
    expect(waitTone(0)).toBe("none");
    expect(waitTone(6)).toBe("none");
    expect(waitTone(7)).toBe("warn");
    expect(waitTone(20)).toBe("warn");
    expect(waitTone(21)).toBe("alert");
    expect(waitTone(66)).toBe("alert");
  });

  it("textos no singular e no plural", () => {
    expect(waitText(1)).toBe("há 1 dia");
    expect(waitText(9)).toBe("há 9 dias");
    expect(waitBadgeText(1)).toBe("Aguardando há 1 dia");
    expect(waitBadgeText(75)).toBe("Aguardando há 75 dias");
  });
});

describe("sortByWait", () => {
  it("quem espera há mais tempo fica no topo; sem histórico vai para o fim, na ordem em que veio", () => {
    const sorted = sortByWait([inf("novo", 2), inf("sem1"), inf("velho", 70), inf("meio", 15), inf("sem2")], NOW);
    expect(sorted.map((i) => i.name)).toEqual(["velho", "meio", "novo", "sem1", "sem2"]);
  });

  it("empate mantém a ordem original e a lista de entrada não é alterada", () => {
    const input = [inf("a", 5), inf("b", 5), inf("c", 5)];
    expect(sortByWait(input, NOW).map((i) => i.name)).toEqual(["a", "b", "c"]);
    expect(input.map((i) => i.name)).toEqual(["a", "b", "c"]);
  });
});

describe("waitSummary", () => {
  it("total e quantos esperam 7 dias ou mais (sem histórico não entra nos atrasados)", () => {
    expect(waitSummary([inf("a", 2), inf("b", 7), inf("c", 30), inf("d")], NOW)).toEqual({ total: 4, overdue: 2 });
    expect(waitSummary([], NOW)).toEqual({ total: 0, overdue: 0 });
  });

  it("só as colunas de negociação de valor", () => {
    expect(isNegotiationColumn("price_countered")).toBe(true);
    expect(isNegotiationColumn("price_proposed")).toBe(true);
    expect(isNegotiationColumn("contract_pending")).toBe(false);
  });
});

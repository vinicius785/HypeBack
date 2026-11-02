import { describe, expect, it } from "vitest";

import { AUDIT_EMPTY, buildAuditDiff, buildAuditFacts } from "./audit-diff";

/** O formatador de moeda usa espaço sem quebra entre "R$" e o valor. */
const plain = (text: string) => text.replace(/\u00a0/g, " ");

describe("buildAuditDiff", () => {
  it("só lista o que mudou, com rótulos em português e estados pelo vocabulário do Admin", () => {
    const rows = buildAuditDiff({ status: "active", name: "Café" }, { status: "suspended", name: "Café" });
    expect(rows).toEqual([{ key: "status", label: "Status", before: "Ativo", after: "Suspenso" }]);
  });

  it("campo que só existe de um lado mostra o outro como vazio", () => {
    const rows = buildAuditDiff(null, { role: "admin" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: "Papel", before: AUDIT_EMPTY });
    expect(rows[0].after).not.toBe(AUDIT_EMPTY);
  });

  it("dinheiro (*_cents) sai exato em reais", () => {
    const rows = buildAuditDiff({ balance_cents: 100_050 }, { balance_cents: 250_000 });
    expect(plain(rows[0].before)).toBe("R$ 1.000,50");
    expect(plain(rows[0].after)).toBe("R$ 2.500,00");
  });

  it("formatos inesperados nunca lançam nem viram JSON cru", () => {
    for (const value of [undefined, null, 3, "texto", [1, 2], { a: { b: { c: { d: { e: { f: 1 } } } } } }]) {
      expect(() => buildAuditDiff(value, { x: 1 })).not.toThrow();
    }
    const text = JSON.stringify(buildAuditDiff({ list: [1, 2] }, { list: [1, 2, 3] }));
    expect(text).not.toContain("[object Object]");
  });

  it("sem estados: lista vazia", () => {
    expect(buildAuditDiff(null, null)).toEqual([]);
  });
});

describe("buildAuditFacts", () => {
  it("sem impacto: nada a mostrar", () => {
    expect(buildAuditFacts(null)).toEqual([]);
  });

  it("transforma o resumo de impacto em linhas legíveis", () => {
    const facts = buildAuditFacts({ counts: { campaigns_active: 3 }, money: { custody_cents: 12_345 } });
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.some((fact) => fact.value === "3")).toBe(true);
    expect(facts.some((fact) => plain(fact.value) === "R$ 123,45")).toBe(true);
  });
});

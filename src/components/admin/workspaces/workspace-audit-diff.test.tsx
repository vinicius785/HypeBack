import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeAuditEntry } from "./test-support";
import { auditDiffRows, findAuditEntry, formatAuditValue, WorkspaceAuditDiff } from "./workspace-audit-diff";

describe("formatAuditValue", () => {
  it("valores simples e o vocabulário do contrato", () => {
    expect(formatAuditValue("status", "suspended")).toBe("Suspenso");
    expect(formatAuditValue("role", "financeiro")).toBe("Financeiro");
    expect(formatAuditValue("tax_id", "11222333000181")).toBe("11.222.333/0001-81");
    expect(formatAuditValue("postal_code", "01310100")).toBe("01310-100");
    expect(formatAuditValue("x", null)).toBe("—");
    expect(formatAuditValue("x", true)).toBe("Sim");
    expect(formatAuditValue("x", 12)).toBe("12");
    expect(formatAuditValue("x", { a: 1 })).toBe('{"a":1}');
  });
});

describe("auditDiffRows", () => {
  it("lista só os campos que mudaram", () => {
    expect(auditDiffRows({ name: "A", city: "Santos" }, { name: "B", city: "Santos" })).toEqual([
      { key: "name", label: "Nome", before: "A", after: "B", changed: true },
    ]);
  });

  it("campo que só existe de um lado também é mudança (null vira '—')", () => {
    const rows = auditDiffRows({ unit: null }, { unit: "Sala 4", city: "Santos" });
    expect(rows.map((r) => [r.label, r.before, r.after])).toEqual([
      ["Complemento", "—", "Sala 4"],
      ["Cidade", "—", "Santos"],
    ]);
  });

  it("sem o 'antes' (adicionar membro) lista o 'depois'", () => {
    expect(auditDiffRows(null, { role: "member" })).toEqual([{ key: "role", label: "Papel", before: "—", after: "Membro", changed: true }]);
  });

  it("nada guardado dos dois lados: sem linhas", () => {
    expect(auditDiffRows(null, null)).toEqual([]);
  });

  it("valor que não é objeto vira uma linha só", () => {
    expect(auditDiffRows("active", "suspended")).toHaveLength(1);
  });
});

describe("findAuditEntry", () => {
  const entries = [makeAuditEntry({ id: 7 }), makeAuditEntry({ id: 8, created_at: "2026-10-28T16:00:00.000Z", reason: "Outro motivo" })];

  it("acha pelo id do evento (action:<id>)", () => {
    expect(findAuditEntry(entries, { id: "action:8", occurred_at: "x", reason: null })?.id).toBe(8);
  });

  it("sem o id, cai no instante e no motivo; sem nada, indefinido", () => {
    expect(findAuditEntry(entries, { id: "other", occurred_at: "2026-10-28T15:30:00.000Z", reason: "Cobrança em aberto" })?.id).toBe(7);
    expect(findAuditEntry(entries, { id: "action:99", occurred_at: "2020-01-01T00:00:00.000Z", reason: null })).toBeUndefined();
  });
});

describe("WorkspaceAuditDiff", () => {
  it("mostra quem registrou, o IP e a tabela antes/depois", () => {
    render(<WorkspaceAuditDiff entry={makeAuditEntry()} />);
    expect(screen.getByText(/Registrado por Marina Albuquerque \(marina@hype.com.br\) · IP 203.0.113.10/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Antes e depois da ação" });
    expect(within(table).getByText("Estado")).toBeInTheDocument();
    expect(within(table).getByText("Ativo")).toBeInTheDocument();
    expect(within(table).getByText("Suspenso")).toBeInTheDocument();
  });

  it("sem estado guardado, avisa; o resumo de impacto fica recolhido", () => {
    render(<WorkspaceAuditDiff entry={makeAuditEntry({ before_state: null, after_state: null, impact: { custody_cents: 100 } })} />);
    expect(screen.getByText("Esta ação não guardou o estado de antes e de depois.")).toBeInTheDocument();
    expect(screen.getByText("Resumo de impacto na hora da ação")).toBeInTheDocument();
  });
});

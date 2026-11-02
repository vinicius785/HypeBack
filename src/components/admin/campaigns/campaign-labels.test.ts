import { describe, expect, it } from "vitest";

import { kanbanColumns } from "@/components/campaign-tabs/management-kanban-config";

import { PAYMENT_METHOD_OPTIONS, participationStatusGroups, paymentMethodLabel } from "./campaign-labels";

describe("paymentMethodLabel", () => {
  it("usa o nome que o assistente de campanha dá a cada modalidade", () => {
    expect(paymentMethodLabel("fixed")).toBe("Valor fixo por conteúdo");
    expect(paymentMethodLabel("individual_price")).toBe("Valor individual por criador");
    expect(paymentMethodLabel("cpm")).toBe("CPM (custo por mil)");
  });

  it("`exchange` é permuta, como no Kanban", () => {
    expect(paymentMethodLabel("exchange")).toBe(paymentMethodLabel("swap"));
    expect(paymentMethodLabel("swap")).toBe("Permuta");
  });

  it("um código que o app não conhece aparece como veio, sem inventar tradução", () => {
    expect(paymentMethodLabel("to_be_agreed")).toBe("to_be_agreed");
  });
});

describe("PAYMENT_METHOD_OPTIONS", () => {
  it("são as modalidades do assistente, na ordem dele, com valor e rótulo", () => {
    expect(PAYMENT_METHOD_OPTIONS.map((o) => o.value)).toEqual(["fixed", "price", "individual_price", "swap", "cpa", "cpm"]);
    expect(PAYMENT_METHOD_OPTIONS.every((o) => o.label.length > 0)).toBe(true);
  });
});

describe("participationStatusGroups", () => {
  const labelOf = (id: string) => kanbanColumns.find((c) => c.id === id)?.label;

  it("rotula pelo vocabulário do Kanban de gestão (o que o time do cliente vê)", () => {
    const groups = participationStatusGroups({ awaiting_content: 2, awaiting_content_approval: 1, pending_approval: 4 });
    expect(Object.fromEntries(groups.map((g) => [g.label, g.count]))).toEqual({
      [labelOf("content_pending")!]: 2,
      [labelOf("pending_approval")!]: 1,
      [labelOf("script_pending")!]: 4,
    });
  });

  it("status do backend que caem na mesma coluna somam (publicado + concluído = Publicado)", () => {
    const groups = participationStatusGroups({ published: 2, completed: 1, content_approved: 1, contents_confirmed: 2 });
    expect(groups.find((g) => g.label === labelOf("published"))?.count).toBe(3);
    expect(groups.find((g) => g.label === labelOf("content_approved"))?.count).toBe(3);
    expect(groups).toHaveLength(2);
  });

  it("segue a ordem do funil (a das colunas do Kanban), não a ordem em que o servidor mandou", () => {
    const groups = participationStatusGroups({ published: 1, applications: 5, approved: 2 });
    expect(groups.map((g) => g.label)).toEqual([labelOf("applications"), labelOf("approved"), labelOf("published")]);
  });

  it("`applications` é Inscrições; status que o app não conhece NÃO vira Inscrições: fica com o texto cru, no fim", () => {
    const groups = participationStatusGroups({ mystery_status: 3, applications: 1, published: 1 });
    expect(groups[0].label).toBe(labelOf("applications"));
    expect(groups.at(-1)).toMatchObject({ label: "mystery_status", count: 3 });
  });

  it("ignora quantidades zeradas ou inválidas", () => {
    expect(participationStatusGroups({ approved: 0, published: Number.NaN, applications: 2 })).toHaveLength(1);
    expect(participationStatusGroups({})).toEqual([]);
  });
});

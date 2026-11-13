/**
 * Colunas do quadro de Gerenciamento (só apresentação): os 23 status da API continuam existindo e caem em 16 colunas.
 *
 * O QUE PRECISA FUNCIONAR: cada status cai na coluna combinada; as colunas que reúnem vários status mantêm o status do cartão;
 * a modalidade (permuta) e a ocupação decidem as colunas visíveis sem esconder nenhum cartão; as etapas somam os mesmos cartões.
 * O QUE NÃO PODE ACONTECER: um status ficar sem coluna, uma transição que era válida deixar de ser, um cartão sumir.
 */
import { describe, expect, it } from "vitest";

import type { CampaignManagementParticipant } from "@/shared/services/campaign-management";

import { isHotBoardColumn, STAGES, stageOf } from "./campaign-flow";
import { boardColumns, getVisibleKanbanColumns, kanbanColumns, resolveParticipantColumnId } from "./management-kanban-config";
import { boardColumnOf, isSecondaryStatus, mapUserStatusToKanbanColumn } from "./management-status-map";
import { REJECT_ZONE_ID, validateUserStatusTransition } from "./management-status-transitions";

/** Os 23 status da API e a coluna do quadro que cada um ganha. */
const API_STATUS_TO_COLUMN: Record<string, string> = {
  applications: "applications",
  pre_selection: "pre_selection",
  pre_selection_curation: "curation",
  curation: "curation",
  invited: "invited",
  price_proposed: "price_proposed",
  price_countered: "price_countered",
  contract_pending: "contract_pending",
  approved: "approved",
  pending_approval: "script_pending", // aprovação de ROTEIRO
  correction_script: "script_pending", // criador ajustando o roteiro
  awaiting_shipment: "awaiting_shipment",
  awaiting_receipt: "awaiting_receipt",
  awaiting_content: "content_pending",
  awaiting_content_approval: "pending_approval", // revisão do CONTEÚDO
  in_correction: "pending_approval", // criador ajustando o conteúdo
  content_approved: "content_approved",
  contents_confirmed: "content_approved",
  awaiting_publication: "content_approved",
  awaiting_payment: "payment_pending",
  published: "published",
  completed: "published",
  rejected: "rejected",
};

function make(partial: Partial<CampaignManagementParticipant>): CampaignManagementParticipant {
  return { id: "1", name: "Ana", username: "ana", avatar: "", followers: 0, engagement: 0, status_history: [], ...partial } as CampaignManagementParticipant;
}

describe("mapa status da API -> coluna do quadro", () => {
  it("são 23 status e todos caem na coluna combinada", () => {
    expect(Object.keys(API_STATUS_TO_COLUMN)).toHaveLength(23);
    for (const [status, column] of Object.entries(API_STATUS_TO_COLUMN)) {
      expect(boardColumnOf(mapUserStatusToKanbanColumn(status)), status).toBe(column);
    }
  });

  it("toda coluna de destino existe no quadro, que tem as 16 colunas combinadas", () => {
    const ids = boardColumns.map((c) => c.id);
    expect(ids).toEqual([
      "applications", "pre_selection", "curation", "invited", "price_proposed", "price_countered", "contract_pending", "approved",
      "script_pending", "awaiting_shipment", "awaiting_receipt", "content_pending", "pending_approval", "content_approved",
      "payment_pending", "published", "rejected",
    ]);
    for (const column of Object.values(API_STATUS_TO_COLUMN)) expect(ids).toContain(column);
  });

  it("o cartão segue com o status gravado: o secundário não vira o principal", () => {
    expect(mapUserStatusToKanbanColumn("pre_selection_curation")).toBe("pre_selection_curation");
    expect(mapUserStatusToKanbanColumn("correction_script")).toBe("script_correction");
    expect(mapUserStatusToKanbanColumn("in_correction")).toBe("in_correction");
    expect(["pre_selection_curation", "script_correction", "in_correction"].every(isSecondaryStatus)).toBe(true);
    expect(isSecondaryStatus("curation")).toBe(false);
  });

  it("o catálogo antigo de status segue inteiro (o Admin o usa para dar nome aos status)", () => {
    const ids = kanbanColumns.map((c) => c.id);
    for (const id of ["pre_selection_curation", "script_correction", "in_correction", "curation", "published"]) expect(ids).toContain(id);
  });

  it("o id da zona de recusa não é coluna", () => {
    expect(boardColumns.map((c) => c.id)).not.toContain(REJECT_ZONE_ID);
  });
});

describe("getVisibleKanbanColumns", () => {
  it("campanha que não é permuta esconde envio e recebimento; permuta mostra", () => {
    const money = getVisibleKanbanColumns("money", [make({ status: "awaiting_content" })]).map((c) => c.id);
    expect(money).not.toContain("awaiting_shipment");
    expect(money).not.toContain("awaiting_receipt");
    const swap = getVisibleKanbanColumns("swap", null).map((c) => c.id);
    expect(swap).toEqual(expect.arrayContaining(["awaiting_shipment", "awaiting_receipt"]));
  });

  it("coluna de envio ocupada volta mesmo sem ser permuta, na ordem do quadro", () => {
    const ids = getVisibleKanbanColumns("money", [make({ id: "2", status: "awaiting_shipment" })]).map((c) => c.id);
    expect(ids).toContain("awaiting_shipment");
    expect(ids.indexOf("awaiting_shipment")).toBeLessThan(ids.indexOf("content_pending"));
  });

  it("nenhum dos 23 status fica sem coluna visível, em campanha de qualquer modalidade", () => {
    for (const paymentType of ["money", "swap"]) {
      for (const status of Object.keys(API_STATUS_TO_COLUMN)) {
        const visible = getVisibleKanbanColumns(paymentType, [make({ status })]).map((c) => c.id);
        expect(visible, `${paymentType}/${status}`).toContain(API_STATUS_TO_COLUMN[status]);
      }
    }
  });

  it("status secundário ocupa a coluna que o reúne (não cria coluna própria)", () => {
    const ids = getVisibleKanbanColumns("money", [make({ status: "correction_script" }), make({ id: "2", status: "in_correction" })]).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["script_pending", "pending_approval"]));
    expect(ids).not.toContain("script_correction");
    expect(ids).not.toContain("in_correction");
  });

  it("Inscrições e Recusados nunca recolhem; as demais podem", () => {
    const open = boardColumns.filter((c) => c.alwaysOpen).map((c) => c.id);
    expect(open).toEqual(["applications", "rejected"]);
  });

  it("resolveParticipantColumnId continua devolvendo o status fino", () => {
    expect(resolveParticipantColumnId(make({ status: "correction_script" }))).toBe("script_correction");
  });
});

describe("transições: o que era válido segue válido", () => {
  it("soltar numa coluna que reúne vários status grava o principal, e as origens que já podiam seguem podendo", () => {
    for (const from of ["applications", "pre_selection", "pre_selection_curation"]) {
      expect(validateUserStatusTransition(from, "curation"), `${from} -> curation`).toBe(true);
    }
    expect(validateUserStatusTransition("approved", "script_pending")).toBe(true);
  });

  it("o que era inválido segue inválido (colunas automáticas não aceitam soltar)", () => {
    expect(validateUserStatusTransition("content_pending", "pending_approval")).toBe(false);
    expect(validateUserStatusTransition("script_pending", "script_correction")).toBe(false);
    expect(validateUserStatusTransition("pending_approval", "in_correction")).toBe(false);
    expect(validateUserStatusTransition("approved", "published")).toBe(false);
    expect(validateUserStatusTransition("content_approved", "payment_pending")).toBe(false);
  });

  it("recusar continua possível a partir das mesmas colunas", () => {
    for (const from of ["applications", "pre_selection", "curation", "invited", "contract_pending", "approved", "script_pending", "script_correction", "awaiting_shipment", "awaiting_receipt", "content_pending"]) {
      expect(validateUserStatusTransition(from, "rejected"), from).toBe(true);
    }
  });
});

describe("etapas", () => {
  it("cada coluna do quadro está em exatamente uma etapa, e a Seleção, Roteiros e Conteúdo têm as colunas combinadas", () => {
    const all = STAGES.flatMap((s) => s[2]);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(boardColumns.map((c) => c.id).sort());
    const byKey = Object.fromEntries(STAGES.map(([k, , cols]) => [k, cols]));
    expect(byKey.sel).toEqual(["applications", "pre_selection", "curation", "invited"]);
    expect(byKey.rot).toEqual(["approved", "script_pending"]);
    expect(byKey.cont).toEqual(["content_pending", "pending_approval", "content_approved"]);
    expect(byKey.rec).toEqual(["rejected"]);
  });

  it("os contadores somam os mesmos cartões: cada um dos 23 status cai em exatamente uma etapa", () => {
    const people = Object.keys(API_STATUS_TO_COLUMN).map((status) => ({ status, fine: mapUserStatusToKanbanColumn(status) }));
    const perStage = new Map<string, number>();
    for (const p of people) {
      const stage = stageOf(p.fine);
      expect(stage, p.status).toBeDefined();
      perStage.set(stage![0], (perStage.get(stage![0]) ?? 0) + 1);
    }
    expect([...perStage.values()].reduce((a, b) => a + b, 0)).toBe(23);
  });
});

describe("coluna em destaque", () => {
  it("contraproposta e recusados sempre; Roteiro e Revisão só com criador ajustando", () => {
    expect(isHotBoardColumn("price_countered", [])).toBe(true);
    expect(isHotBoardColumn("rejected", [])).toBe(true);
    expect(isHotBoardColumn("script_pending", ["script_pending"])).toBe(false);
    expect(isHotBoardColumn("script_pending", ["script_pending", "script_correction"])).toBe(true);
    expect(isHotBoardColumn("pending_approval", ["pending_approval", "in_correction"])).toBe(true);
    expect(isHotBoardColumn("curation", ["curation"])).toBe(false);
  });
});

/**
 * Soltar um cartão do kanban: em que coluna ele caiu.
 *
 * O QUE PRECISA FUNCIONAR: soltar sobre o espaço da coluna (id da coluna) ou sobre outro cartão (vale a coluna do cartão).
 * O QUE NÃO PODE ACONTECER: ignorar o movimento só porque a coluna já tem cartões (antes só dava para passar 2 por coluna).
 */
import { describe, expect, it } from "vitest";

import { canDropOnRejectZone, REJECT_ZONE_ID, resolveDropColumnId, validateUserStatusTransition } from "./management-status-transitions";

const COLUMNS = ["applications", "pre_selection", "pre_selection_curation", "curation"];
const STATUS: Record<string, string> = { "1": "applications", "2": "pre_selection", "3": "pre_selection", "4": "curation" };
const statusOf = (id: string) => STATUS[id];

describe("resolveDropColumnId", () => {
  it("solto sobre a própria coluna, vale a coluna", () => {
    expect(resolveDropColumnId("pre_selection", COLUMNS, statusOf)).toBe("pre_selection");
  });

  it("solto sobre um cartão (a coluna já tem cartões), vale a coluna desse cartão", () => {
    expect(resolveDropColumnId("2", COLUMNS, statusOf)).toBe("pre_selection");
    expect(resolveDropColumnId("3", COLUMNS, statusOf)).toBe("pre_selection");
    expect(resolveDropColumnId("4", COLUMNS, statusOf)).toBe("curation");
  });

  it("solto sobre algo desconhecido, ou sobre um cartão de status que não é coluna do quadro, não há destino", () => {
    expect(resolveDropColumnId("999", COLUMNS, statusOf)).toBeUndefined();
    expect(resolveDropColumnId("5", COLUMNS, () => "rejected")).toBeUndefined();
  });

  it("de Inscrições para a coluna do cartão de Pré-seleção a transição é válida (o que antes era ignorado)", () => {
    const target = resolveDropColumnId("2", COLUMNS, statusOf) as string;
    expect(validateUserStatusTransition("applications", target)).toBe(true);
  });
});

describe("zona de recusa", () => {
  it("o id da zona não colide com nenhuma coluna do quadro", () => {
    expect(COLUMNS).not.toContain(REJECT_ZONE_ID);
    expect(resolveDropColumnId(REJECT_ZONE_ID, COLUMNS, statusOf)).toBeUndefined();
  });

  it("quem está na Seleção (inscrições, pré-seleção, curadoria, convidado) e nas etapas seguintes pode ser recusado", () => {
    for (const status of ["applications", "pre_selection", "pre_selection_curation", "curation", "invited", "contract_pending", "approved", "script_pending"]) {
      expect(canDropOnRejectZone(status)).toBe(true);
    }
  });

  it("quem já foi recusado, ou está num status sem recusa, não vê a zona", () => {
    expect(canDropOnRejectZone("rejected")).toBe(false);
    expect(canDropOnRejectZone("payment_pending")).toBe(false);
    expect(canDropOnRejectZone("published")).toBe(false);
  });
});

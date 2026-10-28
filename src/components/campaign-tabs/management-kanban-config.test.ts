import { describe, it, expect } from "vitest";
import type { CampaignManagementParticipant } from "@/shared/services/campaign-management";
import {
  getVisibleKanbanColumns,
  resolveParticipantColumnId,
} from "./management-kanban-config";

function make(
  partial: Partial<CampaignManagementParticipant>,
): CampaignManagementParticipant {
  return {
    id: "1",
    name: "Ana",
    username: "ana",
    avatar: "",
    followers: 0,
    engagement: 0,
    status_history: [],
    ...partial,
  } as CampaignManagementParticipant;
}

describe("resolveParticipantColumnId", () => {
  it("usa o status direto quando conhecido", () => {
    expect(resolveParticipantColumnId(make({ status: "awaiting_content" }))).toBe(
      "content_pending",
    );
    expect(
      resolveParticipantColumnId(make({ status: "awaiting_content_approval" })),
    ).toBe("pending_approval");
  });

  it("roteiro reprovado (correction_script) vai para coluna própria, não para aprovação (#29)", () => {
    expect(resolveParticipantColumnId(make({ status: "correction_script" }))).toBe(
      "script_correction",
    );
    expect(resolveParticipantColumnId(make({ status: "pending_approval" }))).toBe(
      "script_pending",
    );
  });

  it("expõe a etiqueta externo no participante (#31)", () => {
    // is_external chega do backend; o mapeamento para o card é feito em
    // participantToExtended (isExternal). Aqui garantimos o passo de coluna.
    expect(resolveParticipantColumnId(make({ status: "approved" }))).toBe(
      "approved",
    );
  });

  it("cai no histórico mais recente quando o status é desconhecido", () => {
    expect(
      resolveParticipantColumnId(
        make({
          status: "unknown_status",
          status_history: [
            { id: "1", status: "awaiting_content", timestamp: "2026-01-01T00:00:00Z" },
            { id: "2", status: "awaiting_shipment", timestamp: "2026-01-02T00:00:00Z" },
          ],
        } as Partial<CampaignManagementParticipant>),
      ),
    ).toBe("awaiting_shipment");
  });
});

describe("getVisibleKanbanColumns", () => {
  it("oculta etapas de envio em campanha não-permuta sem ocupantes", () => {
    const ids = getVisibleKanbanColumns("money", [
      make({ status: "awaiting_content" }),
    ]).map((c) => c.id);
    expect(ids).not.toContain("awaiting_shipment");
    expect(ids).not.toContain("awaiting_receipt");
  });

  it("RE-INCLUI etapa de envio ocupada mesmo em campanha não-permuta (card não some)", () => {
    const ids = getVisibleKanbanColumns("money", [
      make({ status: "awaiting_content" }),
      make({ id: "2", status: "awaiting_shipment" }),
    ]).map((c) => c.id);
    expect(ids).toContain("awaiting_shipment");
    // Ordem do catálogo preservada: envio vem antes de "Aguardando Conteúdo".
    expect(ids.indexOf("awaiting_shipment")).toBeLessThan(ids.indexOf("content_pending"));
  });

  it("permuta mantém todas as colunas", () => {
    const ids = getVisibleKanbanColumns("swap", null).map((c) => c.id);
    expect(ids).toContain("awaiting_shipment");
    expect(ids).toContain("awaiting_receipt");
  });
});

import { describe, expect, it } from "vitest";

import { AdminApiError, toAdminApiError } from "./admin-client";
import { describeAdminError, getDeleteBlockers, isEndpointUnavailable } from "./admin-errors";

describe("describeAdminError", () => {
  it("devolve o texto pronto do AdminApiError", () => {
    expect(describeAdminError(toAdminApiError(409, { message: "Estado inválido", error: "INVALID_STATE_TRANSITION" }))).toBe("Estado inválido");
  });

  it("qualquer outra coisa vira texto genérico, sem expor erro técnico", () => {
    expect(describeAdminError(new Error("TypeError: x is undefined at foo.ts:12"))).toBe("Não foi possível concluir a operação.");
    expect(describeAdminError("boom")).toBe("Não foi possível concluir a operação.");
    expect(describeAdminError(undefined)).toBe("Não foi possível concluir a operação.");
  });
});

describe("isEndpointUnavailable", () => {
  it("só para o 404 de rota inexistente", () => {
    expect(isEndpointUnavailable(toAdminApiError(404, { message: "Cannot GET /api/backoffice/admin/users" }))).toBe(true);
    expect(isEndpointUnavailable(toAdminApiError(404, { message: "Usuário não encontrado" }))).toBe(false);
    expect(isEndpointUnavailable(new Error("x"))).toBe(false);
  });
});

describe("getDeleteBlockers", () => {
  const blockers = [
    { code: "HAS_CUSTODY_BALANCE", message: "Há saldo em custódia", amount_cents: 12000 },
    { code: "HAS_PUBLISHED_CAMPAIGNS", message: "Há campanhas publicadas", count: 2 },
  ];

  it("lê details.blockers de WORKSPACE_DELETE_BLOCKED", () => {
    const err = toAdminApiError(409, { message: "bloqueado", error: "WORKSPACE_DELETE_BLOCKED", details: { blockers } });
    expect(getDeleteBlockers(err)).toEqual(blockers);
  });

  it("descarta itens fora do contrato (código desconhecido, sem mensagem)", () => {
    const err = toAdminApiError(409, {
      message: "bloqueado",
      error: "WORKSPACE_DELETE_BLOCKED",
      details: { blockers: [...blockers, { code: "OUTRO", message: "x" }, { code: "HAS_PENDING_CHARGES" }, null, "texto"] },
    });
    expect(getDeleteBlockers(err)).toEqual(blockers);
  });

  it("vazio para outros erros, details ausente ou malformado", () => {
    expect(getDeleteBlockers(new Error("x"))).toEqual([]);
    expect(getDeleteBlockers(toAdminApiError(409, { message: "x", error: "INVALID_STATE_TRANSITION", details: { blockers } }))).toEqual([]);
    expect(getDeleteBlockers(new AdminApiError({ status: 409, code: "WORKSPACE_DELETE_BLOCKED", message: "x" }))).toEqual([]);
    expect(getDeleteBlockers(toAdminApiError(409, { message: "x", error: "WORKSPACE_DELETE_BLOCKED", details: { blockers: "não é lista" } }))).toEqual([]);
  });
});

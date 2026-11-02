import { describe, expect, it } from "vitest";

import { buildApiError } from "./api-error";
import {
  WORKSPACE_STATE_DEFAULT_MESSAGE,
  WORKSPACE_STATE_ERROR_CODES,
  isWorkspaceReactionCode,
  normalizeApiMessage,
  parseWorkspaceStateErrorBody,
  readWorkspaceStateError,
} from "./lifecycle-errors";

describe("normalizeApiMessage", () => {
  it("texto vira texto aparado; lista vira um texto só; vazio vira null", () => {
    expect(normalizeApiMessage("  Conta suspensa.  ")).toBe("Conta suspensa.");
    expect(normalizeApiMessage(["Primeira.", "  Segunda. ", ""])).toBe("Primeira. Segunda.");
    expect(normalizeApiMessage("   ")).toBeNull();
    expect(normalizeApiMessage([])).toBeNull();
    expect(normalizeApiMessage([42, null])).toBeNull();
    expect(normalizeApiMessage(undefined)).toBeNull();
    expect(normalizeApiMessage({ text: "x" })).toBeNull();
  });
});

describe("parseWorkspaceStateErrorBody", () => {
  it.each([
    ["WORKSPACE_SUSPENDED", 403],
    ["WORKSPACE_ARCHIVED", 403],
    ["WORKSPACE_DELETED", 404],
    ["ACCOUNT_SUSPENDED", 403],
    ["WORKSPACE_DELETE_BLOCKED", 409],
  ] as const)("reconhece %s", (code, status) => {
    const parsed = parseWorkspaceStateErrorBody(status, { statusCode: status, message: "texto do servidor", error: code });
    expect(parsed).toEqual({ code, status, message: "texto do servidor" });
  });

  it("o texto do servidor pode vir como lista e o details acompanha", () => {
    const details = { blockers: [{ code: "HAS_CUSTODY_BALANCE", message: "x", amount_cents: 100 }] };
    const parsed = parseWorkspaceStateErrorBody(409, {
      statusCode: 409,
      message: ["Primeira.", "Segunda."],
      error: "WORKSPACE_DELETE_BLOCKED",
      details,
    });
    expect(parsed).toEqual({ code: "WORKSPACE_DELETE_BLOCKED", status: 409, message: "Primeira. Segunda.", details });
  });

  it("sem texto, usa o texto padrão pt-BR do código", () => {
    for (const code of WORKSPACE_STATE_ERROR_CODES) {
      expect(parseWorkspaceStateErrorBody(403, { error: code })?.message).toBe(WORKSPACE_STATE_DEFAULT_MESSAGE[code]);
    }
    expect(WORKSPACE_STATE_DEFAULT_MESSAGE.ACCOUNT_SUSPENDED).toBe("Conta suspensa. Entre em contato com o suporte.");
  });

  it("códigos que não são de ciclo de vida, corpo sem código e corpo fora do formato dão null", () => {
    expect(parseWorkspaceStateErrorBody(403, { error: "Forbidden", message: "Forbidden resource" })).toBeNull();
    expect(parseWorkspaceStateErrorBody(409, { error: "LAST_OWNER" })).toBeNull();
    expect(parseWorkspaceStateErrorBody(403, { message: "sem código" })).toBeNull();
    expect(parseWorkspaceStateErrorBody(403, { error: 42 })).toBeNull();
    expect(parseWorkspaceStateErrorBody(403, "WORKSPACE_SUSPENDED")).toBeNull();
    expect(parseWorkspaceStateErrorBody(403, null)).toBeNull();
    expect(parseWorkspaceStateErrorBody(403, undefined)).toBeNull();
    expect(parseWorkspaceStateErrorBody(403, ["WORKSPACE_SUSPENDED"])).toBeNull();
  });
});

describe("readWorkspaceStateError (o que um serviço lançou)", () => {
  it("lê o corpo cru lançado por `throw errorData` (código em `error`, status em `statusCode`)", () => {
    const thrown = { statusCode: 403, message: "Este workspace está suspenso.", error: "WORKSPACE_SUSPENDED", path: "/x" };
    expect(readWorkspaceStateError(thrown)).toEqual({
      code: "WORKSPACE_SUSPENDED",
      status: 403,
      message: "Este workspace está suspenso.",
    });
  });

  it("lê um Error com `code`, `status` e `details` (http-client e buildApiError)", () => {
    const error = buildApiError(
      409,
      { statusCode: 409, message: "bloqueado", error: "WORKSPACE_DELETE_BLOCKED", details: { blockers: [] } },
      "falhou",
    );
    expect(error).toBeInstanceOf(Error);
    expect(readWorkspaceStateError(error)).toEqual({
      code: "WORKSPACE_DELETE_BLOCKED",
      status: 409,
      message: "bloqueado",
      details: { blockers: [] },
    });
  });

  it("mensagem em lista no corpo cru vira um texto só", () => {
    const state = readWorkspaceStateError({ statusCode: 403, message: ["a", "b"], error: "ACCOUNT_SUSPENDED" });
    expect(state?.message).toBe("a b");
  });

  it("sem status no erro, o status é 0 (o código basta)", () => {
    expect(readWorkspaceStateError({ error: "WORKSPACE_DELETED" })).toEqual({
      code: "WORKSPACE_DELETED",
      status: 0,
      message: WORKSPACE_STATE_DEFAULT_MESSAGE.WORKSPACE_DELETED,
    });
  });

  it("erros comuns, strings e vazios não são de ciclo de vida", () => {
    expect(readWorkspaceStateError(new Error("Workspace suspenso"))).toBeNull();
    expect(readWorkspaceStateError(Object.assign(new Error("x"), { status: 403 }))).toBeNull();
    expect(readWorkspaceStateError({ statusCode: 403, message: "Forbidden resource", error: "Forbidden" })).toBeNull();
    expect(readWorkspaceStateError("WORKSPACE_SUSPENDED")).toBeNull();
    expect(readWorkspaceStateError(null)).toBeNull();
    expect(readWorkspaceStateError(undefined)).toBeNull();
    expect(readWorkspaceStateError(403)).toBeNull();
  });
});

describe("isWorkspaceReactionCode", () => {
  it("só os três que mudam o que o app mostra; login e exclusão têm tratamento próprio", () => {
    expect(isWorkspaceReactionCode("WORKSPACE_SUSPENDED")).toBe(true);
    expect(isWorkspaceReactionCode("WORKSPACE_ARCHIVED")).toBe(true);
    expect(isWorkspaceReactionCode("WORKSPACE_DELETED")).toBe(true);
    expect(isWorkspaceReactionCode("ACCOUNT_SUSPENDED")).toBe(false);
    expect(isWorkspaceReactionCode("WORKSPACE_DELETE_BLOCKED")).toBe(false);
    expect(isWorkspaceReactionCode("LAST_OWNER")).toBe(false);
  });
});

describe("buildApiError", () => {
  it("texto do servidor, depois o `error` do corpo, depois o padrão", () => {
    expect(buildApiError(403, { message: "Sem acesso", error: "Forbidden" }, "padrão").message).toBe("Sem acesso");
    expect(buildApiError(403, { error: "Forbidden" }, "padrão").message).toBe("Forbidden");
    expect(buildApiError(500, undefined, "padrão").message).toBe("padrão");
    expect(buildApiError(500, "texto solto", "padrão").message).toBe("padrão");
    expect(buildApiError(400, { message: ["a", "b"] }, "padrão").message).toBe("a b");
  });

  it("carrega status, código e details (e nada além do que veio)", () => {
    const error = buildApiError(404, { message: "sumiu", error: "WORKSPACE_DELETED", details: { x: 1 } }, "padrão");
    expect(error.status).toBe(404);
    expect(error.code).toBe("WORKSPACE_DELETED");
    expect(error.details).toEqual({ x: 1 });

    const bare = buildApiError(500, {}, "padrão");
    expect(bare.status).toBe(500);
    expect("code" in bare).toBe(false);
    expect("details" in bare).toBe(false);
  });
});

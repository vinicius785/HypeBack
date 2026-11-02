import { describe, expect, it } from "vitest";

import { AdminApiError, toAdminApiError } from "@/lib/admin/admin-client";
import type { AdminUserActionName } from "@/hooks/admin/use-admin-users-actions";

import {
  describeUserActionError,
  translateValidationMessage,
  userActionErrorOutdatesScreen,
} from "./admin-user-errors";

const ACTIONS: AdminUserActionName[] = ["suspend", "reactivate", "revoke-sessions"];

/** Erro como o cliente HTTP o monta a partir do corpo do backend. */
function apiError(status: number, body: Record<string, unknown>): AdminApiError {
  return toAdminApiError(status, body);
}

describe("describeUserActionError", () => {
  it("CANNOT_ACT_ON_SELF: diz o que a pessoa não pode fazer, de acordo com a ação", () => {
    const error = apiError(409, { message: "Cannot act on self", error: "CANNOT_ACT_ON_SELF" });
    expect(describeUserActionError(error, "suspend")).toBe("Você não pode suspender a sua própria conta.");
    expect(describeUserActionError(error, "reactivate")).toBe("Você não pode reativar a sua própria conta.");
    expect(describeUserActionError(error, "revoke-sessions")).toBe("Você não pode encerrar as sessões da sua própria conta.");
  });

  it("CANNOT_ACT_ON_PLATFORM_ADMIN: explica que é administrador da plataforma", () => {
    const error = apiError(409, { message: "x", error: "CANNOT_ACT_ON_PLATFORM_ADMIN" });
    for (const action of ACTIONS) {
      expect(describeUserActionError(error, action)).toMatch(/administradora da plataforma/);
    }
    expect(describeUserActionError(error, "suspend")).toContain("suspender a conta de outro administrador");
    expect(describeUserActionError(error, "reactivate")).toContain("reativar a conta de outro administrador");
    expect(describeUserActionError(error, "revoke-sessions")).toContain("encerrar as sessões de outro administrador");
  });

  it("INVALID_STATE_TRANSITION: um texto por ação, pedindo para conferir a tela", () => {
    const error = apiError(409, { message: "Só é possível suspender um usuário ativo.", error: "INVALID_STATE_TRANSITION" });
    expect(describeUserActionError(error, "suspend")).toMatch(/Só é possível suspender uma conta ativa/);
    expect(describeUserActionError(error, "reactivate")).toMatch(/Só é possível reativar uma conta suspensa/);
    expect(describeUserActionError(error, "revoke-sessions")).toMatch(/conta excluída/);
    expect(describeUserActionError(error, "suspend")).toMatch(/confira os dados na tela/);
  });

  it("NOT_FOUND e ENDPOINT_UNAVAILABLE", () => {
    expect(describeUserActionError(apiError(404, { message: "Usuário não encontrado." }), "suspend")).toBe(
      "Não encontramos esta conta. Ela pode ter sido removida.",
    );
    expect(describeUserActionError(apiError(404, { message: "Cannot POST /api/backoffice/admin/users/9/suspend" }), "suspend")).toBe(
      "Esta ação ainda não está disponível no servidor.",
    );
  });

  it("ACCOUNT_SUSPENDED (a própria sessão de quem está agindo)", () => {
    const error = apiError(403, { message: "Conta suspensa", error: "ACCOUNT_SUSPENDED" });
    expect(describeUserActionError(error, "suspend")).toBe("A sua conta foi suspensa. Entre novamente para continuar.");
  });

  it("validação: lista de mensagens do DTO vira frases em português, sem repetir", () => {
    const error = apiError(400, {
      message: [
        "reason must be longer than or equal to 5 characters",
        "reason should not be empty",
        "reason must be a string",
      ],
      error: "Bad Request",
    });
    expect(describeUserActionError(error, "suspend")).toBe("O motivo precisa ter pelo menos 5 caracteres. Informe o motivo.");
  });

  it("validação: mensagem já em português do servidor passa como veio", () => {
    const error = apiError(400, { message: ["reason deve ter entre 5 e 500 caracteres"] });
    expect(describeUserActionError(error, "suspend")).toBe("reason deve ter entre 5 e 500 caracteres");
  });

  it("422 sem mensagem usa o texto padrão do cliente", () => {
    expect(describeUserActionError(apiError(422, {}), "suspend")).toBe("Não foi possível processar os dados enviados.");
  });

  it("os demais erros usam o texto padrão do cliente HTTP", () => {
    expect(describeUserActionError(apiError(500, { message: "Internal" }), "suspend")).toBe(
      "O servidor teve um problema. Tente novamente em instantes.",
    );
    expect(describeUserActionError(new AdminApiError({ status: 0, code: "NETWORK_ERROR", message: "x" }), "suspend")).toBe("x");
    expect(describeUserActionError(apiError(429, {}), "suspend")).toMatch(/Muitas tentativas/);
    expect(describeUserActionError(apiError(409, { error: "IDEMPOTENCY_CONFLICT", message: "" }), "suspend")).toMatch(/já foi enviada com outros dados/);
  });

  it("erro que não é do Admin vira o texto genérico (nunca expõe erro técnico)", () => {
    expect(describeUserActionError(new TypeError("Failed to fetch"), "suspend")).toBe("Não foi possível concluir a operação.");
    expect(describeUserActionError("boom", "suspend")).toBe("Não foi possível concluir a operação.");
  });
});

describe("translateValidationMessage", () => {
  it.each([
    ["reason must be longer than or equal to 5 characters", "O motivo precisa ter pelo menos 5 caracteres."],
    ["reason must be shorter than or equal to 500 characters", "O motivo pode ter no máximo 500 caracteres."],
    ["reason should not be empty", "Informe o motivo."],
    ["reason must be a string", "Informe o motivo."],
    ["property foo should not exist", "O servidor não reconheceu um dos dados enviados."],
    ["Idempotency-Key header must be a UUID", "Não foi possível identificar este envio. Feche o diálogo e tente de novo."],
    ["Alguma outra coisa em português", "Alguma outra coisa em português"],
  ])("%s", (message, expected) => {
    expect(translateValidationMessage(message)).toBe(expected);
  });
});

describe("userActionErrorOutdatesScreen", () => {
  it("estado velho na tela: transição inválida, conta que mudou de proteção, conta que sumiu", () => {
    for (const [status, error] of [
      [409, "INVALID_STATE_TRANSITION"],
      [409, "CANNOT_ACT_ON_SELF"],
      [409, "CANNOT_ACT_ON_PLATFORM_ADMIN"],
    ] as const) {
      expect(userActionErrorOutdatesScreen(apiError(status, { error, message: "x" }))).toBe(true);
    }
    expect(userActionErrorOutdatesScreen(apiError(404, { message: "Usuário não encontrado." }))).toBe(true);
  });

  it("falha de rede, de servidor ou de validação não mexe no estado da tela", () => {
    expect(userActionErrorOutdatesScreen(apiError(500, {}))).toBe(false);
    expect(userActionErrorOutdatesScreen(apiError(400, { message: ["x"] }))).toBe(false);
    expect(userActionErrorOutdatesScreen(new TypeError("Failed to fetch"))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { AdminApiError, toAdminApiError } from "@/lib/admin/admin-client";

import { workspaceErrorMessage } from "./workspace-errors";

const fromServer = (status: number, error: string, message = "Mensagem do servidor") =>
  toAdminApiError(status, { statusCode: status, message, error });

describe("workspaceErrorMessage", () => {
  const cases: Array<[string, number, RegExp]> = [
    ["INVALID_STATE_TRANSITION", 409, /estado do workspace mudou.*Atualizamos a página/],
    ["WORKSPACE_DELETE_BLOCKED", 409, /resolva os impedimentos.*arquive/],
    ["IMPACT_TOKEN_MISMATCH", 409, /números do workspace mudaram.*Atualizamos o resumo/],
    ["CONFIRMATION_MISMATCH", 422, /nome digitado não confere/],
    ["CANNOT_ACT_ON_SELF", 409, /sua própria conta/],
    ["CANNOT_ACT_ON_PLATFORM_ADMIN", 409, /outro administrador da plataforma/],
    ["LAST_OWNER", 409, /último proprietário.*outro proprietário/],
    ["IDEMPOTENCY_CONFLICT", 409, /outros dados/],
    ["WORKSPACE_DELETED", 404, /foi excluído/],
  ];

  it.each(cases)("%s vira a frase da ação, em pt-BR (e não o texto cru do servidor)", (code, status, expected) => {
    const message = workspaceErrorMessage(fromServer(status, code, "Server text"));
    expect(message).toMatch(expected);
    expect(message).not.toContain("Server text");
  });

  it("sem permissão", () => {
    expect(workspaceErrorMessage(toAdminApiError(403, { statusCode: 403, message: "Forbidden resource" }))).toBe(
      "Você não tem permissão para fazer isso.",
    );
  });

  it("validação (400) mostra as mensagens do servidor, todas", () => {
    const error = toAdminApiError(400, { statusCode: 400, message: ["name deve ter entre 1 e 100 caracteres", "tax_id deve ter 14 dígitos (CNPJ)"] });
    expect(workspaceErrorMessage(error)).toBe("name deve ter entre 1 e 100 caracteres · tax_id deve ter 14 dígitos (CNPJ)");
  });

  it("conflito sem código (membro repetido) mostra o texto do servidor", () => {
    expect(workspaceErrorMessage(toAdminApiError(409, { statusCode: 409, message: "Este usuário já é membro do workspace." }))).toBe(
      "Este usuário já é membro do workspace.",
    );
  });

  it("falha de rede e erro desconhecido têm texto próprio, sem detalhe técnico", () => {
    expect(workspaceErrorMessage(new AdminApiError({ status: 0, code: "NETWORK_ERROR", message: "Não foi possível falar com o servidor. Verifique a conexão e tente de novo." }))).toMatch(
      /conexão/,
    );
    expect(workspaceErrorMessage(new TypeError("x is undefined"))).toBe("Não foi possível concluir a operação.");
  });
});

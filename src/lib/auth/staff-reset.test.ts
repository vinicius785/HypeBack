import { describe, expect, it } from "vitest";

import { StaffResetError } from "@/shared/services/auth";

import { describeStaffResetError, INVALID_CODE_TEXT, isStaffCodeComplete, normalizeStaffCode } from "./staff-reset";

const err = (status: number, messages: string[] = [], code: string | null = null) => new StaffResetError({ status, code, messages });

describe("código da equipe", () => {
  it("aceita colar com ou sem hífens e em qualquer caixa, e mostra no formato XXXX-XXXX-XXXX", () => {
    expect(normalizeStaffCode("ab3d-9xk2-m7qp")).toBe("AB3D-9XK2-M7QP");
    expect(normalizeStaffCode("ab3d9xk2m7qp")).toBe("AB3D-9XK2-M7QP");
    expect(normalizeStaffCode("  AB3D 9XK2 M7QP  ")).toBe("AB3D-9XK2-M7QP");
    expect(normalizeStaffCode("ab3d9")).toBe("AB3D-9");
    expect(normalizeStaffCode("ab3d9xk2m7qpEXTRA")).toBe("AB3D-9XK2-M7QP");
    expect(normalizeStaffCode("")).toBe("");
  });

  it("só está completo com 12 letras ou números", () => {
    expect(isStaffCodeComplete("AB3D-9XK2-M7QP")).toBe(true);
    expect(isStaffCodeComplete("AB3D-9XK2")).toBe(false);
    expect(isStaffCodeComplete("")).toBe(false);
  });
});

describe("erros da redefinição com código", () => {
  it("400 'Código inválido ou expirado' vira UMA mensagem genérica, sem diferenciar a causa", () => {
    expect(describeStaffResetError(err(400, ["Código inválido ou expirado"]))).toEqual({ form: INVALID_CODE_TEXT });
    expect(INVALID_CODE_TEXT).toBe("Código inválido ou expirado. Peça um novo código a um admin.");
  });

  it("400 de validação (lista de textos) vai para o campo de cada um", () => {
    const text = describeStaffResetError(
      err(400, ["E-mail deve ter um formato válido", "Código inválido", "Senha da equipe deve ter no mínimo 12 caracteres"]),
    );
    expect(text.fields).toEqual({
      email: "E-mail deve ter um formato válido",
      code: "Código inválido",
      password: "Senha da equipe deve ter no mínimo 12 caracteres",
    });
    expect(text.form).toBeUndefined();
  });

  it("403 ANONYMIZER_BLOCKED pede para desativar VPN/proxy", () => {
    expect(describeStaffResetError(err(403, ["Forbidden"], "ANONYMIZER_BLOCKED")).form).toBe(
      "Não foi possível concluir por esta conexão. Desative VPN/proxy e tente novamente.",
    );
  });

  it("429 pede para aguardar, sem dizer se a conta travou", () => {
    expect(describeStaffResetError(err(429, ["ThrottlerException: Too Many Requests"])).form).toBe("Muitas tentativas. Aguarde e tente novamente.");
  });

  it("falha de rede, 5xx e erros desconhecidos viram texto genérico, sem detalhe técnico", () => {
    for (const e of [err(0, [], "NETWORK_ERROR"), err(500, ["Internal server error"]), err(503), new Error("boom")]) {
      expect(describeStaffResetError(e).form).toBe("Não foi possível redefinir a senha agora. Tente novamente.");
    }
  });
});

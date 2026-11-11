import { describe, expect, it } from "vitest";

import { normalizeResetCode, passwordMinFor, resetCodeKind } from "./reset-code";

describe("código de redefinição (e-mail ou admin)", () => {
  it("dígitos até 6 ficam como vieram (código do e-mail)", () => {
    expect(normalizeResetCode("123456")).toBe("123456");
    expect(normalizeResetCode("12 34-56")).toBe("123456");
    expect(normalizeResetCode("123")).toBe("123");
  });

  it("com letra ou mais de 6 caracteres vira XXXX-XXXX-XXXX (código de admin), com ou sem hífens e em qualquer caixa", () => {
    expect(normalizeResetCode("ab3d-9xk2-m7qp")).toBe("AB3D-9XK2-M7QP");
    expect(normalizeResetCode("ab3d9xk2m7qp")).toBe("AB3D-9XK2-M7QP");
    expect(normalizeResetCode("ab3d9")).toBe("AB3D-9");
    expect(normalizeResetCode("ab3d9xk2m7qpEXTRA")).toBe("AB3D-9XK2-M7QP");
    expect(normalizeResetCode("1234567")).toBe("1234-567");
  });

  it("identifica o tipo pelo formato: 6 dígitos = e-mail, 12 letras ou números = admin, o resto incompleto", () => {
    expect(resetCodeKind("123456")).toBe("email");
    expect(resetCodeKind("AB3D-9XK2-M7QP")).toBe("staff");
    expect(resetCodeKind("123456789012")).toBe("staff");
    expect(resetCodeKind("12345")).toBe("incomplete");
    expect(resetCodeKind("AB3D-9XK2")).toBe("incomplete");
    expect(resetCodeKind("")).toBe("incomplete");
  });

  it("senha mínima: 12 para o código de admin e 8 para o do e-mail", () => {
    expect(passwordMinFor("staff")).toBe(12);
    expect(passwordMinFor("email")).toBe(8);
    expect(passwordMinFor("incomplete")).toBe(8);
  });
});

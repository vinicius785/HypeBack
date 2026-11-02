import { describe, expect, it } from "vitest";

import { describeDeleteBlocker, getDeleteBlockers, type DeleteBlocker } from "./delete-blockers";

const NBSP = " ";

function blockedError(blockers: unknown) {
  return {
    statusCode: 409,
    message: "A exclusão está bloqueada.",
    error: "WORKSPACE_DELETE_BLOCKED",
    details: { blockers },
  };
}

describe("getDeleteBlockers", () => {
  it("lê a lista de details.blockers do corpo cru e de um Error com details", () => {
    const blockers = [
      { code: "HAS_CUSTODY_BALANCE", message: "Saldo em custódia", amount_cents: 125000 },
      { code: "HAS_PUBLISHED_CAMPAIGNS", message: "Campanhas publicadas", count: 2 },
    ];
    expect(getDeleteBlockers(blockedError(blockers))).toEqual(blockers);

    const asError = Object.assign(new Error("bloqueado"), { status: 409, code: "WORKSPACE_DELETE_BLOCKED", details: { blockers } });
    expect(getDeleteBlockers(asError)).toEqual(blockers);
  });

  it("null quando o erro não é WORKSPACE_DELETE_BLOCKED (a tela trata como erro comum)", () => {
    expect(getDeleteBlockers(new Error("falhou"))).toBeNull();
    expect(getDeleteBlockers({ statusCode: 403, error: "WORKSPACE_SUSPENDED" })).toBeNull();
    expect(getDeleteBlockers({ statusCode: 409, error: "LAST_OWNER" })).toBeNull();
    expect(getDeleteBlockers(undefined)).toBeNull();
    expect(getDeleteBlockers(null)).toBeNull();
  });

  it("lista vazia quando é o bloqueio mas o servidor não mandou impedimentos (o diálogo ainda explica)", () => {
    expect(getDeleteBlockers({ statusCode: 409, error: "WORKSPACE_DELETE_BLOCKED" })).toEqual([]);
    expect(getDeleteBlockers(blockedError("não é lista"))).toEqual([]);
    expect(getDeleteBlockers({ statusCode: 409, error: "WORKSPACE_DELETE_BLOCKED", details: "x" })).toEqual([]);
    expect(getDeleteBlockers(blockedError([]))).toEqual([]);
  });

  it("ignora entradas fora do formato e números que não são números; mantém códigos novos do servidor", () => {
    const result = getDeleteBlockers(
      blockedError([
        null,
        "texto",
        { message: "sem código" },
        { code: "", message: "código vazio" },
        { code: "HAS_PENDING_CHARGES", message: "Cobranças", count: "3", amount_cents: Number.NaN },
        { code: "HAS_NEW_THING", message: "Algo novo" },
      ]),
    );
    expect(result).toEqual([
      { code: "HAS_PENDING_CHARGES", message: "Cobranças" },
      { code: "HAS_NEW_THING", message: "Algo novo" },
    ]);
  });
});

describe("describeDeleteBlocker", () => {
  const d = (blocker: DeleteBlocker) => describeDeleteBlocker(blocker);

  it("saldo e valor reservado usam o valor exato em reais (centavos inteiros)", () => {
    expect(d({ code: "HAS_CUSTODY_BALANCE", message: "m", amount_cents: 125000 })).toBe(`Há R$${NBSP}1.250,00 de saldo no workspace.`);
    expect(d({ code: "HAS_CUSTODY_BALANCE", message: "m", amount_cents: 1 })).toBe(`Há R$${NBSP}0,01 de saldo no workspace.`);
    expect(d({ code: "HAS_COMMITTED_FUNDS", message: "m", amount_cents: 30050 })).toBe(`Há R$${NBSP}300,50 reservados para criadores.`);
  });

  it("valor reservado sem valor mas com contagem fala de reservas em aberto", () => {
    expect(d({ code: "HAS_COMMITTED_FUNDS", message: "m", count: 1 })).toBe("Há 1 reserva de criador em aberto.");
    expect(d({ code: "HAS_COMMITTED_FUNDS", message: "m", count: 4 })).toBe("Há 4 reservas de criadores em aberto.");
  });

  it("cobranças, saques e campanhas concordam no singular e no plural; o valor, quando vem, entra entre parênteses", () => {
    expect(d({ code: "HAS_PENDING_CHARGES", message: "m", count: 1 })).toBe("Há 1 cobrança PIX aguardando pagamento.");
    expect(d({ code: "HAS_PENDING_CHARGES", message: "m", count: 2, amount_cents: 40000 })).toBe(
      `Há 2 cobranças PIX aguardando pagamento (R$${NBSP}400,00).`,
    );
    expect(d({ code: "HAS_WITHDRAWALS_IN_FLIGHT", message: "m", count: 1 })).toBe("Há 1 saque de criador em andamento.");
    expect(d({ code: "HAS_WITHDRAWALS_IN_FLIGHT", message: "m", count: 3, amount_cents: 99 })).toBe(
      `Há 3 saques de criadores em andamento (R$${NBSP}0,99).`,
    );
    expect(d({ code: "HAS_PUBLISHED_CAMPAIGNS", message: "m", count: 1 })).toBe("Há 1 campanha publicada.");
    expect(d({ code: "HAS_PUBLISHED_CAMPAIGNS", message: "m", count: 12 })).toBe("Há 12 campanhas publicadas.");
  });

  it("sem os números que a frase pede, vale o texto do servidor; sem ele, uma frase genérica", () => {
    expect(d({ code: "HAS_CUSTODY_BALANCE", message: "Existe saldo em custódia." })).toBe("Existe saldo em custódia.");
    expect(d({ code: "HAS_PUBLISHED_CAMPAIGNS", message: "  Campanhas publicadas.  " })).toBe("Campanhas publicadas.");
    expect(d({ code: "HAS_PENDING_CHARGES", message: "" })).toBe("Há um impedimento que precisa ser resolvido antes.");
  });

  it("código novo do servidor aparece pelo texto dele", () => {
    expect(d({ code: "HAS_NEW_THING", message: "Há algo novo.", count: 5 })).toBe("Há algo novo.");
  });

  it("nunca mostra 0 no lugar de um valor que não veio", () => {
    expect(d({ code: "HAS_CUSTODY_BALANCE", message: "" })).not.toMatch(/R\$/);
  });
});

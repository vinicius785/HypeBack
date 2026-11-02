import { describe, expect, it } from "vitest";

import { ADMIN_ACTION_CODES } from "@/shared/admin-platform.types";

import { AUDIT_ACTION_LABEL } from "./audit-labels";

describe("AUDIT_ACTION_LABEL", () => {
  it("todo código de ação do contrato tem rótulo em pt-BR, sem repetir", () => {
    for (const code of ADMIN_ACTION_CODES) expect(AUDIT_ACTION_LABEL[code], code).toBeTruthy();
    expect(Object.keys(AUDIT_ACTION_LABEL).sort()).toEqual([...ADMIN_ACTION_CODES].sort());
    expect(new Set(Object.values(AUDIT_ACTION_LABEL)).size).toBe(ADMIN_ACTION_CODES.length);
  });

  it("as operações de dinheiro feitas por administrador usam o mesmo texto do backend", () => {
    expect(AUDIT_ACTION_LABEL["balance.manual_credit"]).toBe("Crédito manual de saldo a um criador");
    expect(AUDIT_ACTION_LABEL["balance.topup"]).toBe("Recarga de saldo de workspace criada por administrador");
    expect(AUDIT_ACTION_LABEL["balance.simulate_payment"]).toBe("Pagamento simulado por administrador");
  });
});

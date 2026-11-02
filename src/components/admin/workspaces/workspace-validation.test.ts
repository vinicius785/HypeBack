import { describe, expect, it } from "vitest";

import { makeDetail } from "./test-support";
import {
  buildUpdateFields,
  changedEditFields,
  editValuesFromDetail,
  isValidCnpj,
  isValidEmail,
  normalizeEditValue,
  validateEditValues,
} from "./workspace-validation";

const original = editValuesFromDetail(makeDetail());

describe("editValuesFromDetail", () => {
  it("mostra CNPJ e CEP com máscara e o que está vazio como texto vazio", () => {
    const values = editValuesFromDetail(makeDetail("active", { legal_name: null, description: null }));
    expect(values.tax_id).toBe("11.222.333/0001-81");
    expect(values.postal_code).toBe("01310-100");
    expect(values.legal_name).toBe("");
    expect(values.description).toBe("");
    expect(values.state).toBe("SP");
  });
});

describe("normalizeEditValue", () => {
  it("guarda só dígitos no CNPJ e no CEP, UF em maiúsculas e texto aparado", () => {
    expect(normalizeEditValue("tax_id", "11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizeEditValue("postal_code", "01310-100")).toBe("01310100");
    expect(normalizeEditValue("state", " sp ")).toBe("SP");
    expect(normalizeEditValue("name", "  Café  ")).toBe("Café");
  });
});

describe("changedEditFields", () => {
  it("sem mudança nenhuma, nada mudou (a máscara e os espaços não contam)", () => {
    expect(changedEditFields({ ...original, tax_id: "11222333000181", name: "  Café Serra Verde " }, original)).toEqual([]);
  });

  it("lista só os campos que mudaram", () => {
    expect(changedEditFields({ ...original, city: "Santos", state: "sp " }, original)).toEqual(["city"]);
    expect(changedEditFields({ ...original, city: "Santos", state: "rj" }, original)).toEqual(["city", "state"]);
  });
});

describe("isValidCnpj (mesma conta do servidor)", () => {
  it("aceita CNPJ com os dois dígitos verificadores corretos", () => {
    for (const cnpj of ["11222333000181", "12345678000195", "45723174000110"]) expect(isValidCnpj(cnpj)).toBe(true);
  });

  it("recusa dígito verificador errado (14 dígitos que o servidor devolveria como 400)", () => {
    expect(isValidCnpj("12345678000199")).toBe(false);
    expect(isValidCnpj("12345678000185")).toBe(false);
    expect(isValidCnpj("11222333000182")).toBe(false);
  });

  it("recusa todos os dígitos iguais, tamanho diferente de 14 e o que não for só dígito", () => {
    for (const cnpj of ["00000000000000", "11111111111111", "99999999999999"]) expect(isValidCnpj(cnpj)).toBe(false);
    for (const cnpj of ["", "1122233300018", "112223330001811", "1122233300018a", "11.222.333/0001-81"]) expect(isValidCnpj(cnpj)).toBe(false);
  });
});

describe("validateEditValues", () => {
  it("CNPJ de 14 dígitos com dígito verificador errado ou repetido é recusado; vazio continua permitido (campo opcional)", () => {
    expect(validateEditValues({ ...original, tax_id: "12.345.678/0001-99" }, original).tax_id).toMatch(/dígitos verificadores/);
    expect(validateEditValues({ ...original, tax_id: "11111111111111" }, original).tax_id).toMatch(/dígitos verificadores/);
    expect(validateEditValues({ ...original, tax_id: "" }, original).tax_id).toBeUndefined();
    expect(validateEditValues({ ...original, tax_id: "12.345.678/0001-95" }, original).tax_id).toBeUndefined();
  });

  it("nome, CNPJ, CEP e UF inválidos acusam erro", () => {
    const errors = validateEditValues({ ...original, name: "  ", tax_id: "123", postal_code: "0131", state: "S1" }, original);
    expect(errors.name).toMatch(/nome/i);
    expect(errors.tax_id).toMatch(/14 dígitos/);
    expect(errors.postal_code).toMatch(/8 dígitos/);
    expect(errors.state).toMatch(/2 letras/);
  });

  it("campo esvaziado é válido (vira null), menos o nome", () => {
    const errors = validateEditValues({ ...original, tax_id: "", postal_code: "", state: "", name: "" }, original);
    expect(errors).toEqual({ name: "Informe o nome do workspace." });
  });

  it("dado antigo fora do padrão não impede de corrigir outro campo (só o que mudou é conferido)", () => {
    const legacy = { ...original, tax_id: "1234", postal_code: "99" };
    expect(validateEditValues({ ...legacy, city: "Santos" }, legacy)).toEqual({});
  });

  it("CNPJ com máscara e CEP com hífen valem", () => {
    expect(validateEditValues({ ...original, tax_id: "12.345.678/0001-95", postal_code: "20040-020" }, original)).toEqual({});
  });
});

describe("buildUpdateFields", () => {
  it("manda só o que mudou, com CNPJ/CEP em dígitos e UF em maiúsculas", () => {
    expect(
      buildUpdateFields({ ...original, name: "Café Novo", tax_id: "12.345.678/0001-95", postal_code: "20040-020", state: "rj" }, original),
    ).toEqual({ name: "Café Novo", tax_id: "12345678000195", postal_code: "20040020", state: "RJ" });
  });

  it("campo esvaziado vira null; o nome nunca é nulo", () => {
    expect(buildUpdateFields({ ...original, unit: "", description: "  " }, original)).toEqual({ unit: null, description: null });
  });

  it("sem mudança, corpo vazio", () => {
    expect(buildUpdateFields(original, original)).toEqual({});
  });
});

describe("isValidEmail", () => {
  it("aceita e-mail comum e recusa o que não tem forma de e-mail", () => {
    expect(isValidEmail(" nome@empresa.com.br ")).toBe(true);
    expect(isValidEmail("nome@empresa")).toBe(false);
    expect(isValidEmail("nome empresa@x.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

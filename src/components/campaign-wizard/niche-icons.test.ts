import { describe, expect, it } from "vitest";

import { nicheIconFor } from "./niche-icons";

/** Nichos como a API devolve (os que aparecem na etapa Criadores). */
const MAIN = [
  "Moda & Beleza",
  "Alimentação & Bebidas",
  "Fitness & Saúde",
  "Casa & Decoração",
  "Tecnologia & Inovação",
  "Finanças & Negócios",
  "Entretenimento & Cultura",
  "Educação & Carreira",
  "Automotivo",
  "Família & Maternidade",
  "Pets",
  "Sustentabilidade & Causas",
  "Esportes",
  "Marketing & Comunicação",
];

describe("nicheIconFor", () => {
  it("todo nicho principal tem ícone próprio", () => {
    const icons = MAIN.map((n) => nicheIconFor(n));
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(MAIN.length);
  });

  it("Alimentação & Bebidas leva os talheres, não o ícone de bebida nem o genérico", () => {
    expect(nicheIconFor("Alimentação & Bebidas")).toBe(nicheIconFor("Gastronomia"));
    expect(nicheIconFor("Alimentação & Bebidas")).not.toBe(nicheIconFor("Cervejas & Bebidas Alcoólicas"));
  });

  it("ignora acento e caixa", () => {
    expect(nicheIconFor("ALIMENTACAO & BEBIDAS")).toBe(nicheIconFor("alimentação & bebidas"));
  });

  it("nicho desconhecido devolve null (a tela usa o ícone genérico)", () => {
    expect(nicheIconFor("Astrologia")).toBeNull();
    expect(nicheIconFor("")).toBeNull();
  });
});

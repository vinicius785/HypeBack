/**
 * Workspaces: o que o CSS da tela não pode voltar a ter (o jsdom não calcula cascata, então se lê o arquivo como
 * texto): literais soltos no lugar dos tokens do kit, breakpoints fora dos oficiais e regras de classes que o kit
 * ou o `AdminEntityCell` já cobrem. Também confere que toda classe `adm-workspaces-*` do CSS ainda é usada.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "admin-workspaces.css"), "utf8");
const sources = import.meta.glob(["../components/admin/workspaces/**/*.tsx", "!**/*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const code = Object.values(sources).join("\n");

describe("admin-workspaces.css", () => {
  it("superfície, divisor, raios e foco vêm dos tokens do kit, sem literais soltos", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/rgba?\(/);
    expect(css).not.toMatch(/border-radius:\s*\d+px/);
    expect(css).not.toMatch(/outline:\s*\d+px solid/);
    expect(css).not.toMatch(/gradient\(/);
  });

  it("só usa os breakpoints oficiais do Admin (560, 900, 1100)", () => {
    for (const match of css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)) expect([560, 900, 1100]).toContain(Number(match[1]));
  });

  it("a pessoa e o responsável são `AdminEntityCell`: as caixas próprias de Workspaces saíram", () => {
    expect(css).not.toMatch(/adm-workspaces-person|adm-workspaces-owner\b/);
    expect(code).not.toMatch(/adm-workspaces-person|adm-workspaces-owner\b/);
  });

  it("o link de texto é o do kit (`textLink`): não há regra local que o redesenhe", () => {
    expect(css).not.toMatch(/\.adm-workspaces-links a\b/);
    expect(code).not.toMatch(/adm-workspaces-(fin|act)-help/);
  });

  it("o liga/desliga 'Excluídos' é do kit: nenhum `adm-pill` à mão nas telas de Workspaces", () => {
    expect(code).not.toMatch(/adm-pill/);
  });

  it("não sobrou classe `adm-workspaces-*` no CSS sem uso", () => {
    const classes = [...new Set([...css.matchAll(/\.(adm-workspaces-[a-z-]+)/g)].map((match) => match[1]))];
    const unused = classes.filter((name) => !new RegExp(`${name}(?![a-z-])`).test(code));
    expect(unused).toEqual([]);
  });
});

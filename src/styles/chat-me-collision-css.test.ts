import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "prototype.css"), "utf8");

describe("balão próprio do chat (.cm.me) x bloco de perfil do menu (.me)", () => {
  it("a regra do trilho que esconde os divs do perfil vale só dentro do menu (.side), não em .cm.me", () => {
    // `.pv .me div { display: none }` sem escopo escondia o conteúdo de TODA mensagem própria em telas <= 1100px.
    expect(css).not.toMatch(/[,{]\s*\.pv \.me div\s*[,{]/);
    expect(css).toMatch(/\.pv \.side \.me div/);
  });
});

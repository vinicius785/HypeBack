/**
 * Regras do menu lateral que o jsdom não vê (cascata, contraste, trilho): título de grupo legível sobre o preto,
 * divisória sutil, "Sair" que continua acessível no trilho, tamanho único dos itens e respeito a "reduzir
 * movimento". Lê o arquivo como texto.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "sidebar-nav.css"), "utf8");

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const luminance = (r: number, g: number, b: number) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Corpo da primeira regra cujo seletor contém o texto dado. */
function rule(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `regra "${selector}" não encontrada`).toBeGreaterThanOrEqual(0);
  return css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
}

describe("menu lateral (CSS)", () => {
  it("o título do grupo é discreto mas passa de 4.5:1 sobre o fundo da sidebar (#050505)", () => {
    const body = rule(".pv .side .sb-nav h6 {");
    const alpha = Number(/color:\s*rgba\(255,\s*255,\s*255,\s*([\d.]+)\)/.exec(body)?.[1]);
    expect(alpha).toBeGreaterThan(0);
    // branco com a opacidade dada sobre o preto da sidebar
    const channelValue = Math.round(255 * alpha + 5 * (1 - alpha));
    const ratio = contrast(luminance(channelValue, channelValue, channelValue), luminance(5, 5, 5));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // e fica mais quieto que o item (que usa --dim, 0.62)
    expect(alpha).toBeLessThan(0.62);
    expect(body).toMatch(/text-transform:\s*uppercase/);
  });

  it("o título do grupo tem 11px (não 10.5px)", () => {
    expect(rule(".pv .side .sb-nav h6 {")).toMatch(/font-size:\s*11px/);
  });

  it("a divisória entre grupos tem baixo contraste (no máximo 12% de branco)", () => {
    const body = rule(".pv .side .sb-group + .sb-group {");
    const alpha = Number(/border-top:[^;]*rgba\(255,\s*255,\s*255,\s*([\d.]+)\)/.exec(body)?.[1]);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThanOrEqual(0.12);
  });

  it("todos os itens têm a mesma altura (um só valor para a lista e o 'Voltar ao app')", () => {
    const item = /height:\s*(\d+)px/.exec(rule(".pv .side .sb-item {"))?.[1];
    const exit = /height:\s*(\d+)px/.exec(rule(".pv .side .sb-exit {"))?.[1];
    expect(item).toBeDefined();
    expect(exit).toBe(item);
  });

  it("no trilho o 'Sair' continua à mão (o protótipo o escondia) e o selo vira número sobre o ícone", () => {
    const rail = css.slice(css.indexOf("@media (max-width: 1100px)"));
    expect(rail).toMatch(/\.pv \.side \.me \.me-out\s*\{[^}]*display:\s*grid/);
    expect(rail).toMatch(/\.pv \.side \.sb-item \.n\s*\{[^}]*position:\s*absolute/);
    // os títulos não ocupam espaço no trilho
    expect(rail).toMatch(/\.pv \.side \.sb-nav h6\s*\{[^}]*display:\s*none/);
  });

  it("a lista de workspaces abre para o lado, com largura própria, no trilho de 84px", () => {
    const rail = css.slice(css.indexOf("@media (max-width: 1100px)"));
    expect(rail).toMatch(/\.pv \.side \.wsl\s*\{[^}]*width:\s*\d+px/);
  });

  it("a dica do trilho só aparece na largura do trilho", () => {
    expect(rule(".pv .sb-tip {")).toMatch(/display:\s*none/);
    const rail = css.slice(css.indexOf("@media (max-width: 1100px)"));
    expect(rail).toMatch(/\.pv \.sb-tip\s*\{[^}]*display:\s*block/);
  });

  it("o movimento do ícone no hover some com 'reduzir movimento'", () => {
    expect(rule(".pv .side .sb-item:hover .ico {")).toMatch(/transform:\s*scale/);
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.sb-item:hover \.ico[^{]*\{[^}]*transform:\s*none/);
  });

  it("o foco do teclado tem anel visível em todos os controles do menu", () => {
    for (const selector of [".sb-item:focus-visible", ".sb-exit:focus-visible", ".me-profile:focus-visible", ".me-out:focus-visible", ".wsb:focus-visible"]) {
      expect(css).toContain(selector);
    }
    expect(css).toMatch(/:focus-visible[^{]*\{\s*outline:\s*2px solid #fff/);
  });
});

/**
 * Entrada animada do menu do Admin (`admin-sidebar-motion.css`). O jsdom não roda animação nem calcula a
 * cascata, então o teste lê o arquivo como texto e garante o que quebra sem avisar: @keyframes que existem,
 * "reduzir movimento" desligando tudo e nenhum deslocamento que faça a lista rolável piscar a barra de rolagem.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// O Vitest entrega `.css?raw` vazio (ele processa o CSS), então os arquivos são lidos do disco.
const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");
const css = read("admin-sidebar-motion.css").replace(/\/\*[\s\S]*?\*\//g, "");
const reducedAt = css.indexOf("@media (prefers-reduced-motion: reduce)");
const base = css.slice(0, reducedAt);
const reduced = css.slice(reducedAt);

/** Tudo que o CSS anima, como aparece nos seletores. */
const ANIMATED = [".adm-side::before", ".adm-ws-static", ".adm-ws-static .brand", ".adm-nav h6", ".adm-nav button", ".adm-nav-exit"];

describe("animação de entrada do menu do Admin", () => {
  it("é carregada pelo menu", () => {
    expect(read("../components/sidebar.tsx")).toContain('import "@/styles/admin-sidebar-motion.css"');
  });

  it("toda animação usada tem o @keyframes correspondente", () => {
    const used = [...base.matchAll(/animation:\s*([\w-]+)/g)].map((m) => m[1]);
    // brilho, bloco, escudo, títulos+itens (uma regra para os dois) e "Voltar ao app"
    expect(new Set(used).size).toBeGreaterThanOrEqual(5);
    for (const name of new Set(used)) expect(base).toMatch(new RegExp(`@keyframes ${name}\\b`));
  });

  it("cada elemento animado tem a regra com `animation` e é desligado por 'reduzir movimento'", () => {
    expect(reducedAt).toBeGreaterThan(0);
    for (const selector of ANIMATED) {
      expect(base).toContain(selector);
      expect(reduced).toContain(selector);
    }
    expect(reduced).toMatch(/\{\s*animation:\s*none;\s*\}/);
  });

  it("os itens entram vindo da esquerda: nada passa da borda direita ou de baixo da lista que rola", () => {
    const frames = base.match(/@keyframes adm-side-in[^\n]*/)?.[0] ?? "";
    expect(frames).toMatch(/translateX\(-\d/);
    expect(frames).not.toMatch(/translate[XY]?\((?!-)\d/);
  });

  it("o brilho fica por baixo do conteúdo e não captura clique", () => {
    const glow = base.match(/\.adm-side::before\s*\{[^}]*\}/)?.[0] ?? "";
    expect(glow).toMatch(/z-index:\s*-1/);
    expect(glow).toMatch(/pointer-events:\s*none/);
    expect(base).toMatch(/\.adm-side\s*\{[^}]*isolation:\s*isolate/);
  });

  it("a cascata inteira cabe em menos de 1,2 s (o último item não faz esperar)", () => {
    // 12 posições (10 itens, 2 títulos) + o "Voltar ao app" = vez 12; atraso = vez × passo + base; duração do item.
    const step = Number(base.match(/var\(--i, 0\) \* (\d+)ms/)?.[1]);
    const delay = Number(base.match(/\* \d+ms \+ (\d+)ms/)?.[1]);
    const duration = Number(base.match(/\.adm-nav button\s*\{\s*animation:\s*adm-side-in\s*\.(\d+)s/)?.[1]) * 10;
    expect(12 * step + delay + duration).toBeLessThan(1200);
  });
});

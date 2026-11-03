/**
 * Movimento do menu na troca entre o app e o Admin (`admin-sidebar-motion.css`): entrada do Admin, saída ao clicar
 * em "Voltar ao app" e entrada do app que volta. O jsdom não roda animação nem calcula a cascata, então o teste lê
 * o arquivo como texto e garante o que quebra sem avisar: @keyframes que existem, "reduzir movimento" desligando
 * tudo, nenhum deslocamento que faça a lista rolável piscar a barra de rolagem e a saída cabendo no tempo que o
 * menu espera antes de trocar a rota.
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
const ANIMATED = [
  ".adm-side::before",
  ".adm-returning::before",
  ".adm-ws-static",
  ".adm-ws-static .brand",
  ".adm-returning .wsw > .wsb",
  ".adm-side .adm-nav h6",
  ".adm-side .adm-nav button",
  ".adm-returning .adm-nav h6",
  ".adm-returning .adm-nav button",
  ".adm-side .adm-nav-exit",
  ".adm-leaving .adm-nav h6",
  ".adm-leaving .adm-nav button",
  ".adm-leaving .adm-nav-exit",
  ".adm-leaving .adm-ws-static",
];

describe("animação de entrada do menu do Admin", () => {
  it("é carregada pelo menu", () => {
    expect(read("../components/sidebar.tsx")).toContain('import "@/styles/admin-sidebar-motion.css"');
  });

  it("toda animação usada tem o @keyframes correspondente", () => {
    const used = [...base.matchAll(/animation:\s*([\w-]+)/g)].map((m) => m[1]);
    // brilho, bloco, escudo, títulos+itens (uma regra para os dois), "Voltar ao app" e a saída
    expect(new Set(used).size).toBeGreaterThanOrEqual(6);
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

  it("o brilho fica por baixo do conteúdo e não captura clique (na entrada do Admin e na volta ao app)", () => {
    for (const side of ["adm-side", "adm-returning"]) {
      const glow = base.match(new RegExp(`\\.${side}::before\\s*\\{[^}]*\\}`))?.[0] ?? "";
      expect(glow).toMatch(/z-index:\s*-1/);
      expect(glow).toMatch(/pointer-events:\s*none/);
      expect(base).toMatch(new RegExp(`\\.${side}\\s*\\{[^}]*isolation:\\s*isolate`));
    }
  });

  it("a cascata inteira cabe em menos de 1,2 s (o último item não faz esperar)", () => {
    // 12 posições (10 itens, 2 títulos) + o "Voltar ao app" = vez 12; atraso = vez × passo + base; duração do item.
    const step = Number(base.match(/var\(--i, 0\) \* (\d+)ms/)?.[1]);
    const delay = Number(base.match(/\* \d+ms \+ (\d+)ms/)?.[1]);
    const duration = Number(base.match(/\.adm-nav button\s*\{\s*animation:\s*adm-side-in\s*\.(\d+)s/)?.[1]) * 10;
    expect(12 * step + delay + duration).toBeLessThan(1200);
  });

  it("a saída também vai para a esquerda (nada passa da borda direita ou de baixo da lista que rola)", () => {
    const frames = base.match(/@keyframes adm-side-out[^\n]*/)?.[0] ?? "";
    expect(frames).toMatch(/translateX\(-\d/);
    expect(frames).not.toMatch(/translate[XY]?\((?!-)\d/);
  });

  it("na saída o menu não é clicável: um clique no meio da animação não navega para outro lugar", () => {
    expect(base).toMatch(/\.adm-side\.adm-leaving\s*\{\s*pointer-events:\s*none/);
  });

  it("a saída (de baixo para cima, mais o bloco do topo) termina antes de a rota trocar (`LEAVE_MS`)", () => {
    const leaveMs = Number(read("../components/sidebar.tsx").match(/export const LEAVE_MS = (\d+)/)?.[1]);
    const step = Number(base.match(/calc\(\(var\(--n, 0\) - var\(--i, 0\)\) \* (\d+)ms\)/)?.[1]);
    const blockStep = Number(base.match(/calc\(\(var\(--n, 0\) \+ 1\) \* (\d+)ms\)/)?.[1]);
    const duration = Number(base.match(/animation:\s*adm-side-out\s*\.(\d+)s/)?.[1]) * 10;
    expect(blockStep).toBe(step);
    // 12 = a vez do "Voltar ao app" (10 itens e 2 títulos vêm antes): o último a sair é o bloco do topo, na vez 13.
    expect(13 * step + duration).toBeLessThanOrEqual(leaveMs);
    // e a espera antes da troca não pesa: abaixo de um quarto de segundo
    expect(leaveMs).toBeLessThanOrEqual(250);
  });
});

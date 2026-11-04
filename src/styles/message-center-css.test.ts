import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "message-center.css"), "utf8");
const rules = css.match(/[^{}]+\{[^{}]*\}/g) ?? [];

/** Regras (no nível raiz ou dentro de @media) que declaram `animation:` (exceto `animation: none`). */
const animated = rules
  .filter((r) => /animation(-delay)?\s*:/.test(r) && !/animation\s*:\s*none/.test(r))
  .map((r) => r.split("{")[0].trim());

describe("central de mensagens: o que anima", () => {
  it("o nome da conversa entra ao trocar de conversa", () => {
    expect(animated.some((sel) => sel.includes(".mc-th .mc-ti"))).toBe(true);
  });

  it("as linhas da lista deslizam ao trocar de aba", () => {
    expect(animated.some((sel) => sel.includes(".swap-to-team .mc-row"))).toBe(true);
    expect(animated.some((sel) => sel.includes(".swap-to-creators .mc-row"))).toBe(true);
  });

  it("nenhuma coluna inteira, cabeçalho de conversa, histórico ou campo de envio é animado (era o que piscava)", () => {
    const forbidden = [".mc-list >", ".mc-list{", ".mc-thread >", ".mc-thread {", ".mc-head", ".mc-cats {", ".ch-tb", ".ch-f", ".mc-state"];
    for (const sel of animated) {
      // A única animação em `.mc-thread` é o deslize da conversa que ocupa a tela no celular.
      if (sel.includes(".ovp.mc.th .mc-thread")) continue;
      for (const bad of forbidden) expect(`${sel} não deve conter ${bad}: ${sel.includes(bad)}`).toBe(`${sel} não deve conter ${bad}: false`);
    }
  });

  it("separadores de dia, marcas de estado e miniaturas não repetem a entrada ao abrir outra conversa", () => {
    const off = rules.filter((r) => /animation\s*:\s*none/.test(r)).map((r) => r.split("{")[0]);
    expect(off.join(" ")).toContain(".mc-thread .cx-day");
    expect(off.join(" ")).toContain(".mc-thread .cx-st");
  });
});

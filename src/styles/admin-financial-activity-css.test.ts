/**
 * Regras de CSS do Financeiro e das Atividades que o jsdom não confere (não calcula cascata): tokens no lugar de
 * literais, só os breakpoints oficiais do Admin, alvo de toque do botão de copiar e cabeçalho do antes/depois em
 * frase normal. Lê os arquivos como texto (o Vitest entrega `.css?raw` vazio).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(resolve(__dirname, name), "utf8");
const financial = read("admin-financial.css");
const activity = read("admin-activity.css");
const both: Record<string, string> = { "admin-financial.css": financial, "admin-activity.css": activity };

/** Sem comentários: os literais que sobraram em texto de comentário não contam. */
const code = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("Financeiro e Atividades: tokens no lugar de valores soltos", () => {
  it("superfície, hover, foco e raios vêm dos tokens do kit", () => {
    for (const [file, css] of Object.entries(both)) {
      const body = code(css);
      expect(body, file).not.toMatch(/#fff\b/i);
      expect(body, file).not.toMatch(/#e4e4e4|#e2e2e2/i);
      expect(body, file).not.toMatch(/rgba\(\s*5\s*,\s*5\s*,\s*5/);
      expect(body, file).not.toMatch(/outline:\s*3px solid var\(--brand\)/);
      expect(body, file).not.toMatch(/border-radius:\s*(14|16|18|20|24)px/);
    }
  });

  it("os fios finos vêm de --adm-rule (nada de --line do protótipo)", () => {
    for (const [file, css] of Object.entries(both)) expect(code(css), file).not.toMatch(/var\(--line\)/);
  });

  it("o foco por teclado usa o anel do kit", () => {
    expect(code(financial)).toMatch(/\.adm-fin-copy-btn:focus-visible[^{]*\{[^}]*box-shadow:\s*var\(--adm-ring\)/);
  });
});

describe("Financeiro e Atividades: breakpoints e peças que o kit passou a fazer", () => {
  it("só usa os breakpoints oficiais do Admin (560, 900, 1100)", () => {
    for (const [file, css] of Object.entries(both)) {
      const widths = [...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((m) => Number(m[1]));
      for (const width of widths) expect([560, 900, 1100], `${file}: ${width}px`).toContain(width);
      expect(css, file).not.toMatch(/@media\s*\(min-width/);
    }
  });

  it("não sobrou CSS do seletor de período, do botão Atualizar nem do seletor de autor próprios", () => {
    for (const [file, css] of Object.entries(both)) {
      expect(css, file).not.toMatch(/adm-fin-period|adm-fin-refresh|adm-act-refresh|adm-fin-bar|adm-act-actor|adm-fin-alert|adm-fin-recon/);
      expect(css, file).not.toMatch(/adm-act-(days|item|ico|skeleton|entry-head|entry-skeleton|more|pager)/);
    }
  });

  it("não sobrou CSS de parágrafo de 'i' nem de link de texto próprios (são do kit: Paragraph e textLink)", () => {
    for (const [file, css] of Object.entries(both)) {
      expect(css, file).not.toMatch(/adm-fin-help|adm-act-help|adm-fin-link|adm-act-link/);
    }
  });
});

describe("Financeiro: copiar id", () => {
  it("o botão de copiar tem o alvo de toque do Admin (var(--adm-hit)) e o id aparece inteiro", () => {
    const button = code(financial).match(/\.pv \.adm-fin-copy-btn \{([^}]*)\}/)?.[1] ?? "";
    expect(button).toMatch(/min-height:\s*var\(--adm-hit\)/);
    const text = code(financial).match(/\.pv \.adm-fin-copy-text \{([^}]*)\}/)?.[1] ?? "";
    expect(text).not.toMatch(/ellipsis|nowrap/);
    expect(text).toMatch(/overflow-wrap:\s*anywhere/);
  });
});

describe("Atividades: antes e depois", () => {
  it("o cabeçalho da tabela do diff é frase normal em 12.5px (sem caixa alta nem espaçamento largo)", () => {
    const head = code(activity).match(/\.pv \.adm-act-diff-head \{([^}]*)\}/)?.[1] ?? "";
    expect(head).toMatch(/font-size:\s*12\.5px/);
    expect(head).not.toMatch(/uppercase|letter-spacing/);
  });
});

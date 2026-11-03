/**
 * Regras de CSS do Admin que não aparecem em teste de componente (o jsdom não calcula cascata nem contraste):
 * contraste do texto secundário, anel de foco das abas e o botão "Suspender". Lê os arquivos como texto.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// O Vitest entrega `.css?raw` vazio (ele processa o CSS), então os arquivos são lidos do disco.
const read = (name: string) => readFileSync(resolve(__dirname, name), "utf8");
const platformCss = read("admin-platform.css");
const usersCss = read("admin-users.css");
const actionMenuCss = read("admin-kit-action-menu.css");
const teamCss = read("admin-team.css");
const prototypeCss = read("prototype.css");

const adminCssFiles: Record<string, string> = Object.fromEntries(
  readdirSync(__dirname)
    .filter((name) => /^admin-.*\.css$/.test(name))
    .map((name) => [name, read(name)]),
);
const adminSources = import.meta.glob(["../components/admin/**/*.tsx", "../screens/(private)/(admin)/**/*.tsx", "!**/*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(foreground: string, background: string): number {
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
const token = (css: string, name: string): string => {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`token ${name} não encontrado`);
  return match[1];
};

describe("contraste do texto secundário do Admin", () => {
  const muted = token(platformCss, "--adm-text-muted");

  it("a razão de contraste calculada bate com valores conhecidos", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#7e7e7e", "#ffffff")).toBeCloseTo(4.06, 1);
  });

  it("--adm-text-muted passa de 4.5:1 sobre o cartão branco, o fundo da página e o hover cinza", () => {
    expect(contrast(muted, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, token(prototypeCss, "--bg"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, "#e4e4e4")).toBeGreaterThanOrEqual(4.5);
  });

  it("o --muted do protótipo continua não passando (por isso o Admin não o usa em texto)", () => {
    expect(contrast(token(prototypeCss, "--muted"), token(prototypeCss, "--bg"))).toBeLessThan(4.5);
  });

  it("lê de fato os arquivos do Admin (o ?raw do Vitest viria vazio)", () => {
    expect(Object.keys(adminCssFiles).length).toBeGreaterThanOrEqual(9);
    expect(Object.values(adminCssFiles).every((css) => css.length > 500)).toBe(true);
  });

  it("nenhum arquivo admin-*.css usa var(--muted) como cor de texto", () => {
    const offenders = Object.entries(adminCssFiles).flatMap(([file, css]) =>
      css.split("\n").flatMap((line, i) => (/(?<![-\w])color:\s*var\(--muted\)/.test(line) ? [`${file}:${i + 1}`] : [])),
    );
    expect(offenders).toEqual([]);
  });

  it("o botão do segmentado sem seleção usa a cor legível", () => {
    expect(platformCss).toMatch(/\.pv \.adm-page \.seg button:not\(\.on\)[^{]*\{\s*color: var\(--adm-text-muted\)/);
  });
});

describe("anel de foco que não é cortado", () => {
  it(".adm-tabs corta o que sai dele (overflow-y:hidden): o anel da aba fica por dentro, depois da regra geral", () => {
    expect(platformCss).toMatch(/\.pv \.adm-tabs \{[^}]*overflow-y: hidden/);
    const general = platformCss.indexOf(".pv .adm-tab:focus-visible,");
    const inset = platformCss.search(/\.pv \.adm-tab:focus-visible \{ outline-offset: -\d+px; \}/);
    expect(general).toBeGreaterThan(-1);
    expect(inset).toBeGreaterThan(general);
  });

  it("os botões do segmentado (que rola em `.seg.sm`) também ficam com anel por dentro", () => {
    expect(platformCss).toMatch(/\.pv \.adm-page \.seg button:focus-visible[^{]*\{[^}]*outline-offset: -\d+px/);
  });
});

describe("botão Suspender (contorno vermelho)", () => {
  it("usa uma classe do kit com estilo explícito (tokens): fundo de superfície, texto e contorno vermelhos, preenchido no hover", () => {
    expect(actionMenuCss).toMatch(/\.pv \.btn\.adm-btn-danger-out \{[^}]*background: var\(--adm-surface\);[^}]*color: var\(--adm-bad\);[^}]*box-shadow: inset 0 0 0 1\.5px var\(--adm-bad\)/);
    expect(actionMenuCss).toMatch(/\.pv \.btn\.adm-btn-danger-out:hover:not\(:disabled\) \{[^}]*background: var\(--adm-bad\);[^}]*color: var\(--adm-surface\)/);
  });

  it("a cópia que Usuários tinha foi apagada: a regra mora só no kit", () => {
    expect(usersCss).not.toContain("adm-btn-danger-out");
  });

  it("o componente não usa `btn out dng`, que depende da ordem das regras do prototype.css", () => {
    const source = Object.entries(adminSources).find(([file]) => file.endsWith("users/admin-user-actions.tsx"))?.[1] ?? "";
    expect(source).toContain("adm-btn-danger-out");
    const offenders = Object.entries(adminSources).filter(([, src]) => /className="btn out dng"|btn out dng/.test(src)).map(([f]) => f);
    expect(offenders).toEqual([]);
  });

  it("a causa continua valendo: `.btn.dng` vem depois de `.btn.out` no protótipo e tem a mesma especificidade", () => {
    const out = prototypeCss.indexOf(".pv .btn.out { background: #fff; color: var(--ink); }");
    const filled = prototypeCss.indexOf(".pv .btn.dng { background: #e5262b; color: #fff; }");
    expect(out).toBeGreaterThan(-1);
    expect(filled).toBeGreaterThan(out);
  });
});

describe("texto só para leitor de tela (.adm-sr)", () => {
  // `position: absolute` sem top/left fica onde estaria no fluxo, que no fim de uma página longa é bem abaixo da janela.
  // Com o documento como bloco de contenção, o <main> (que rola) não o recorta e a janela ganha uma segunda barra de rolagem.
  it("a página (`.adm-page`) é posicionada: é ela o bloco de contenção do `.adm-sr`, que é absoluto e sem top/left", () => {
    const sr = platformCss.match(/\.pv \.adm-sr \{([^}]*)\}/)?.[1] ?? "";
    const page = platformCss.match(/\.pv \.adm-page \{([^}]*)\}/)?.[1] ?? "";
    expect(sr).toMatch(/position:\s*absolute/);
    expect(sr).not.toMatch(/(^|[\s;])(top|left|right|bottom|inset):/);
    expect(page).toMatch(/position:\s*relative/);
  });
});

describe("tokens, breakpoints e cabeçalhos do kit (admin-platform.css)", () => {
  // tudo que vem depois do bloco de tokens (`.pv { ... }`), onde os literais dos tokens são declarados
  const body = platformCss.slice(platformCss.indexOf("/* ───────────────────────── página"));

  it("só usa os três breakpoints oficiais em @media (560, 900, 1100) e a preferência de movimento", () => {
    const widths = [...platformCss.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((m) => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    for (const w of widths) expect([560, 900, 1100]).toContain(w);
    expect(platformCss).not.toMatch(/@media\s*\(min-width/);
  });

  it("fundo de superfície, hover, roxo de texto, anel de foco e sombra de popover vêm dos tokens", () => {
    expect(body).not.toMatch(/background:\s*#fff\b/);
    expect(body).not.toMatch(/#e4e4e4|#e2e2e2/i);
    expect(body).not.toMatch(/#7a1fc4/i);
    expect(body).not.toMatch(/inset 0 0 0 2px var\(--brand\)/);
    expect(body).not.toMatch(/box-shadow:\s*0 18px 40px/);
    expect(body).toMatch(/\.adm-pop \{[^}]*box-shadow:\s*var\(--adm-shadow-pop\)/);
    expect(body).toMatch(/\.adm-search:focus-within \{\s*box-shadow:\s*var\(--adm-ring\)/);
  });

  it("--adm-muted-strong continua existindo, mas é só um alias do --adm-text-muted", () => {
    expect(platformCss).toMatch(/--adm-muted-strong:\s*var\(--adm-text-muted\)/);
  });

  it("cabeçalho de coluna (tabela e cartão do celular) em frase normal, 12.5px, sem caixa alta nem espaçamento largo", () => {
    const th = platformCss.match(/\.pv \.adm-th \{([^}]*)\}/)?.[1] ?? "";
    expect(th).toMatch(/font-size:\s*12\.5px/);
    expect(th).not.toMatch(/uppercase|letter-spacing/);
    const before = platformCss.match(/\.pv \.adm-cell::before \{([^}]*)\}/)?.[1] ?? "";
    expect(before).toMatch(/font-size:\s*12\.5px/);
    expect(before).not.toMatch(/uppercase|letter-spacing/);
  });

  it("o h1 do cabeçalho é 32px acima de 900, 30px até 900 e 28px até 560", () => {
    expect(platformCss).toMatch(/\.pv \.adm-head h1 \{[^}]*font-size:\s*32px/);
    const tablet = platformCss.match(/@media \(max-width: 900px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(tablet).toMatch(/\.adm-head h1 \{ font-size: 30px; \}/);
    const phone = platformCss.match(/@media \(max-width: 560px\) \{\s*\n\s*\.pv \.adm-head h1([\s\S]*?)\n\}/)?.[0] ?? "";
    expect(phone).toMatch(/\.adm-head h1 \{ font-size: 28px; \}/);
  });

  it("'reduzir movimento' desliga as transições e a pulsação do kit", () => {
    const reduce = platformCss.slice(platformCss.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduce).toMatch(/\.adm-sk \{ animation: none; \}/);
    expect(reduce).toMatch(/transition:\s*none/);
  });
});

describe("Usuários e Equipe: tokens do kit e breakpoints oficiais", () => {
  for (const [name, css] of [
    ["admin-users.css", usersCss],
    ["admin-team.css", teamCss],
  ] as const) {
    it(`${name}: superfície, divisor e foco vêm dos tokens, sem literais soltos`, () => {
      expect(css).not.toMatch(/background:\s*#fff\b/);
      expect(css).not.toMatch(/#f4f4f4|#e4e4e4/i);
      expect(css).not.toMatch(/rgba\(5, 5, 5/);
      expect(css).not.toMatch(/outline:\s*3px solid var\(--brand\)/);
      expect(css).not.toMatch(/border-radius:\s*(14|16|18|20|24)px/);
    });

    it(`${name}: só usa os breakpoints oficiais (560, 900, 1100)`, () => {
      for (const match of css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)) expect([560, 900, 1100]).toContain(Number(match[1]));
    });
  }

  it("as classes dos seletores antigos (workspace e conta) saíram: o seletor é o do kit", () => {
    expect(usersCss).not.toMatch(/adm-users-picker|adm-users-tip|adm-users-proxy/);
    expect(teamCss).not.toMatch(/adm-team-result|adm-team-picked|adm-team-results/);
  });
});

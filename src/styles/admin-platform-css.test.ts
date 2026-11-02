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
  it("usa uma classe do Admin com estilo explícito: fundo branco, texto e contorno vermelhos, preenchido no hover", () => {
    expect(usersCss).toMatch(/\.pv \.btn\.adm-btn-danger-out \{[^}]*background: #fff;[^}]*color: var\(--adm-bad\);[^}]*box-shadow: inset 0 0 0 1\.5px var\(--adm-bad\)/);
    expect(usersCss).toMatch(/\.pv \.btn\.adm-btn-danger-out:hover:not\(:disabled\) \{[^}]*background: var\(--adm-bad\);[^}]*color: #fff/);
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

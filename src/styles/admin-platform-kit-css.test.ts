/** Regras de CSS do kit do Admin que o jsdom não calcula: lidas como texto (o Vitest entrega `.css?raw` vazio). */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "admin-platform.css"), "utf8");

/** O corpo de uma regra pelo seletor exato (primeira ocorrência). */
function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `regra ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start) + 1);
}

describe("admin-platform.css: ações do cabeçalho no celular", () => {
  it("o botão só-ícone (adm-refresh / data-icon-only) não estica", () => {
    const body = rule('.pv .adm-head-actions .btn:not(.adm-refresh):not([data-icon-only])');
    expect(body).toContain("flex: 1 1 auto");
  });

  it("não sobrou regra que estique todo .btn das ações", () => {
    expect(css).not.toMatch(/\.adm-head-actions \.btn \{ flex: 1 1 auto/);
  });
});

describe("admin-platform.css: links", () => {
  it(".adm-textlink: sublinhado fino, anel do Admin no foco e alvo de toque por token", () => {
    expect(rule(".pv .adm-textlink")).toMatch(/text-decoration: underline/);
    expect(rule(".pv .adm-textlink")).toMatch(/text-decoration-thickness: 1px/);
    expect(rule(".pv .adm-textlink:focus-visible")).toContain("var(--adm-ring)");
    expect(rule(".pv .adm-textlink::after")).toContain("var(--adm-hit)");
  });

  it("links dentro de .adm-cell crescem até --adm-hit sem tocar no link esticado da linha nem em botões", () => {
    const selector = ".pv .adm-cell a:not(.adm-row-link):not(.btn)::after";
    expect(rule(selector)).toContain("var(--adm-hit)");
    expect(rule(selector)).toContain("min(0px");
    // o esticado continua com a regra dele (inset: 0)
    expect(rule(".pv .adm-row-link::after")).toContain("inset: 0");
  });
});

describe("admin-platform.css: kit (strip, selo, apoio em 2 linhas)", () => {
  it("strip é uma grade auto-fit sem divisores", () => {
    expect(rule('.pv .adm-kv[data-layout="strip"]')).toContain("auto-fit");
    const row = rule('.pv .adm-kv[data-layout="strip"] > .adm-kv-row');
    expect(row).toContain("border-top: 0");
    expect(row).toContain("padding: 0");
  });

  it("selo do entity cell não encolhe e o apoio em 2 linhas usa line-clamp 2", () => {
    expect(rule(".pv .adm-entity-badge")).toContain("flex: none");
    expect(rule('.pv .adm-entity-text small[data-wrap="true"]')).toContain("-webkit-line-clamp: 2");
  });

  it("não há cor literal nas regras novas (só tokens)", () => {
    const added = [
      rule(".pv .adm-textlink"),
      rule(".pv .adm-textlink:focus-visible"),
      rule('.pv .adm-kv[data-layout="strip"]'),
      rule(".pv .adm-entity-badge"),
    ].join("\n");
    expect(added).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgba?\(/);
  });
});

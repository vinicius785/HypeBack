/**
 * Campos escuros das telas de acesso (`.au-form`, em `index.css`): o cartão do campo e o preenchimento automático do
 * navegador têm de usar a mesma cor, senão o campo preenchido aparece em dois tons (o autofill só pinta a caixa do
 * <input>, que fica dentro do cartão). O jsdom não aplica `:-webkit-autofill` nem calcula a cascata, então o teste
 * lê o CSS como texto e garante o que quebra sem avisar.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// O Vitest entrega `.css?raw` vazio (ele processa o CSS), então os arquivos são lidos do disco.
const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");
const css = read("../index.css").replace(/\/\*[\s\S]*?\*\//g, "");

/** Corpo da regra cujo último (ou único) seletor é `selector`. */
function bodyOf(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(match, `regra ${selector}`).not.toBeNull();
  return match![1];
}

describe("campos escuros das telas de acesso", () => {
  it("a cor do campo é uma variável só, opaca, definida em .au-form", () => {
    expect(css).toMatch(/\.au-form\s*\{\s*--au-field:\s*#[0-9a-f]{6}\s*;\s*\}/i);
    expect(css.match(/--au-field\s*:/g)).toHaveLength(1);
  });

  it("o cartão do campo usa a variável, com !important (ganha do bg-white do componente)", () => {
    expect(bodyOf(".au-form div.bg-white")).toMatch(/background-color:\s*var\(--au-field\)\s*!important/);
  });

  it("a tinta do preenchimento automático usa a mesma variável, sem cor fixa", () => {
    const autofill = bodyOf(".au-form input:-webkit-autofill:focus");
    expect(autofill).toMatch(/box-shadow:\s*0 0 0 1000px var\(--au-field\) inset/);
    expect(autofill).not.toMatch(/box-shadow:[^;]*#[0-9a-f]{3,8}/i);
  });

  it("o preenchimento automático vale no estado normal, com o mouse em cima e com foco", () => {
    for (const state of ["", ":hover", ":focus"]) {
      expect(css).toContain(`.au-form input:-webkit-autofill${state}`);
    }
  });

  it("o layout não troca o fundo do cartão por um utilitário do Tailwind (o !important dele ganharia da regra)", () => {
    const layout = read("../screens/(public)/_layout.tsx");
    expect(layout).toContain("au-form");
    expect(layout).not.toMatch(/\[&_div\.bg-white\]:!bg-/);
  });
});

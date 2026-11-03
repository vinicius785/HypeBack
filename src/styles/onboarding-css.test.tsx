/**
 * Campos da Configuração da conta (`.ob-form`, em `onboarding.css`): os componentes compartilhados (`Input`, `Select`,
 * `Textarea`) pintam o próprio fundo com utilitários do Tailwind, e a tela os reveste por seletores de estrutura
 * (`div.bg-white`, `button.bg-neutral-100`...). O jsdom não calcula a cascata, então o teste garante o que quebra sem
 * avisar: (1) cada seletor que o CSS usa ainda existe no CSS e ainda acerta um elemento dos componentes reais; (2) o
 * preenchimento automático do navegador usa a mesma cor opaca do cartão do campo, senão o campo preenchido aparece
 * em dois tons (como acontecia no login).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/text-area";

const css = readFileSync(resolve(__dirname, "onboarding.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Corpo da regra cujo seletor (lista inteira) termina em `selector`. */
function bodyOf(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(match, `regra ${selector}`).not.toBeNull();
  return match![1];
}

const FIELD_SELECTORS = [
  ".ob-form div.bg-white",
  ".ob-form button.bg-neutral-100",
  ".ob-form textarea",
  '.ob-form [role="alert"]',
];
const ERROR_SELECTORS = [
  '.ob-form div:has(> [role="alert"]) > div.bg-white',
  '.ob-form div:has(> [role="alert"]) > div > button.bg-neutral-100',
  '.ob-form div:has(> [role="alert"]) > textarea',
];

function renderForm() {
  return render(
    <div className="ob-form">
      <Input label="Nome" error="Obrigatório" />
      <Select label="Nicho" options={[]} error="Obrigatório" />
      <Textarea label="Sobre" error="Obrigatório" />
    </div>,
  ).container;
}

/**
 * O jsdom não entende `:has(> [role="alert"])`, então a regra de "campo com erro" é conferida pela estrutura que ela
 * descreve: o aviso é filho direto do bloco do campo, e o campo (cartão, botão do Select ou textarea) é filho dele.
 */
function blocksWithError(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="alert"]')].map((alert) => alert.parentElement!);
}
const childrenOf = (el: Element) => [...el.children];

describe("campos da Configuração da conta", () => {
  it.each([...FIELD_SELECTORS, ...ERROR_SELECTORS])("o CSS tem a regra %s", (selector) => {
    expect(css).toContain(selector);
  });

  it.each(FIELD_SELECTORS)("o seletor %s ainda acerta um elemento dos componentes reais", (selector) => {
    expect(renderForm().querySelector(selector), selector).not.toBeNull();
  });

  it("Input, Select e Textarea com erro mantêm a estrutura que a regra de campo com erro espera", () => {
    const blocks = blocksWithError(renderForm());
    expect(blocks).toHaveLength(3);

    const [input, select, textarea] = blocks;
    // `div:has(> [role="alert"]) > div.bg-white`
    expect(childrenOf(input).some((el) => el.matches("div.bg-white"))).toBe(true);
    // `div:has(> [role="alert"]) > div > button.bg-neutral-100`
    expect(childrenOf(select).some((el) => el.matches("div") && childrenOf(el).some((b) => b.matches("button.bg-neutral-100")))).toBe(true);
    // `div:has(> [role="alert"]) > textarea`
    expect(childrenOf(textarea).some((el) => el.matches("textarea"))).toBe(true);
  });

  it("a cor do campo é opaca e vem de uma variável, no formulário e no bloco de endereço", () => {
    expect(bodyOf(".ob-form")).toMatch(/--ob-field:\s*#(?:[0-9a-f]{6}|[0-9a-f]{3})\s*;/i);
    expect(bodyOf(".ob-group")).toMatch(/--ob-field:\s*#(?:[0-9a-f]{6}|[0-9a-f]{3})\s*;/i);
  });

  it("o cartão do campo usa a variável", () => {
    expect(bodyOf(".ob-form div.bg-white")).toMatch(/background-color:\s*var\(--ob-field\)/);
    expect(bodyOf(".ob-form button.bg-neutral-100")).toMatch(/background-color:\s*var\(--ob-field\)/);
    expect(bodyOf(".ob-form textarea")).toMatch(/background-color:\s*var\(--ob-field\)/);
  });

  it("a tinta do preenchimento automático é a mesma variável, sem cor fixa", () => {
    const autofill = bodyOf(".ob-form input:-webkit-autofill:focus");
    expect(autofill).toMatch(/box-shadow:\s*0 0 0 1000px var\(--ob-field\) inset/);
    expect(autofill).not.toMatch(/box-shadow:[^;]*#[0-9a-f]{3,8}/i);
  });

  it("o preenchimento automático vale no estado normal, com o mouse em cima e com foco", () => {
    for (const state of ["", ":hover", ":focus"]) {
      expect(css).toContain(`.ob-form input:-webkit-autofill${state}`);
    }
  });
});

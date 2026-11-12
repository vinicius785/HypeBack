/**
 * Regras de CSS de Campanhas e Criadores que não aparecem em teste de componente (o jsdom não calcula cascata nem
 * layout): breakpoints oficiais, tokens no lugar de literais, nenhuma tabela feita à mão e o alinhamento das redes no
 * cartão do celular. Lê os arquivos como texto (o `?raw` do Vitest viria vazio).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(resolve(__dirname, name), "utf8");
const campaignsCss = read("admin-campaigns.css");
const files: Record<string, string> = { "admin-campaigns.css": campaignsCss };

describe("Campanhas e Criadores: breakpoints e tokens", () => {
  it("só usam os breakpoints oficiais do Admin em @media (560, 900, 1100) e nenhum @container próprio", () => {
    for (const [name, css] of Object.entries(files)) {
      const widths = [...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((m) => Number(m[1]));
      expect(widths.length, name).toBeGreaterThan(0);
      for (const width of widths) expect([560, 900, 1100], `${name}: ${width}px`).toContain(width);
      // a responsividade da tabela é a do kit (`hideBelow`): nada de @container local para esconder coluna
      expect(css, name).not.toMatch(/@container/);
    }
  });

  it("superfície, hover, sombra de popover e raios vêm dos tokens, não de literais", () => {
    for (const [name, css] of Object.entries(files)) {
      expect(css, name).not.toMatch(/background:\s*#fff\b/i);
      expect(css, name).not.toMatch(/#e4e4e4|#e2e2e2/i);
      expect(css, name).not.toMatch(/box-shadow:\s*0 18px 40px/);
      // raios em px soltos (14, 16, 18, 20, 24) viram --adm-r-sm/md/lg
      expect(css, name).not.toMatch(/border-radius:\s*(14|16|18|20|24)px/);
      expect(css, name).not.toMatch(/var\(--adm-radius\)/);
    }
  });

  it("não deixa caixa alta pequena com espaçamento largo (texto em frase normal)", () => {
    for (const [name, css] of Object.entries(files)) {
      expect(css, name).not.toMatch(/text-transform:\s*uppercase/);
      expect(css, name).not.toMatch(/letter-spacing:\s*\.0[5-9]em/);
    }
  });
});

describe("Campanhas e Criadores: o que o kit passou a fazer", () => {
  it("os links de texto são `AdminLink textLink` do kit: nenhuma regra local de link sobrou (nem outline solto)", () => {
    for (const [name, css] of Object.entries(files)) {
      expect(css, name).not.toMatch(/adm-campaigns-link|adm-campaigns-ws-name a|adm-creators-first a|adm-creators-acct-name a/);
      expect(css, name).not.toMatch(/outline:\s*3px solid/);
    }
    for (const source of [
      "../components/admin/campaigns/admin-campaigns-list.tsx",
      "../components/admin/campaigns/admin-campaign-detail.tsx",
    ]) {
      expect(read(source), source).toMatch(/\btextLink\b/);
    }
  });

  it("nenhum literal de cor sobra nos dois arquivos (hex, rgb, rgba): tudo vem dos tokens", () => {
    for (const [name, css] of Object.entries(files)) {
      expect(css.replace(/\/\*[\s\S]*?\*\//g, ""), name).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    }
  });
});

describe("Campanhas: banner", () => {
  it("o comentário e a regra concordam: a imagem preenche a caixa 1:1 do banner (`cover`), que na proporção certa a mostra inteira", () => {
    expect(campaignsCss).toMatch(/\.pv \.adm-campaigns-banner img \{[^}]*object-fit: cover/);
    expect(campaignsCss).toMatch(/\.pv \.adm-campaigns-banner \{[^}]*aspect-ratio: 1 \/ 1/);
    expect(campaignsCss).not.toMatch(/sem corte/);
    expect(read("../components/admin/campaigns/admin-campaign-banner.tsx")).not.toMatch(/sem corte/);
  });

  it("a coluna de entregas destaca a pendência acima de zero com a cor de aviso do kit (contraste do kit)", () => {
    expect(campaignsCss).toMatch(/\.adm-campaigns-deliv \[data-pending="true"\] \{ color: var\(--adm-warn\); \}/);
  });
});


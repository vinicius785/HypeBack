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
const creatorsCss = read("admin-creators.css");
const files: Record<string, string> = { "admin-campaigns.css": campaignsCss, "admin-creators.css": creatorsCss };

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
      "../components/admin/creators/admin-creators-cells.tsx",
      "../components/admin/creators/admin-creators-duplicates.tsx",
    ]) {
      expect(read(source), source).toMatch(/\btextLink\b/);
    }
  });

  it("Inconsistências usam o AdminAlertItem do kit: o markup e o CSS locais saíram", () => {
    expect(creatorsCss).not.toMatch(/adm-creators-inc/);
    const source = read("../components/admin/creators/admin-creators-inconsistencies.tsx");
    expect(source).toMatch(/AdminAlertItem/);
    expect(source).not.toMatch(/adm-creators-inc/);
  });

  it("o trilho do período no 'Perfil da base' é o do kit (`.adm-card .adm-period-seg`): sem override local, sem barra de erro própria", () => {
    expect(creatorsCss).not.toMatch(/adm-period/);
    expect(creatorsCss).not.toMatch(/adm-creators-profile-tools|adm-creators-profile-body/);
  });

  it("nenhum literal de cor sobra nos dois arquivos (hex, rgb, rgba): tudo vem dos tokens", () => {
    for (const [name, css] of Object.entries(files)) {
      expect(css.replace(/\/\*[\s\S]*?\*\//g, ""), name).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    }
  });
});

describe("Campanhas: banner", () => {
  it("o comentário e a regra concordam: a imagem preenche a caixa 5:2 (`cover`), que na proporção certa a mostra inteira", () => {
    expect(campaignsCss).toMatch(/\.pv \.adm-campaigns-banner img \{[^}]*object-fit: cover/);
    expect(campaignsCss).toMatch(/\.pv \.adm-campaigns-banner \{[^}]*aspect-ratio: 5 \/ 2/);
    expect(campaignsCss).not.toMatch(/sem corte/);
    expect(read("../components/admin/campaigns/admin-campaign-banner.tsx")).not.toMatch(/sem corte/);
  });

  it("a coluna de entregas destaca a pendência acima de zero com a cor de aviso do kit (contraste do kit)", () => {
    expect(campaignsCss).toMatch(/\.adm-campaigns-deliv \[data-pending="true"\] \{ color: var\(--adm-warn\); \}/);
  });
});

describe("Criadores: células no cartão do celular", () => {
  it("a lista de redes ocupa a largura toda (é isso que alinha os seguidores à direita, sem colar no @)", () => {
    expect(creatorsCss).toMatch(/\.pv \.adm-creators-nets \{[^}]*width: 100%/);
    expect(creatorsCss).toMatch(/\.pv \.adm-creators-nets li \{[^}]*width: 100%/);
    expect(creatorsCss).toMatch(/\.pv \.adm-creators-net-n \{[^}]*margin-left: auto/);
    expect(creatorsCss).toMatch(/\.pv \.adm-creators-net-n \{[^}]*white-space: nowrap/);
  });

  it("as colunas que precisam de largura (redes, perfil, primeira campanha) pedem a linha inteira no cartão (`wide`)", () => {
    const source = read("../components/admin/creators/admin-creators-list.tsx");
    for (const key of ["networks", "registration", "first_campaign"]) {
      expect(source, key).toMatch(new RegExp(`key: "${key}",[\\s\\S]{0,160}?wide: true`));
    }
  });

  it("'+N itens' é o link de texto do kit (a área de toque vem de `.adm-textlink`) e só mantém o texto pequeno", () => {
    expect(read("../components/admin/creators/admin-creators-cells.tsx")).toMatch(/className="adm-textlink adm-creators-more"/);
    expect(creatorsCss).toMatch(/\.pv \.adm-creators-more \{[^}]*font-size: 12px/);
    expect(creatorsCss).not.toMatch(/\.adm-creators-more::after/);
  });

  it("cada dado da conta em Duplicados não parte no meio (a linha quebra entre os '·'), e só o e-mail pode quebrar", () => {
    expect(creatorsCss).toMatch(/\.adm-creators-acct-facts \[data-fact\] \{ white-space: nowrap; \}/);
    expect(creatorsCss).toMatch(/\.adm-creators-acct-facts \[data-fact="email"\] \{ white-space: normal; \}/);
  });

  it("não sobrou CSS de tabela própria (duplicados usam a AdminTable do kit)", () => {
    expect(creatorsCss).not.toMatch(/adm-creators-gu|adm-creators-group|adm-creators-pager|adm-creators-note/);
  });
});

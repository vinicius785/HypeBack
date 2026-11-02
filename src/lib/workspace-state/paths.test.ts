import { describe, expect, it } from "vitest";

import { isAccountScopedPath, isWorkspaceDetailPath } from "./paths";
import { SUPPORT_EMAIL, supportMailto } from "./support-contact";

describe("isAccountScopedPath", () => {
  it("Meu perfil é da conta, não do workspace", () => {
    expect(isAccountScopedPath("/settings")).toBe(true);
    expect(isAccountScopedPath("/settings/")).toBe(true);
    expect(isAccountScopedPath("/settings/seguranca")).toBe(true);
  });

  it("o resto do app é do workspace (inclusive as configurações do workspace)", () => {
    for (const path of ["/", "/campaigns", "/workspace/settings", "/financial", "/settingsx", "/admin/dashboard"]) {
      expect(isAccountScopedPath(path)).toBe(false);
    }
  });
});

describe("isWorkspaceDetailPath", () => {
  it("detalhe e criação dentro de campanhas, lives e perfis de criador", () => {
    for (const path of ["/campaigns/abc", "/campaigns/abc/edit", "/campaigns/new", "/lives/9", "/lives/new", "/influencer/12", "/campaigns/abc/influencer/9"]) {
      expect(isWorkspaceDetailPath(path)).toBe(true);
    }
  });

  it("as listas e telas de topo não são detalhe", () => {
    for (const path of ["/", "/campaigns", "/campaigns/", "/lives", "/creators", "/financial", "/workspace/settings", "/settings"]) {
      expect(isWorkspaceDetailPath(path)).toBe(false);
    }
  });
});

describe("supportMailto", () => {
  it("o e-mail de suporte é o que o produto já usa (página de suporte e app do criador)", () => {
    expect(SUPPORT_EMAIL).toBe("suporte@hypeapp.com.br");
  });

  it("sem assunto nem corpo é só o endereço", () => {
    expect(supportMailto()).toBe("mailto:suporte@hypeapp.com.br");
  });

  it("assunto e corpo vão codificados (espaço é %20, não +; aspas e acentos escapados)", () => {
    const url = supportMailto("Workspace suspenso: Café & Cia", 'O workspace "Café" (ID 1)');
    expect(url).toBe(
      "mailto:suporte@hypeapp.com.br?subject=Workspace%20suspenso%3A%20Caf%C3%A9%20%26%20Cia&body=O%20workspace%20%22Caf%C3%A9%22%20(ID%201)",
    );
    expect(url).not.toContain("+");
  });

  it("só o assunto, ou só o corpo", () => {
    expect(supportMailto("Oi")).toBe("mailto:suporte@hypeapp.com.br?subject=Oi");
    expect(supportMailto(undefined, "Oi")).toBe("mailto:suporte@hypeapp.com.br?body=Oi");
  });
});

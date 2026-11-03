import { describe, expect, it } from "vitest";

import {
  COMMUNITY_TAB_IDS,
  DEFAULT_COMMUNITY_TAB,
  GROUPS_TAB_SEARCH,
  resolveCommunityTab,
  validateCommunitySearch,
} from "./community-search";

describe("validateCommunitySearch", () => {
  it("deixa passar as abas conhecidas", () => {
    expect(validateCommunitySearch({ tab: "feed" })).toEqual({ tab: "feed" });
    expect(validateCommunitySearch({ tab: "groups" })).toEqual({ tab: "groups" });
  });

  it("descarta valor desconhecido ou que não é texto (a página cai no Feed)", () => {
    expect(validateCommunitySearch({ tab: "outra" })).toEqual({ tab: undefined });
    expect(validateCommunitySearch({ tab: 3 })).toEqual({ tab: undefined });
    expect(validateCommunitySearch({})).toEqual({ tab: undefined });
  });
});

describe("abas da Comunidade", () => {
  it("o Feed é a aba padrão, a primeira da lista", () => {
    expect(DEFAULT_COMMUNITY_TAB).toBe("feed");
    expect(COMMUNITY_TAB_IDS[0]).toBe("feed");
  });

  it("fechar um diálogo de grupo volta para a aba Grupos", () => {
    expect(GROUPS_TAB_SEARCH).toEqual({ tab: "groups" });
    expect(validateCommunitySearch(GROUPS_TAB_SEARCH).tab).toBe("groups");
  });
});

describe("resolveCommunityTab", () => {
  it("na própria Comunidade vale a aba da URL, com ou sem barra no fim", () => {
    expect(resolveCommunityTab("/admin/groups", "feed")).toBe("feed");
    expect(resolveCommunityTab("/admin/groups/", "feed")).toBe("feed");
    expect(resolveCommunityTab("/admin/groups", "groups")).toBe("groups");
  });

  it("com um diálogo de grupo aberto (criar ou abrir um grupo) é sempre Grupos, mesmo sem ?tab=", () => {
    expect(resolveCommunityTab("/admin/groups/new", "feed")).toBe("groups");
    expect(resolveCommunityTab("/admin/groups/abc-123", "feed")).toBe("groups");
  });
});

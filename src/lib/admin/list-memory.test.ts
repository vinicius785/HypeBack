import { afterEach, describe, expect, it } from "vitest";

import { forgetListSearch, recalledListSearch, rememberListSearch } from "./list-memory";

afterEach(() => {
  forgetListSearch("a");
  forgetListSearch("b");
  window.sessionStorage.clear();
});

describe("memória da lista (voltar do jeito que deixou)", () => {
  it("guarda e devolve a busca da lista, uma por chave", () => {
    rememberListSearch("a", { kind: "creator", sort_by: "name", order: "asc", page: 3 });
    rememberListSearch("b", { status: "deleted" });
    expect(recalledListSearch("a")).toEqual({ kind: "creator", sort_by: "name", order: "asc", page: 3 });
    expect(recalledListSearch("b")).toEqual({ status: "deleted" });
  });

  it("lista no padrão (busca vazia) apaga o que estava guardado", () => {
    rememberListSearch("a", { kind: "creator" });
    rememberListSearch("a", {});
    expect(recalledListSearch("a")).toBeUndefined();
  });

  it("sobrevive a recarregar a página (sessionStorage) e ignora lixo guardado", () => {
    window.sessionStorage.setItem("adm:list:a", JSON.stringify({ kind: "creator", x: { y: 1 }, n: 2 }));
    expect(recalledListSearch("a")).toEqual({ kind: "creator", n: 2 });
    window.sessionStorage.setItem("adm:list:b", "isto não é json");
    expect(recalledListSearch("b")).toBeUndefined();
    window.sessionStorage.setItem("adm:list:b", JSON.stringify(["x"]));
    expect(recalledListSearch("b")).toBeUndefined();
  });

  it("sem armazenamento disponível funciona só pela memória", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("bloqueado");
    };
    try {
      rememberListSearch("a", { status: "active" });
      expect(recalledListSearch("a")).toEqual({ status: "active" });
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

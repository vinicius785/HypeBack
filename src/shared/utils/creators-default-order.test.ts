import { describe, it, expect } from "vitest";

import { defaultCatalogOrder } from "./creators-default-order";

describe("defaultCatalogOrder", () => {
  it("sem escolha da pessoa, ordena do mais ativo para o menos ativo", () => {
    expect(defaultCatalogOrder({}, false)).toEqual({ order_by: "activity", order_dir: "desc" });
  });

  it("a escolha explícita vence o padrão", () => {
    expect(defaultCatalogOrder({ order_by: "followers", order_dir: "desc" }, false)).toEqual({
      order_by: "followers",
      order_dir: "desc",
    });
  });

  it("em 'Perto de mim' não força ordenação: a API ordena por distância", () => {
    expect(defaultCatalogOrder({}, true)).toEqual({});
  });
});

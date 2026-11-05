/** O Elenco virou um recorte de Criadores: a rota antiga só redireciona, sem perder links e favoritos. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  redirect: (options: unknown) => options,
}));

import { Route } from "@/screens/(private)/(app)/roster";

describe("rota /roster", () => {
  it("leva para Criadores, no recorte No elenco", () => {
    const { beforeLoad } = Route as unknown as { beforeLoad: () => void };
    expect(() => beforeLoad()).toThrow();
    try {
      beforeLoad();
    } catch (target) {
      expect(target).toMatchObject({ to: "/creators", search: { tab: "roster" }, replace: true });
    }
  });
});

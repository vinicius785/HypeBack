/**
 * A rota do Dashboard: mantém o id do arquivo (a árvore de rotas gerada depende dele), valida o período da URL e
 * monta a página nova. Fica em `src/test` porque tudo dentro de `src/screens` é lido pelo gerador de rotas.
 */
import { describe, expect, it, vi } from "vitest";

// Só `createFileRoute` é trocado (devolve o id e as opções); o resto do roteador segue real (o kit usa `Link` ao importar).
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: (id: string) => (options: Record<string, unknown>) => ({ id, options }),
}));

import { AdminDashboardPage } from "@/components/admin/dashboard/admin-dashboard-page";
import { readPeriodSearch } from "@/lib/admin/period";
import { Route } from "@/screens/(private)/(admin)/admin.dashboard";

const route = Route as unknown as {
  id: string;
  options: { component: unknown; validateSearch: (raw: Record<string, unknown>) => unknown };
};

describe("rota /admin/dashboard", () => {
  it("mantém o id do arquivo de rota", () => {
    expect(route.id).toBe("/(private)/(admin)/admin/dashboard");
  });

  it("monta a página nova do Dashboard", () => {
    expect(route.options.component).toBe(AdminDashboardPage);
  });

  it("valida só o período da URL: predefinido válido passa, o padrão e o lixo saem", () => {
    expect(route.options.validateSearch).toBe(readPeriodSearch);
    expect(route.options.validateSearch({ period: "week" })).toEqual({ period: "week" });
    expect(route.options.validateSearch({ period: "month" })).toEqual({});
    expect(route.options.validateSearch({ period: "custom", from: "2026-10-01", to: "2026-10-15" })).toEqual({
      period: "custom",
      from: "2026-10-01",
      to: "2026-10-15",
    });
    expect(route.options.validateSearch({ period: "custom", from: "ontem" })).toEqual({});
    expect(route.options.validateSearch({ page: 3, status: "x" })).toEqual({});
  });
});

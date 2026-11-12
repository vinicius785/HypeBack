import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/styles/management-board.css", () => ({}));
vi.mock("@/styles/admin-health.css", () => ({}));

import type { AdminSystemHealth } from "@/shared/admin-platform.types";

import { HealthIsland } from "./health-island";

const SYSTEM: AdminSystemHealth = {
  checked_at: "2026-11-11T12:00:00Z",
  database: { status: "ok", latency_ms: 24 },
  redis: { status: "ok", latency_ms: 16 },
  metrics_snapshot: { last_computed_at: "2026-11-11T11:00:00Z", age_hours: 1 },
  scheduled_jobs: { kind: "unavailable", definition: "Não há como medir." },
} as unknown as AdminSystemHealth;

const query = (over: Partial<UseQueryResult<AdminSystemHealth, unknown>> = {}) =>
  ({ data: SYSTEM, error: null, isFetching: false, refetch: vi.fn(), ...over }) as unknown as UseQueryResult<AdminSystemHealth, unknown>;

function setup(props: Partial<Parameters<typeof HealthIsland>[0]> = {}) {
  const onSeverityChange = vi.fn();
  const onRefresh = vi.fn();
  render(
    <HealthIsland system={query()} severity="" onSeverityChange={onSeverityChange} fetching={false} announce={false} onRefresh={onRefresh} {...props} />,
  );
  return { onSeverityChange, onRefresh };
}

describe("HealthIsland (Monitoramento)", () => {
  it("mostra o estado do sistema na pílula e as gravidades como filtros", async () => {
    const { onSeverityChange } = setup({ severity: "warning" });
    expect(screen.getByRole("region", { name: "Estado da plataforma" })).toHaveClass("isl");
    const group = within(screen.getByRole("group", { name: "Gravidade" }));
    expect(group.getAllByRole("button").map((b) => b.textContent)).toEqual(["Todas", "Crítico", "Atenção", "Informativo"]);
    expect(group.getByRole("button", { name: "Atenção" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(group.getByRole("button", { name: "Crítico" }));
    expect(onSeverityChange).toHaveBeenCalledWith("critical");
    await userEvent.click(group.getByRole("button", { name: "Todas" }));
    expect(onSeverityChange).toHaveBeenLastCalledWith("");
  });

  it("Banco e Redis ficam à direita, com bolinhas animadas; as gravidades à esquerda", () => {
    setup();
    const live = within(screen.getByRole("group", { name: "Serviços" }));
    expect(live.getByRole("status", { name: "Banco: operando" })).toHaveAttribute("data-state", "ok");
    expect(live.getByRole("status", { name: "Redis: operando" }).querySelectorAll(".isl-svc-dots i")).toHaveLength(3);
    const segs = screen.getByRole("group", { name: "Gravidade" });
    const servicos = screen.getByRole("group", { name: "Serviços" });
    expect(segs.compareDocumentPosition(servicos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("serviço fora do ar fica vermelho; desativado, parado; sem resposta, 'verificando'", () => {
    const { unmount } = render(
      <HealthIsland
        system={query({ data: { ...SYSTEM, redis: { status: "down", latency_ms: null } } as AdminSystemHealth })}
        severity=""
        onSeverityChange={vi.fn()}
        fetching={false}
        announce={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByRole("status", { name: "Redis: fora do ar" })).toHaveAttribute("data-state", "down");
    unmount();
    render(<HealthIsland system={query({ data: undefined })} severity="" onSeverityChange={vi.fn()} fetching={false} announce={false} onRefresh={vi.fn()} />);
    expect(screen.getByRole("status", { name: "Banco: verificando" })).toHaveAttribute("data-state", "checking");
  });

  it("a seta abre a folha com banco, Redis, snapshot e jobs; fechada, o conteúdo fica inerte", async () => {
    setup();
    const toggle = screen.getByRole("button", { name: "Abrir o estado do sistema" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(toggle.getAttribute("aria-controls") as string)).toHaveAttribute("inert");
    await userEvent.click(toggle);
    const sheet = within(screen.getByRole("region", { name: "Estado do sistema" }));
    for (const label of ["Banco de dados", "Redis", "Snapshot de métricas", "Jobs agendados"]) expect(sheet.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar o estado do sistema" })).toHaveAttribute("aria-expanded", "true");
  });

  it("atualizar chama a ação; anuncia só quando a pessoa clicou", async () => {
    const { onRefresh } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

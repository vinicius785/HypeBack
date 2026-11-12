import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/styles/management-board.css", () => ({}));
vi.mock("@/styles/admin-service.css", () => ({}));

import { ServiceIsland, type ServiceCounts } from "./service-island";
import { validateServiceSearch } from "./service-search";

const COUNTS: ServiceCounts = { supportActive: 4, supportDone: 7, unassigned: 3, mine: 1, inProgress: 1, waiting: 0, requestsPending: 2, requestsDone: 9 };

function setup(over: Partial<ServiceCounts> = {}, value: Parameters<typeof ServiceIsland>[0]["value"] = "support") {
  const onChange = vi.fn();
  render(<ServiceIsland value={value} onChange={onChange} counts={{ ...COUNTS, ...over }} />);
  return { onChange };
}

describe("ServiceIsland (Atendimento)", () => {
  it("duas filas de Suporte e duas de Solicitações, cada pílula com a sua contagem; a escolhida fica pressionada", async () => {
    const { onChange } = setup();
    const support = within(screen.getByRole("group", { name: "Suporte" }));
    expect(support.getByRole("button", { name: /^Ativos/ })).toHaveTextContent("4");
    expect(support.getByRole("button", { name: /^Ativos/ })).toHaveAttribute("aria-pressed", "true");
    expect(support.getByRole("button", { name: /^Resolvidos/ })).toHaveTextContent("7");
    const requests = within(screen.getByRole("group", { name: "Solicitações" }));
    expect(requests.getByRole("button", { name: /^Pendentes/ })).toHaveTextContent("2");
    expect(requests.getByRole("button", { name: /^Histórico/ })).toHaveTextContent("9");
    await userEvent.click(requests.getByRole("button", { name: /^Pendentes/ }));
    expect(onChange).toHaveBeenCalledWith("requests");
    await userEvent.click(support.getByRole("button", { name: /^Resolvidos/ }));
    expect(onChange).toHaveBeenLastCalledWith("support-done");
  });

  it("'Aguardando você' soma pedidos sem responsável e solicitações pendentes, com bolinhas animadas", () => {
    setup();
    const status = screen.getByRole("status", { name: "Aguardando você: 5" });
    expect(status).toHaveAttribute("data-state", "warn");
    expect(status.querySelectorAll(".isl-wait-dots i")).toHaveLength(3);
  });

  it("sem nada esperando: 'Tudo em dia'; sem resposta ainda: 'Verificando…'", () => {
    const { unmount } = render(<ServiceIsland value="support" onChange={vi.fn()} counts={{ ...COUNTS, unassigned: 0, requestsPending: 0 }} />);
    expect(screen.getByRole("status", { name: "Tudo em dia" })).toHaveAttribute("data-state", "ok");
    unmount();
    render(<ServiceIsland value="support" onChange={vi.fn()} counts={{ ...COUNTS, unassigned: null }} />);
    expect(screen.getByRole("status", { name: "Verificando a fila…" })).toHaveAttribute("data-state", "checking");
  });

  it("a seta abre a folha com o andamento do suporte", async () => {
    setup();
    const toggle = screen.getByRole("button", { name: "Abrir o andamento do suporte" });
    expect(document.getElementById(toggle.getAttribute("aria-controls") as string)).toHaveAttribute("inert");
    await userEvent.click(toggle);
    const sheet = within(screen.getByRole("region", { name: "Andamento do suporte" }));
    for (const label of ["Sem responsável", "Atribuídos a mim", "Em andamento", "Aguardando retorno"]) expect(sheet.getByText(label)).toBeInTheDocument();
  });
});

describe("validateServiceSearch", () => {
  it("só deixa passar uma fila conhecida", () => {
    expect(validateServiceSearch({ fila: "requests" })).toEqual({ fila: "requests" });
    expect(validateServiceSearch({ fila: "qualquer" })).toEqual({});
    expect(validateServiceSearch({})).toEqual({});
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ campaigns: vi.fn() }));

vi.mock("@/styles/management-board.css", () => ({}));
vi.mock("@/styles/admin-island.css", () => ({}));
vi.mock("@/styles/admin-island-bar.css", () => ({}));
vi.mock("@/styles/admin-campaigns.css", () => ({}));
vi.mock("@/hooks/admin/use-admin-campaigns", () => ({ useAdminCampaigns: (params: unknown, options?: unknown) => h.campaigns(params, options) }));

import { CampaignsIsland } from "./campaigns-island";

const total = (value: number) => ({ data: { meta: { total: value } } });
const OPTIONS = [
  { value: "", label: "Todas" },
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicadas" },
  { value: "finished", label: "Finalizadas" },
];

beforeEach(() => {
  h.campaigns.mockReset();
  h.campaigns.mockImplementation((params: { status?: string; created_from?: string; created_to?: string }) => {
    if (params.created_from && params.created_from === params.created_to) return total(2);
    if (params.created_from) return total(params.created_from.endsWith("-01") ? 30 : 9);
    if (params.status === "draft") return total(10);
    if (params.status === "published") return total(20);
    if (params.status === "finished") return total(70);
    // sem status = "Todas": traz também as inscrições (meta.applications)
    return { data: { meta: { total: 100, applications: { today: 4, last_7_days: 21, month_to_date: 55 } } } };
  });
});

function setup(value = "") {
  const onChange = vi.fn();
  render(
    <CampaignsIsland options={OPTIONS} value={value} onChange={onChange}>
      <input aria-label="Buscar" />
    </CampaignsIsland>,
  );
  return { onChange };
}

describe("CampaignsIsland (Campanhas)", () => {
  it("as pílulas de status levam a contagem de cada uma; a escolhida fica pressionada e clicar filtra", async () => {
    const { onChange } = setup("published");
    const group = within(screen.getByRole("group", { name: "Status da campanha" }));
    expect(group.getAllByRole("button").map((b) => b.textContent)).toEqual(["Todas100", "Rascunho10", "Publicadas20", "Finalizadas70"]);
    expect(group.getByRole("button", { name: /^Publicadas/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(group.getByRole("button", { name: /^Finalizadas/ }));
    expect(onChange).toHaveBeenCalledWith("finished");
    await userEvent.click(group.getByRole("button", { name: /^Todas/ }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("'Criadas hoje' (seta verde animada) conta as criadas no dia de hoje e atualiza sozinho", () => {
    setup();
    const stat = within(screen.getByRole("group", { name: "Agora" })).getByRole("status", { name: "Criadas hoje: 2" });
    expect(stat).toHaveAttribute("data-anim", "rise");
    const call = h.campaigns.mock.calls.find(([params]) => (params as { created_from?: string; created_to?: string }).created_from === (params as { created_to?: string }).created_to && (params as { created_from?: string }).created_from);
    expect((call?.[1] as { refetchInterval: number }).refetchInterval).toBe(60_000);
  });

  it("a barra da lista mora dentro da ilha, e a seta abre a folha (as contagens pesadas só ao abrir)", async () => {
    setup();
    expect(within(document.querySelector(".isl-tools") as HTMLElement).getByLabelText("Buscar")).toBeInTheDocument();
    // fechada, as consultas de 7 dias e do mês saem com `enabled: false`
    expect(h.campaigns.mock.calls.filter(([, options]) => (options as { enabled?: boolean } | undefined)?.enabled === false).length).toBe(2);
    await userEvent.click(screen.getByRole("button", { name: "Abrir o resumo das campanhas" }));
    const sheet = within(screen.getByRole("region", { name: "Resumo das campanhas" }));
    expect(sheet.getByText("Inscrições em 7 dias").parentElement).toHaveTextContent("21");
    expect(sheet.getByText("Inscrições no mês").parentElement).toHaveTextContent("55");
    expect(sheet.getByText("Criadas em 7 dias").parentElement).toHaveTextContent("9");
    expect(sheet.getByText("Criadas neste mês").parentElement).toHaveTextContent("30");
  });

  it("'Inscrições hoje' vem do meta.applications da lista e se atualiza sozinha (radar verde quando há inscrição)", () => {
    setup();
    const stat = within(screen.getByRole("group", { name: "Agora" })).getByRole("status", { name: "Inscrições hoje: 4" });
    expect(stat).toHaveAttribute("data-anim", "radar");
    expect(stat).toHaveAttribute("data-tone", "ok");
    // a consulta "Todas" (sem status) é a que traz o contador e atualiza a cada minuto
    const all = h.campaigns.mock.calls.find(([params, options]) => !(params as { status?: string; created_from?: string }).status && !(params as { created_from?: string }).created_from && (options as { refetchInterval?: number } | undefined)?.refetchInterval);
    expect((all?.[1] as { refetchInterval: number }).refetchInterval).toBe(60_000);
  });

  it("sem o contador na resposta (API antiga), 'Inscrições hoje' mostra '—' e nada quebra", () => {
    h.campaigns.mockImplementation((params: { status?: string }) => total(params.status ? 5 : 20));
    setup();
    expect(screen.getByRole("status", { name: "Inscrições hoje: —" })).not.toHaveAttribute("data-tone");
  });
});

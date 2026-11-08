/**
 * Gerenciamento: painel de detalhes acima do quadro (sem coluna lateral), resumo enquanto nada está selecionado,
 * clicar de novo no cartão recolhe, anterior/próximo trocam o criador sem fechar o painel.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ campaignId: "c1" }),
  useNavigate: () => vi.fn(),
}));
vi.mock("./kanban/panel-profile", () => ({ PanelProfile: () => null }));
vi.mock("@/hooks/use-niches", () => ({ useNiches: () => ({ data: [] }) }));
vi.mock("@/hooks/use-campaign-influencers", () => ({
  useUpdateInfluencerStatus: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/chat-drawer", () => ({ openChatDrawer: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./shared/selection-panel-actions", () => ({
  SelectionPanelActions: () => <div>ACOES-SELECAO</div>,
  isSelectionColumn: (c: string) => ["applications", "pre_selection", "pre_selection_curation", "curation"].includes(c),
}));
vi.mock("./shared/script-panel-actions", () => ({ ScriptPanelActions: () => null, isScriptColumn: () => false }));
vi.mock("./shared/content-panel-actions", () => ({ ContentPanelActions: () => null, isContentColumn: () => false }));
vi.mock("./shared/shipment-panel-actions", () => ({ ShipmentPanelActions: () => null, isShipmentColumn: () => false }));
vi.mock("./shared/price-negotiation-section", () => ({ PriceNegotiationSection: () => null }));

import { ManagementTab } from "./management-tab";
import type { CampaignManagementParticipant } from "@/shared/services/campaign-management";

const part = (id: string, name: string, status: string): CampaignManagementParticipant =>
  ({
    id,
    user_id: `u${id}`,
    name,
    username: name.toLowerCase().replace(/\s+/g, "."),
    avatar: "",
    followers: 1000,
    engagement: 2,
    status,
    social_networks: [],
    status_history: [{ id: `h${id}`, status, timestamp: "2026-10-25T10:00:00Z" }],
  }) as CampaignManagementParticipant;

const participants = [
  part("1", "Ana Lima", "applications"),
  part("2", "Bruno Dias", "applications"),
  part("3", "Carla Reis", "curation"),
];

function setup() {
  return render(<ManagementTab participants={participants} paymentType="paid" progress={30} phases={[]} phasesWithFormats={[]} />);
}

const panel = () => screen.queryByRole("region", { name: /^Detalhes de / });

describe("Gerenciamento: painel superior + quadro", () => {
  it("sem seleção: mostra o resumo e nenhum painel; o quadro ocupa a área (sem coluna lateral)", () => {
    const { container } = setup();
    expect(screen.getByRole("region", { name: "Resumo da campanha" })).toBeInTheDocument();
    expect(panel()).not.toBeInTheDocument();
    expect(container.querySelector("#s2h")).toBeNull();
    expect(container.querySelector(".mg.mgv")).not.toBeNull();
  });

  it("clicar num cartão abre o painel dele (no lugar do resumo) e o cartão fica marcado", async () => {
    const user = userEvent.setup();
    const { container } = setup();
    await user.click(screen.getByText("Bruno Dias"));
    expect(panel()).toHaveAccessibleName("Detalhes de Bruno Dias");
    expect(screen.queryByRole("region", { name: "Resumo da campanha" })).not.toBeInTheDocument();
    expect(container.querySelector(".kc.sel")).toHaveTextContent("Bruno Dias");
    // o painel vem ANTES do quadro (acima), dentro do mesmo layout
    const mg = container.querySelector(".mg")!;
    expect(mg.firstElementChild).toBe(panel());
  });

  it("clicar em outro cartão troca o conteúdo; clicar de novo no aberto recolhe e volta o resumo", async () => {
    const user = userEvent.setup();
    const { container } = setup();
    await user.click(screen.getByText("Ana Lima"));
    await user.click(screen.getByText("Carla Reis"));
    expect(panel()).toHaveAccessibleName("Detalhes de Carla Reis");
    await user.click(container.querySelector('[data-inf="3"] .kc-n')!);
    // a ilha do criador se recolhe um instante antes de dar lugar ao resumo
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Resumo da campanha" })).toBeInTheDocument();
  });

  it("próximo/anterior seguem a ordem do quadro (coluna a coluna) sem fechar o painel", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("Ana Lima"));
    const nav = within(panel()!);
    expect(nav.getByText("1 de 3")).toBeInTheDocument();
    await user.click(nav.getByRole("button", { name: "Próximo criador" }));
    expect(panel()).toHaveAccessibleName("Detalhes de Bruno Dias");
    await user.click(within(panel()!).getByRole("button", { name: "Próximo criador" }));
    expect(panel()).toHaveAccessibleName("Detalhes de Carla Reis"); // coluna Curadoria vem depois de Inscrições
    expect(within(panel()!).getByRole("button", { name: "Próximo criador" })).toBeDisabled();
    await user.click(within(panel()!).getByRole("button", { name: "Criador anterior" }));
    expect(panel()).toHaveAccessibleName("Detalhes de Bruno Dias");
  });

  it("o X do painel fecha e devolve o resumo", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("Ana Lima"));
    await user.click(screen.getByRole("button", { name: "Fechar detalhes" }));
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Resumo da campanha" })).toBeInTheDocument();
  });

  it("as ações da etapa aparecem no painel conforme a coluna do criador", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("Carla Reis"));
    expect(screen.getByText("ACOES-SELECAO")).toBeInTheDocument();
  });
});

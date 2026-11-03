/**
 * Ações da etapa Seleção no painel do card.
 *
 * Regressão: o painel mostrava só o resumo (sem botão de ação) porque procurava
 * o criador pelo id do kanban, e a lista de inscrições usa o `user_id`; além
 * disso a API devolve uma linha por criador E rede.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const updateStatus = vi.fn();

const row = (networkId: number, type: string) => ({
  id: "user-9",
  name: "Bia",
  username: "bia",
  avatar: "",
  social_networks: [
    { id: networkId, type, name: type, username: `bia_${type}`, status: "applications" },
  ],
});

vi.mock("@/hooks/use-campaign-tab-influencers", () => ({
  useCampaignInscriptions: () => ({
    isLoading: false,
    data: [row(1, "instagram"), row(2, "tiktok")],
  }),
  useCampaignCuration: () => ({ isLoading: false, data: [] }),
}));
vi.mock("@/hooks/use-campaign-influencers", () => ({
  useUpdateInfluencerStatus: () => ({ mutate: updateStatus, isPending: false }),
  useMoveToPreSelectionCuration: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-balance", () => ({
  useWorkspaceBalance: () => ({ data: { available_cents: 0, committed_cents: 0 } }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SelectionPanelActions } from "./selection-panel-actions";

describe("SelectionPanelActions", () => {
  it("acha o criador pelo user_id e mostra as ações de cada rede", () => {
    render(
      <SelectionPanelActions
        campaignId="c-1"
        influencerId="user-9"
        column="applications"
        paymentType="swap"
      />,
    );

    expect(screen.getAllByRole("button", { name: "Aprovar" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Curadoria" })).toHaveLength(2);
    expect(screen.getByText("@bia_instagram")).toBeInTheDocument();
    expect(screen.getByText("@bia_tiktok")).toBeInTheDocument();
  });

  it("não mostra ações para um id que não está na lista", () => {
    render(
      <SelectionPanelActions
        campaignId="c-1"
        influencerId="outro"
        column="applications"
        paymentType="swap"
      />,
    );

    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
  });
});

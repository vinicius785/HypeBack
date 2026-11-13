/**
 * Ações da etapa Seleção no painel do card.
 *
 * Regressão: o painel mostrava só o resumo (sem botão de ação) porque procurava
 * o criador pelo id do kanban, e a lista de inscrições usa o `user_id`; além
 * disso a API devolve uma linha por criador E rede.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
    data: [row(1, "instagram"), row(2, "tiktok"), row(3, "ugc")],
  }),
  useCampaignCuration: () => ({ isLoading: false, data: [] }),
}));
vi.mock("@/hooks/use-campaign-influencers", () => ({
  useUpdateInfluencerStatus: () => ({ mutate: updateStatus, isPending: false }),
  useMoveToPreSelectionCuration: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-balance", () => ({
  useWorkspaceBalance: () => ({ data: { available_cents: 500000, committed_cents: 100000 } }),
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

  it("UGC é tipo de conteúdo, não rede: não ganha card de decisão", () => {
    render(
      <SelectionPanelActions
        campaignId="c-1"
        influencerId="user-9"
        column="applications"
        paymentType="swap"
      />,
    );

    expect(screen.queryByText("@bia_ugc")).not.toBeInTheDocument();
    expect(screen.queryByText(/Recusar UGC/)).not.toBeInTheDocument();
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

  it("sem custo (permuta) aprovar não reserva saldo: aprova direto aquela rede, sem confirmação", async () => {
    const user = userEvent.setup();
    updateStatus.mockClear();
    render(
      <SelectionPanelActions campaignId="c-1" influencerId="user-9" column="applications" paymentType="swap" />,
    );
    await user.click(screen.getAllByRole("button", { name: "Aprovar" })[1]);
    expect(screen.queryByRole("group", { name: /Confirmar aprovação de/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved", network_id: 2 }),
      expect.anything(),
    );
  });

  it("com reserva de saldo, a confirmação mostra o custo e a mudança do disponível", async () => {
    const user = userEvent.setup();
    render(
      <SelectionPanelActions
        campaignId="c-1"
        influencerId="user-9"
        column="applications"
        paymentType="fixed"
        phasesWithFormats={[]}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: "Aprovar" })[0]);
    const confirm = screen.getByRole("group", { name: /Confirmar aprovação de/ });
    expect(within(confirm).getByText("Custo de aprovação")).toBeInTheDocument();
    expect(within(confirm).getByText("Disponível agora")).toBeInTheDocument();
    expect(within(confirm).getByText("Disponível após")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // só aquele cartão virou confirmação; o da outra rede segue com as ações normais
    expect(screen.getAllByRole("button", { name: "Aprovar" })).toHaveLength(1);
    await user.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("group", { name: /Confirmar aprovação de/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Aprovar" })).toHaveLength(2);
  });

  it("recusar pede o motivo no próprio cartão e só confirma com texto", async () => {
    const user = userEvent.setup();
    updateStatus.mockClear();
    render(
      <SelectionPanelActions campaignId="c-1" influencerId="user-9" column="applications" paymentType="swap" />,
    );
    await user.click(screen.getAllByRole("button", { name: /^Recusar/ })[0]);
    const box = screen.getByRole("group", { name: /Confirmar recusa de/ });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const ok = within(box).getByRole("button", { name: "Confirmar recusa" });
    expect(ok).toBeDisabled();
    await user.type(within(box).getByRole("textbox"), "  Fora do nicho  ");
    expect(ok).toBeEnabled();
    await user.click(ok);
    expect(updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected", feedback: "Fora do nicho", network_id: 1 }),
      expect.anything(),
    );
  });
});

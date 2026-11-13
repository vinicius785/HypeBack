import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  invite: vi.fn(async () => undefined),
  bulk: vi.fn(async (d: { influencer_ids: unknown[] }) => d.influencer_ids.map((id) => ({ influencer_id: id, ok: true }))),
  pre: vi.fn(async () => undefined),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/hooks/use-campaigns", () => ({
  useCampaigns: () => ({ data: [{ id: "c1", title: "Verão", status: "published", banner: null }], isLoading: false }),
  useCampaign: () => ({ data: { payment_method: "fixed" } }),
}));
vi.mock("@/hooks/use-campaign-influencers", () => ({
  useInviteInfluencer: () => ({ mutateAsync: h.invite, isPending: false }),
  useAddToPreSelection: () => ({ mutateAsync: h.pre, isPending: false }),
  useInviteInfluencersBulk: () => ({ mutateAsync: h.bulk, isPending: false }),
}));
vi.mock("@/lib/utils/api", () => ({ getUploadUrl: (x: string) => x }));
vi.mock("@/hooks/use-influencer-accounts", () => ({ useInfluencerAccounts: () => ({ data: undefined, isLoading: false, isError: false }) }));

import { CampaignPickerModal } from "./campaign-picker-modal";

beforeEach(() => vi.clearAllMocks());

describe("CampaignPickerModal", () => {
  it("convite individual envia a fase de entrada escolhida", async () => {
    render(<CampaignPickerModal mode="invite" influencerId="7" influencerName="Ana" profileIds={["p1"]} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /Verão/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Curadoria" }));
    fireEvent.click(screen.getByRole("button", { name: /Enviar convite/ }));
    await waitFor(() => expect(h.invite).toHaveBeenCalled());
    expect(h.invite).toHaveBeenCalledWith(expect.objectContaining({ influencer_id: "7", profile_ids: ["p1"], entry_status: "curation" }));
  });

  it("pré-seleção não envia fase de entrada", async () => {
    render(<CampaignPickerModal mode="preselection" influencerId="7" influencerName="Ana" profileIds={["p1"]} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /Verão/ }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar à pré-seleção/ }));
    await waitFor(() => expect(h.pre).toHaveBeenCalled());
    expect(h.pre.mock.calls[0][0]).not.toHaveProperty("entry_status");
  });

  it("lote: um pedido com os ids e a fase; falhas aparecem no aviso", async () => {
    h.bulk.mockResolvedValueOnce([
      { influencer_id: 1, ok: true },
      { influencer_id: 2, ok: false, error: "Saldo insuficiente" },
    ] as never);
    render(
      <CampaignPickerModal
        mode="invite"
        influencerId="bulk"
        influencerName="2 criadores"
        bulk={{ creators: [{ id: 1, name: "Ana" }, { id: 2, name: "Bia" }] }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Verão/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enviar 2 convites/ }));
    await waitFor(() => expect(h.bulk).toHaveBeenCalled());
    expect(h.bulk).toHaveBeenCalledWith(expect.objectContaining({ influencer_ids: [1, 2], entry_status: "applications" }));
    await waitFor(() => expect(h.toast.warning).toHaveBeenCalled());
    expect(String(h.toast.warning.mock.calls[0][0])).toMatch(/Bia \(Saldo insuficiente\)/);
  });
});

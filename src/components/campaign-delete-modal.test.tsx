import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ deleteCampaign: vi.fn(), toastSuccess: vi.fn() }));

vi.mock("@/shared/services/campaign", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/services/campaign")>();
  return { ...actual, deleteCampaign: mocks.deleteCampaign };
});
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));

import { CampaignDeleteModal, campaignDeleteErrorText } from "./campaign-delete-modal";

const TITLE = "Verão Hype";

function setup() {
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CampaignDeleteModal campaignId="camp-1" title={TITLE} onClose={onClose} onDeleted={onDeleted} />
    </QueryClientProvider>,
  );
  return { onClose, onDeleted, user: userEvent.setup() };
}

const confirm = () => screen.getByRole("button", { name: "Excluir campanha" });
const titleInput = () => screen.getByLabelText(/digite o título da campanha/i);

beforeEach(() => {
  mocks.deleteCampaign.mockReset();
  mocks.toastSuccess.mockReset();
});
afterEach(() => cleanup());

describe("CampaignDeleteModal", () => {
  it("só habilita com o título digitado (sem diferenciar maiúsculas nem espaços nas pontas)", async () => {
    const { user } = setup();
    expect(confirm()).toBeDisabled();
    await user.type(titleInput(), "outro");
    expect(confirm()).toBeDisabled();
    await user.clear(titleInput());
    await user.type(titleInput(), "  verão HYPE ");
    expect(confirm()).toBeEnabled();
    expect(mocks.deleteCampaign).not.toHaveBeenCalled();
  });

  it("confirma: exclui a campanha, avisa, fecha e avisa a tela para sair dela", async () => {
    mocks.deleteCampaign.mockResolvedValue(undefined);
    const { user, onClose, onDeleted } = setup();
    await user.type(titleInput(), TITLE);
    await user.click(confirm());

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(mocks.deleteCampaign).toHaveBeenCalledWith("camp-1");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Campanha excluída.");
    expect(onClose).toHaveBeenCalled();
  });

  it("a API recusa (já movimentou saldo): mostra o motivo, continua aberto e não sai da tela", async () => {
    mocks.deleteCampaign.mockRejectedValue({
      message: "Não é possível excluir esta campanha porque ela já movimentou dinheiro dos criadores.",
    });
    const { user, onClose, onDeleted } = setup();
    await user.type(titleInput(), TITLE);
    await user.click(confirm());

    expect(await screen.findByRole("alert")).toHaveTextContent("já movimentou dinheiro dos criadores");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(confirm()).toBeEnabled();
  });
});

describe("campaignDeleteErrorText", () => {
  it("usa a mensagem da API (texto ou lista) e, sem nada, o texto padrão", () => {
    expect(campaignDeleteErrorText({ message: "Falhou." })).toBe("Falhou.");
    expect(campaignDeleteErrorText({ message: ["A.", "B."] })).toBe("A. B.");
    expect(campaignDeleteErrorText(null)).toMatch(/Não foi possível excluir/);
  });
});

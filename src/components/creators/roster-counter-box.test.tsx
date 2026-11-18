import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ answer: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast: api.toast }));
vi.mock("@/shared/services/agency-roster", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/shared/services/agency-roster")>()), answerRosterCounter: api.answer }));
vi.mock("@/hooks/use-workspace-query-key", () => ({ useWorkspaceQueryKey: () => "ws", withWorkspaceKey: (key: unknown[]) => key }));
vi.mock("@/hooks/use-agency-brands", () => ({ useIsAgencyWorkspace: () => true }));

import type { RosterMember } from "@/shared/services/agency-roster";

import { RosterCounterBox } from "./roster-counter-box";

const member: RosterMember = {
  id: "r1",
  status: "invited",
  exclusive: true,
  commission_percent: 15,
  counter_offer: { commission_percent: 10, message: "Posso fechar por 10%?", created_at: "2026-11-04T00:00:00Z" },
  leave_requested_at: null,
  leaves_at: null,
  invited_at: "2026-11-03T00:00:00Z",
  responded_at: null,
  creator: { id: 7, name: "Bia Alves", photo: null, username: "bia", followers_total: 0, networks: [] },
};

function renderBox(canWrite = true) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RosterCounterBox member={member} canWrite={canWrite} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.answer.mockResolvedValue(member);
});

describe("Proposta do criador", () => {
  it("mostra a proposta, a comissão do convite e a mensagem", () => {
    renderBox();
    expect(screen.getByText("Bia Alves propõe 10%")).toBeInTheDocument();
    expect(screen.getByText(/O convite está em 15%/)).toBeInTheDocument();
    expect(screen.getByText(/Posso fechar por 10%\?/)).toBeInTheDocument();
  });

  it("aceitar e recusar mandam a ação certa", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.click(screen.getByRole("button", { name: "Aceitar 10%" }));
    await waitFor(() => expect(api.answer).toHaveBeenCalledWith("r1", { action: "accept" }));
    await user.click(screen.getByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(api.answer).toHaveBeenCalledWith("r1", { action: "decline" }));
  });

  it("nova oferta valida a comissão e manda o percentual", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.click(screen.getByRole("button", { name: "Fazer nova oferta" }));
    await user.click(screen.getByRole("button", { name: "Enviar oferta" }));
    expect(await screen.findByText("Informe a comissão.")).toBeInTheDocument();
    expect(api.answer).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Nova oferta"), "12,5");
    await user.click(screen.getByRole("button", { name: "Enviar oferta" }));
    await waitFor(() => expect(api.answer).toHaveBeenCalledWith("r1", { action: "offer", commission_percent: 12.5 }));
  });

  it("invalid_commission da API aparece no campo, com o texto da API", async () => {
    api.answer.mockRejectedValue(Object.assign(new Error("Comissão inválida: use de 0 a 100, com no máximo uma casa decimal."), { bodyCode: "invalid_commission", status: 422 }));
    const user = userEvent.setup();
    renderBox();
    await user.click(screen.getByRole("button", { name: "Fazer nova oferta" }));
    await user.type(screen.getByLabelText("Nova oferta"), "12");
    await user.click(screen.getByRole("button", { name: "Enviar oferta" }));
    expect(await screen.findByText(/Comissão inválida: use de 0 a 100/)).toBeInTheDocument();
    expect(api.toast.error).not.toHaveBeenCalled();
  });

  it("quem só lê vê a proposta mas não os botões", () => {
    renderBox(false);
    expect(screen.getByText("Bia Alves propõe 10%")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

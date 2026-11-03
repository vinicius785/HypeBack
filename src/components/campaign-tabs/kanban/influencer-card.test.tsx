import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ExtendedInfluencer } from "../management-kanban-config";
import { InfluencerCardView, type CardHandlers } from "./influencer-card";

const inf = {
  id: "1",
  name: "Maria Fernanda de Albuquerque Souza",
  username: "mariafe",
  avatar: "",
  followers: 12500,
  engagement: 4.2,
  niche: "",
  status: "applications",
  socialNetwork: "instagram",
  statusHistory: [{ id: "a", status: "applications", timestamp: "2026-03-05T15:00:00Z" }],
} as unknown as ExtendedInfluencer;

const handlers = (): CardHandlers => ({
  onSelect: vi.fn(),
  onAction: vi.fn(),
  onChat: vi.fn(),
  onProfile: vi.fn(),
  onReject: vi.fn(),
});

describe("InfluencerCardView", () => {
  it("mostra nome inteiro, @usuário, rede e métricas com rótulo", () => {
    render(<InfluencerCardView influencer={inf} column="applications" handlers={handlers()} />);
    expect(screen.getByText("Maria Fernanda de Albuquerque Souza")).toBeTruthy();
    expect(screen.getByText(/@mariafe/)).toBeTruthy();
    expect(screen.getByText(/Instagram/)).toBeTruthy();
    expect(screen.getByText("Seguidores")).toBeTruthy();
    expect(screen.getByText("Engajamento")).toBeTruthy();
    expect(screen.getByText("4,2%")).toBeTruthy();
    expect(screen.getByText("Inscrito em 05/03")).toBeTruthy();
  });

  it("a ação principal acompanha a etapa e não abre o painel junto", () => {
    const h = handlers();
    render(<InfluencerCardView influencer={inf} column="curation" handlers={h} />);
    fireEvent.click(screen.getByRole("button", { name: "Convidar" }));
    expect(h.onAction).toHaveBeenCalledWith(inf, "curation");
  });

  it("etapa sem ação do gestor mostra o que se espera, sem botão", () => {
    render(<InfluencerCardView influencer={inf} column="content_pending" handlers={handlers()} />);
    expect(screen.getByText("Gravando")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Revisar conteúdo" })).toBeNull();
  });

  it("menu: chat, perfil e recusar (só onde cabe)", () => {
    const h = handlers();
    render(<InfluencerCardView influencer={inf} column="script_pending" handlers={h} />);
    fireEvent.click(screen.getByRole("button", { name: /Mais ações de/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Abrir chat" }));
    expect(h.onChat).toHaveBeenCalledWith(inf);
    fireEvent.click(screen.getByRole("button", { name: /Mais ações de/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Recusar" }));
    expect(h.onReject).toHaveBeenCalledWith(inf);
  });

  it("na curadoria o menu não oferece Recusar (a decisão é no painel)", () => {
    render(<InfluencerCardView influencer={inf} column="curation" handlers={handlers()} />);
    fireEvent.click(screen.getByRole("button", { name: /Mais ações de/ }));
    expect(screen.queryByRole("menuitem", { name: "Recusar" })).toBeNull();
  });

  it("mostra 'Movendo…' durante a movimentação e trava o botão", () => {
    render(<InfluencerCardView influencer={inf} column="curation" handlers={handlers()} moving />);
    expect(screen.getByText("Movendo…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Convidar" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

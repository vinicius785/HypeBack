import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/styles/creator-cards.css", () => ({}));
vi.mock("@/hooks/use-influencer-accounts", () => ({ useInfluencerAccounts: () => ({ data: undefined }) }));

import type { CreatorGroup } from "@/shared/utils/group-creators";

import { CreatorCard, type CreatorCardProps } from "./creator-card";

const sn = (id: number, type: string, username: string, members: number, eng: number | null) =>
  ({ id, type, username, name: type, members, engagement_percent: eng, photo: null }) as never;

function group(accounts: unknown[], niches: string[] = []): CreatorGroup {
  const user = { id: 7, name: "Ana Souza", photo: null } as never;
  return {
    key: "7",
    user,
    accounts: accounts.map((social_network) => ({ social_network, user, niches: [] })) as never,
    niches: niches.map((name, id) => ({ id, name })) as never,
    distance_km: null,
  };
}

function setup(over: Partial<CreatorCardProps> = {}, g: CreatorGroup = group([sn(1, "instagram", "ana", 22_000, 4.2)], ["Moda"])) {
  const props: CreatorCardProps = {
    group: g, k: 0, selected: false, near: false, saved: false,
    onSelect: vi.fn(), onOpen: vi.fn(), onInvite: vi.fn(), onSave: vi.fn(), ...over,
  };
  render(<CreatorCard {...props} />);
  return props;
}

describe("CreatorCard", () => {
  it("mostra nome, @ da rede principal e métricas formatadas", () => {
    setup();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getAllByText("@ana").length).toBeGreaterThan(0);
    const list = screen.getByRole("list", { name: "Métricas por rede social" });
    expect(within(list).getByText("22 mil")).toBeInTheDocument();
    expect(within(list).getByText("seguidores · 4,2% eng.")).toBeInTheDocument();
  });

  it("não inventa métrica: sem audiência vira 'sem dados' e engajamento ruim não aparece", () => {
    setup({}, group([sn(1, "tiktok", "a", 0, 3), sn(2, "instagram", "b", 14, 5814.3)]));
    expect(screen.getByText("sem dados")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/5814/)).toBeNull();
    expect(screen.queryByText(/0,0%/)).toBeNull();
  });

  it("sem redes: estado próprio, sem lista de métricas", () => {
    setup({}, group([]));
    expect(screen.getByText("Sem redes sociais")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma rede social conectada ainda")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Métricas por rede social" })).toBeNull();
  });

  it("no máximo duas categorias e o resto em +N", () => {
    setup({}, group([sn(1, "instagram", "ana", 1000, null)], ["A", "B", "C", "D"]));
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.queryByText("C")).toBeNull();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("mostra duas redes e abre as demais em '+N redes'", () => {
    setup({}, group([sn(1, "instagram", "a", 3000, 2), sn(2, "tiktok", "b", 2000, 2), sn(3, "youtube", "c", 1000, 2)]));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    const more = screen.getByRole("button", { name: "+1 rede" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Mostrar menos" })).toHaveAttribute("aria-expanded", "true");
  });

  it("favoritar é um botão de alternância e não abre o perfil", () => {
    const p = setup({ saved: true });
    const fav = screen.getByRole("button", { name: "Salvar em lista" });
    expect(fav).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(fav);
    expect(p.onSave).toHaveBeenCalledTimes(1);
    expect(p.onOpen).not.toHaveBeenCalled();
  });

  it("ver perfil, convidar e o cartão abrem/convidam sem se confundir", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Convidar" }));
    expect(p.onInvite).toHaveBeenCalledTimes(1);
    expect(p.onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ver perfil" }));
    expect(p.onOpen).toHaveBeenCalledTimes(1);
  });

  it("elenco: selo distinto de 'salvo'; só quem não tem vínculo ganha a ação", () => {
    setup({ rosterStatus: "active", onRoster: vi.fn() });
    expect(screen.getByText("No elenco")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /para o elenco/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Salvar em lista" })).toHaveAttribute("aria-pressed", "false");
  });

  it("agência: 'Adicionar ao elenco' dispara a ação e mostra o envio em andamento", () => {
    const onRoster = vi.fn();
    setup({ onRoster });
    fireEvent.click(screen.getByRole("button", { name: "Convidar Ana Souza para o elenco" }));
    expect(onRoster).toHaveBeenCalledTimes(1);
  });

  it("convite em andamento trava o botão", () => {
    setup({ onRoster: vi.fn(), rosterBusy: true });
    const b = screen.getByRole("button", { name: "Convidar Ana Souza para o elenco" });
    expect(b).toBeDisabled();
    expect(b).toHaveTextContent("Enviando…");
  });

  it("convite enviado ao elenco aparece como 'Convite enviado'", () => {
    setup({ rosterStatus: "invited" });
    expect(screen.getByText("Convite enviado")).toBeInTheDocument();
  });
});

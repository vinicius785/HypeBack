import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  InfluencerProfileCard,
  type InfluencerCardData,
} from "./influencer-profile-card";

// O card lê permissões do workspace só para decidir se mostra o bloco de preços.
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspacePermissions: () => ({ influencer_values_read: false }),
}));

function data(partial: Partial<InfluencerCardData> = {}): InfluencerCardData {
  return {
    profileKey: "99-5",
    influencerName: "Ana Souza",
    influencerAvatar: "",
    profileType: "instagram",
    profileTypeLabel: "Instagram",
    profileUsername: "anasouza",
    influencerFollowers: 12500,
    profileFollowers: 12500,
    influencerEngagement: 4.2,
    ...partial,
  };
}

describe("InfluencerProfileCard — nichos e sub-nichos", () => {
  // Regressão: o card renderizava um chip com o texto fixo "Nichos" e descartava
  // os nomes, então nicho e sub-nicho não apareciam em lugar nenhum.
  it("renderiza os nomes dos nichos, não um rótulo genérico", () => {
    render(
      <InfluencerProfileCard data={data()} nicheNames={["Moda", "Beleza"]} />
    );

    expect(screen.getByText("Moda")).toBeInTheDocument();
    expect(screen.getByText("Beleza")).toBeInTheDocument();
    expect(screen.queryByText("Nichos")).not.toBeInTheDocument();
  });

  it("divide o rótulo único da API em um chip por nicho", () => {
    render(
      <InfluencerProfileCard data={data()} nicheName="Moda, Beleza" />
    );

    expect(screen.getByText("Moda")).toBeInTheDocument();
    expect(screen.getByText("Beleza")).toBeInTheDocument();
  });

  it("mostra os 2 primeiros e resume o resto em '+N mais'", () => {
    render(
      <InfluencerProfileCard
        data={data()}
        nicheNames={["Moda", "Beleza", "Skincare", "Fitness"]}
      />
    );

    expect(screen.getByText("Moda")).toBeInTheDocument();
    expect(screen.getByText("Beleza")).toBeInTheDocument();
    expect(screen.queryByText("Skincare")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ver mais 2 nichos/i })).toBeInTheDocument();
  });

  it("'+N mais' abre o modal com todos os nichos e sub-nichos", () => {
    render(
      <InfluencerProfileCard
        data={data()}
        nicheNames={["Moda", "Beleza", "Skincare"]}
      />
    );

    // "Skincare" está escondido antes do clique (só 2 chips visíveis)
    expect(screen.queryByText("Skincare")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ver mais 1 nicho/i }));

    expect(
      screen.getByRole("heading", { name: "Nichos do influenciador" })
    ).toBeInTheDocument();
    expect(screen.getByText("Skincare")).toBeInTheDocument();
    expect(screen.getByText(/3 nichos/)).toBeInTheDocument();
  });

  it("nicheNames tem precedência sobre o nicheName legado", () => {
    render(
      <InfluencerProfileCard
        data={data()}
        nicheName="Legado"
        nicheNames={["Moda"]}
      />
    );

    expect(screen.getByText("Moda")).toBeInTheDocument();
    expect(screen.queryByText("Legado")).not.toBeInTheDocument();
  });

  it("sem nichos, não renderiza a linha de chips", () => {
    render(<InfluencerProfileCard data={data()} nicheNames={[]} />);

    expect(screen.queryByRole("button", { name: /ver mais/i })).not.toBeInTheDocument();
  });
});

describe("InfluencerProfileCard — seguidores e engajamento", () => {
  it("mostra seguidores formatados e o engajamento em %", () => {
    render(<InfluencerProfileCard data={data()} />);

    expect(screen.getByText("Seguidores")).toBeInTheDocument();
    expect(screen.getByText("12.5k")).toBeInTheDocument();
    expect(screen.getByText("Engajamento")).toBeInTheDocument();
    expect(screen.getByText("4.2%")).toBeInTheDocument();
  });

  it("prefere os seguidores do perfil da rede aos do influenciador", () => {
    render(
      <InfluencerProfileCard
        data={data({ influencerFollowers: 100, profileFollowers: 2_400_000 })}
      />
    );

    expect(screen.getByText("2.4M")).toBeInTheDocument();
  });

  it("cai para os seguidores do influenciador quando o perfil não tem", () => {
    render(
      <InfluencerProfileCard
        data={data({ influencerFollowers: 800, profileFollowers: 0 })}
      />
    );

    expect(screen.getByText("800")).toBeInTheDocument();
  });
});

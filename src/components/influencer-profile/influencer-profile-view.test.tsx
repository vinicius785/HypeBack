/**
 * Perfil do influenciador: o que pode aparecer na página PÚBLICA `/u/:username`.
 *
 * Verificado em produção (2026-09-17): a rota pública é sem login e a mesma view
 * mostrava o bloco "Contato" (e-mail em `mailto:`, telefone em `tel:`) e o
 * endereço de entrega. É um link que o próprio criador divulga como media kit —
 * e qualquer um que soubesse o `username` colhia o e-mail.
 *
 * A API já corta esses campos (`stripPrivateContactFields`); este teste trava a
 * segunda camada, para o dado não voltar à tela se outro caminho mandá-lo.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { InfluencerProfileView } from "./influencer-profile-view";
import type { CampaignInfluencerProfileResponse } from "@/shared/services/influencer";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const EMAIL = "melocleide978@gmail.com";
const TELEFONE = "+5511999999999";
const RUA = "Rua das Palmeiras";

const perfil = (): CampaignInfluencerProfileResponse =>
  ({
    campaign: null,
    influencer: {
      id: "2729",
      name: "Cleide",
      email: EMAIL,
      phone: TELEFONE,
      username: "cleide",
      app_username: "cleide",
      avatar: null,
      followers: 1200,
      engagement: 3.2,
      niche_name: null,
      sub_niche_names: [],
      bio: "Criadora de conteúdo",
      social_networks: [],
      shipping_address: {
        street: RUA,
        number: "10",
        complement: null,
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zip: "01000-000",
      },
    },
    metrics_by_network: [],
    top_contents: [],
    hypeapp_campaigns: [],
  }) as unknown as CampaignInfluencerProfileResponse;

describe("InfluencerProfileView — dados de contato por modo", () => {
  it("modo público não mostra e-mail, telefone nem endereço", () => {
    render(<InfluencerProfileView data={perfil()} mode="public" />);

    expect(screen.queryByText(EMAIL)).not.toBeInTheDocument();
    expect(screen.queryByText(TELEFONE)).not.toBeInTheDocument();
    expect(screen.queryByText(/Contato/)).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(RUA))).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Endereço de entrega/),
    ).not.toBeInTheDocument();
  });

  it("modo público continua mostrando o que o media kit precisa", () => {
    render(<InfluencerProfileView data={perfil()} mode="public" />);

    expect(screen.getByText("Cleide")).toBeInTheDocument();
    expect(screen.getByText("Criadora de conteúdo")).toBeInTheDocument();
  });

  it("modo privado (backoffice logado) segue mostrando contato e endereço", () => {
    render(<InfluencerProfileView data={perfil()} mode="private" />);

    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByText(TELEFONE)).toBeInTheDocument();
    expect(screen.getByText(/Endereço de entrega/)).toBeInTheDocument();
  });
});

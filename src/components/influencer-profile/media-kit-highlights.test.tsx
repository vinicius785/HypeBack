import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CampaignInfluencerProfileResponse } from "@/shared/services/influencer";
import { MediaKitHighlights, mediaKitStats } from "./media-kit-highlights";

const base = (over: Record<string, unknown> = {}, top: Record<string, unknown> = {}) =>
  ({
    influencer: { id: "1", name: "Ana", username: "ana", avatar: null, followers: 12500, engagement: 4.25, niche_name: null, ...over },
    campaigns_participated_in_hypeapp: 3,
    trust_index: 88,
    ...top,
  }) as unknown as CampaignInfluencerProfileResponse;

describe("mídia kit — números em destaque", () => {
  it("mostra seguidores, engajamento, campanhas e audiência real", () => {
    render(<MediaKitHighlights data={base()} />);
    expect(screen.getByText("Seguidores")).toBeTruthy();
    expect(screen.getByText("4,3%")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("88%")).toBeTruthy();
  });

  it("soma os seguidores das redes quando o total não vem, e esconde o que não tem dado", () => {
    const d = base(
      { followers: 0, engagement: 0, social_networks: [{ id: 1, type: "instagram", name: "a", members: 1000 }, { id: 2, type: "tiktok", name: "a", members: 500 }] },
      { campaigns_participated_in_hypeapp: 0, trust_index: undefined },
    );
    expect(mediaKitStats(d).map((s) => s.label)).toEqual(["Seguidores"]);
  });

  it("sem nenhum dado não renderiza nada", () => {
    const { container } = render(
      <MediaKitHighlights data={base({ followers: 0, engagement: 0 }, { campaigns_participated_in_hypeapp: 0, trust_index: undefined })} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

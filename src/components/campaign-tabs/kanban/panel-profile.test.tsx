import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ profileAvatar: "https://cdn/users/4077/outra-pessoa.jpg" as string | null }));
vi.mock("@/hooks/use-influencer-profile", () => ({
  useInfluencerProfile: () => ({ data: { influencer: { avatar: h.profileAvatar, rating: null } } }),
}));

import { PanelProfile } from "./panel-profile";

const inf = (avatar: string) => ({ id: 1, name: "Ana", username: "ana", avatar, social_networks: [] }) as never;

describe("PanelProfile: foto", () => {
  it("usa a foto do criador na campanha, não a do perfil completo (que já veio de outra pessoa)", () => {
    const { container } = render(<PanelProfile inf={inf("https://cdn/users/1673/ana.jpg")} influencerId="1673" onProfile={vi.fn()} onChat={vi.fn()} />);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("users/1673");
  });

  it("sem foto na campanha, cai na do perfil", () => {
    const { container } = render(<PanelProfile inf={inf("")} influencerId="1673" onProfile={vi.fn()} onChat={vi.fn()} />);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("users/4077");
  });
});

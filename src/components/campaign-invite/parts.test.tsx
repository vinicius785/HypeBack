import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PublicCampaignInviteData } from "@/shared/services/public-campaign-invite";

import { BrandAvatar, brandOf } from "./parts";

afterEach(cleanup);

const invite = (over: Partial<PublicCampaignInviteData> = {}): PublicCampaignInviteData =>
  ({ title: "Promoção de pizzaria", description: "", ...over }) as PublicCampaignInviteData;

describe("convite — avatar da marca", () => {
  it("com foto da marca mostra a imagem, não as iniciais", () => {
    const { container } = render(<BrandAvatar data={invite({ brand_name: "Gegê Pizzaria", brand_photo: "https://cdn.exemplo.com/gege.png" })} />);
    expect(container.querySelector("img")).not.toBeNull();
    expect(screen.queryByText("GP")).not.toBeInTheDocument();
    expect(screen.queryByText("PD")).not.toBeInTheDocument();
  });

  it("sem foto, as iniciais são as do NOME DA MARCA (e não as do título da campanha)", () => {
    const { container } = render(<BrandAvatar data={invite({ brand_name: "Gegê Pizzaria", brand_photo: null })} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("GP")).toBeInTheDocument();
    expect(screen.queryByText("PD")).not.toBeInTheDocument();
  });

  it("foto que não carrega volta para as iniciais da marca", () => {
    const { container } = render(<BrandAvatar data={invite({ brand_name: "Gegê Pizzaria", brand_photo: "https://cdn.exemplo.com/quebrada.png" })} />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("GP")).toBeInTheDocument();
  });

  it("a marca é o nome da marca, e só na falta dele o título da campanha", () => {
    expect(brandOf(invite({ brand_name: " Gegê Pizzaria " }))).toBe("Gegê Pizzaria");
    expect(brandOf(invite({ brand_name: undefined }))).toBe("Promoção de pizzaria");
  });
});

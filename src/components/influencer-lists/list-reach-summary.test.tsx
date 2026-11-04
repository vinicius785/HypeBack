import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ListReachSummary } from "./list-reach-summary";

const data = {
  creators_total: 3,
  creators_with_network: 3,
  creators_with_reach: 2,
  followers_total: 20000,
  estimated_reach_total: 5000,
  by_network: [
    { network: "instagram" as const, creators: 2, followers: 15000, estimated_reach: 4000, creators_with_reach: 2 },
    { network: "tiktok" as const, creators: 1, followers: 5000, estimated_reach: 1000, creators_with_reach: 0 },
  ],
};

describe("ListReachSummary", () => {
  it("mostra alcance, seguidores, taxa e quem ficou de fora", () => {
    render(<ListReachSummary data={data} />);
    expect(screen.getByText("Alcance estimado")).toBeTruthy();
    expect(screen.getByText("25,0%")).toBeTruthy();
    expect(screen.getByText(/1 criador está sem alcance medido/)).toBeTruthy();
    expect(screen.getByText("Instagram")).toBeTruthy();
  });

  it("avisa quando não foi possível calcular", () => {
    render(<ListReachSummary isError />);
    expect(screen.getByRole("status").textContent).toMatch(/Não foi possível/);
  });
});

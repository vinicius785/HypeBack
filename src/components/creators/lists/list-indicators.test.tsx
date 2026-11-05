import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ListIndicators } from "./list-indicators";

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

describe("ListIndicators", () => {
  it("mostra alcance, seguidores, criadores, alcance por rede e quem ficou de fora", () => {
    render(<ListIndicators data={data} creators={3} />);
    expect(screen.getByText("Alcance estimado")).toBeTruthy();
    expect(screen.getByText("25,0% dos seguidores")).toBeTruthy();
    expect(screen.getByText("Criadores").nextElementSibling?.textContent).toBe("3");
    expect(screen.getByText(/1 criador está sem alcance medido/)).toBeTruthy();
    expect(screen.getByText("Instagram", { selector: "b" }).nextElementSibling?.textContent).toMatch(/^4\smil de alcance$/);
  });

  it("avisa quando não foi possível calcular e permite tentar de novo", () => {
    let retried = false;
    render(<ListIndicators isError creators={3} onRetry={() => (retried = true)} />);
    expect(screen.getByRole("status").textContent).toMatch(/Não foi possível/);
    screen.getByRole("button", { name: "Tentar de novo" }).click();
    expect(retried).toBe(true);
  });
});

import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CampaignCard, type CampaignCardProps } from "./campaign-card";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

beforeEach(() => {
  vi.stubEnv("VITE_SERVER_URL", "https://api.test/api/backoffice");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderBrandCircle(props: Partial<CampaignCardProps> = {}) {
  const { container } = render(
    <CampaignCard id="c1" title="Compra Planejada" status="active" {...props} />,
  );
  return container.querySelector<HTMLElement>(".cc-id .brand")!;
}

describe("CampaignCard · círculo da marca", () => {
  it("mostra a foto da marca, resolvida pela URL de uploads", () => {
    const circle = renderBrandCircle({
      brand: { name: "Jeitto App", photo: "/uploads/workspaces/jeitto.png" },
    });
    expect(circle.querySelector("img")).toHaveAttribute(
      "src",
      "https://api.test/uploads/workspaces/jeitto.png",
    );
  });

  it("volta para as iniciais da marca quando a foto não carrega", () => {
    const circle = renderBrandCircle({
      brand: { name: "Jeitto App", photo: "/uploads/workspaces/jeitto.png" },
    });
    fireEvent.error(circle.querySelector("img")!);
    expect(circle.querySelector("img")).toBeNull();
    expect(circle).toHaveTextContent("JA");
  });

  it("usa as iniciais da marca quando ela não tem foto", () => {
    const circle = renderBrandCircle({ brand: { name: "Jeitto App" } });
    expect(circle.querySelector("img")).toBeNull();
    expect(circle).toHaveTextContent("JA");
  });

  it("sem marca, mantém as iniciais do título da campanha", () => {
    const circle = renderBrandCircle();
    expect(circle.querySelector("img")).toBeNull();
    expect(circle).toHaveTextContent("CP");
  });
});

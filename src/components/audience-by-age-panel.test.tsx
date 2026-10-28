/**
 * Painel de público por idade: sem dado real, não desenha nada; e só a rede com
 * dado vira dataset/legenda.
 *
 * O chart.js precisa de canvas (indisponível no jsdom), então o caso "com
 * dados" é coberto pelos datasets — a parte que decide o que é plotado.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-chartjs-2", () => ({
  Bar: () => <div data-testid="bar-chart" />,
}));

import {
  AudienceByAgePanel,
  buildDemographicsDatasets,
} from "./audience-by-age-panel";
import { buildAudienceBarSeries } from "@/shared/services/metrics";

const instagramOnly = {
  instagram: {
    has_data: true,
    age_buckets: [
      { label: "18-24", percent: 40 },
      { label: "25-34", percent: 60 },
    ],
  },
  youtube: { has_data: false, age_buckets: [] },
};

describe("AudienceByAgePanel", () => {
  it("não renderiza nada quando a API não trouxe faixas etárias", () => {
    const { container } = render(<AudienceByAgePanel networks={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada quando as redes vêm sem dados", () => {
    const { container } = render(
      <AudienceByAgePanel
        networks={{
          instagram: { has_data: false, age_buckets: [] },
          youtube: { has_data: false, age_buckets: [] },
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("omite YouTube quando o perfil só tem Instagram", () => {
    render(<AudienceByAgePanel networks={instagramOnly} />);

    expect(screen.getByText("Maior público Instagram")).toBeInTheDocument();
    expect(screen.queryByText("Maior público YouTube")).not.toBeInTheDocument();
    expect(screen.queryByText("Youtube")).not.toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });
});

describe("buildDemographicsDatasets", () => {
  it("gera apenas a série da rede com dados", () => {
    const series = buildAudienceBarSeries(instagramOnly)!;

    const datasets = buildDemographicsDatasets(series);

    expect(datasets).toHaveLength(1);
    expect(datasets[0].label).toBe("Instagram");
    expect(datasets[0].data).toEqual([40, 60]);
  });

  it("gera as duas séries quando ambas as redes têm dados", () => {
    const series = buildAudienceBarSeries({
      instagram: { has_data: true, age_buckets: [{ label: "18-24", percent: 10 }] },
      youtube: { has_data: true, age_buckets: [{ label: "18-24", percent: 90 }] },
    })!;

    expect(buildDemographicsDatasets(series).map((d) => d.label)).toEqual([
      "Instagram",
      "Youtube",
    ]);
  });
});

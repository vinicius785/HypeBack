/**
 * Séries de faixa etária do gráfico de público.
 *
 * Regra: nada de números ilustrativos. Sem dados reais o gráfico não existe, e
 * uma rede sem dados (ex.: influenciador sem YouTube) não vira série no gráfico.
 */
import { describe, it, expect } from "vitest";

import {
  buildAudienceBarSeries,
  type AudienceNetworkAgeData,
} from "./metrics";

const buckets = (entries: Array<[string, number]>) =>
  entries.map(([label, percent]) => ({ label, percent }));

const withData = (
  entries: Array<[string, number]>,
): AudienceNetworkAgeData => ({
  has_data: true,
  age_buckets: buckets(entries),
});

const empty: AudienceNetworkAgeData = { has_data: false, age_buckets: [] };

describe("buildAudienceBarSeries", () => {
  it("retorna null quando não há redes", () => {
    expect(buildAudienceBarSeries(undefined)).toBeNull();
    expect(buildAudienceBarSeries({})).toBeNull();
  });

  it("retorna null quando nenhuma rede tem faixas etárias", () => {
    expect(
      buildAudienceBarSeries({ instagram: empty, youtube: empty }),
    ).toBeNull();
  });

  it("ignora rede com has_data mas sem buckets", () => {
    expect(
      buildAudienceBarSeries({
        instagram: { has_data: true, age_buckets: [] },
      }),
    ).toBeNull();
  });

  it("marca só o Instagram quando o perfil não tem YouTube", () => {
    const series = buildAudienceBarSeries({
      instagram: withData([
        ["18-24", 40],
        ["25-34", 60],
      ]),
      youtube: empty,
    });

    expect(series).not.toBeNull();
    expect(series!.hasInstagram).toBe(true);
    // Sem esse flag o gráfico plotava uma série de YouTube zerada para quem
    // sequer tem canal.
    expect(series!.hasYoutube).toBe(false);
    expect(series!.instagram).toEqual([40, 60]);
  });

  it("marca só o YouTube quando é a única rede com dados", () => {
    const series = buildAudienceBarSeries({
      instagram: empty,
      youtube: withData([["25-34", 70]]),
    });

    expect(series!.hasYoutube).toBe(true);
    expect(series!.hasInstagram).toBe(false);
    expect(series!.youtube).toEqual([70]);
  });

  it("alinha as duas redes pelos mesmos labels, ordenados por idade", () => {
    const series = buildAudienceBarSeries({
      instagram: withData([
        ["25-34", 50],
        ["18-24", 30],
      ]),
      youtube: withData([["35-44", 20]]),
    });

    expect(series!.labels).toEqual(["18-24", "25-34", "35-44"]);
    // Faixa ausente na rede vira 0 apenas para alinhar as barras existentes.
    expect(series!.instagram).toEqual([30, 50, 0]);
    expect(series!.youtube).toEqual([0, 0, 20]);
    expect(series!.hasInstagram).toBe(true);
    expect(series!.hasYoutube).toBe(true);
  });

  it("não devolve números fixos: a série vem sempre dos buckets recebidos", () => {
    const a = buildAudienceBarSeries({ instagram: withData([["18-24", 11]]) });
    const b = buildAudienceBarSeries({ instagram: withData([["18-24", 92]]) });

    expect(a!.instagram).toEqual([11]);
    expect(b!.instagram).toEqual([92]);
  });
});

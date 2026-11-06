import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_BANNER_ACCEPT,
  CAMPAIGN_BANNER_ASPECT,
  CAMPAIGN_BANNER_HEIGHT,
  CAMPAIGN_BANNER_LABEL,
  CAMPAIGN_BANNER_WIDTH,
  isSquareImage,
  validateCampaignBannerFile,
} from "./campaign-banner";

describe("medida única do banner da campanha", () => {
  it("é quadrada, 1080 × 1080, e todo texto sai da mesma constante", () => {
    expect(CAMPAIGN_BANNER_WIDTH).toBe(1080);
    expect(CAMPAIGN_BANNER_HEIGHT).toBe(1080);
    expect(CAMPAIGN_BANNER_LABEL).toBe("1080 × 1080 px");
    expect(CAMPAIGN_BANNER_ASPECT).toBe("1 / 1");
    expect(CAMPAIGN_BANNER_ACCEPT).toBe("image/jpeg,image/jpg,image/png");
  });

  it("aceita JPG e PNG e recusa o resto", () => {
    expect(validateCampaignBannerFile({ type: "image/png" })).toBeNull();
    expect(validateCampaignBannerFile({ type: "image/jpeg" })).toBeNull();
    expect(validateCampaignBannerFile({ type: "image/gif" })).toBe("Use uma imagem JPG ou PNG");
  });

  it("imagem quadrada (até 1% de diferença) dispensa o recorte", () => {
    expect(isSquareImage(1000, 1000)).toBe(true);
    expect(isSquareImage(1000, 995)).toBe(true);
    expect(isSquareImage(1280, 512)).toBe(false);
    expect(isSquareImage(0, 0)).toBe(false);
  });

  it("nenhuma tela volta a escrever a medida antiga (1280 × 512 ou caixa 5:2) à mão", () => {
    const root = join(__dirname, "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx?|css)$/.test(name) && !/\.test\./.test(name)) files.push(full);
      }
    };
    walk(root);
    const offenders = files.filter((f) => {
      const text = readFileSync(f, "utf8");
      return /1280 ?[×xX] ?512|aspect-ratio: 5 \/ 2|aspectRatio: "5 \/ 2"/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});

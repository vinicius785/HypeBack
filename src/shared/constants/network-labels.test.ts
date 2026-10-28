import { describe, it, expect } from "vitest";
import { getNetworkLabel, NETWORK_LABELS } from "./network-labels";

describe("getNetworkLabel", () => {
  it("retorna o label correto para redes conhecidas", () => {
    expect(getNetworkLabel("instagram")).toBe("Instagram");
    expect(getNetworkLabel("tiktok")).toBe("TikTok");
    expect(getNetworkLabel("youtube")).toBe("YouTube");
    expect(getNetworkLabel("ugc")).toBe("UGC");
    expect(getNetworkLabel("instagram_facebook")).toBe("Instagram / Facebook");
    expect(getNetworkLabel("linkedin")).toBe("LinkedIn");
    expect(getNetworkLabel("twitter")).toBe("X / Twitter");
  });

  it("é case-insensitive", () => {
    expect(getNetworkLabel("INSTAGRAM")).toBe("Instagram");
    expect(getNetworkLabel("TikTok")).toBe("TikTok");
  });

  it("retorna fallback quando tipo é desconhecido", () => {
    expect(getNetworkLabel("pinterest", "Rede social")).toBe("Rede social");
  });

  it("retorna o próprio tipo quando fallback não é passado e tipo é desconhecido", () => {
    expect(getNetworkLabel("snapchat")).toBe("snapchat");
  });

  it("retorna string vazia para undefined/null sem fallback", () => {
    expect(getNetworkLabel(undefined)).toBe("");
    expect(getNetworkLabel(null)).toBe("");
  });

  it("retorna fallback para undefined/null quando fornecido", () => {
    expect(getNetworkLabel(undefined, "N/A")).toBe("N/A");
  });

  it("NETWORK_LABELS contém as redes esperadas", () => {
    const expected = ["instagram", "tiktok", "youtube", "ugc", "facebook", "twitter"];
    expected.forEach((key) => {
      expect(NETWORK_LABELS).toHaveProperty(key);
    });
  });
});

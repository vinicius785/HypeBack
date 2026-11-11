import { describe, expect, it } from "vitest";

import { networkProfileUrl } from "./creator-labels";

describe("endereço do perfil da rede", () => {
  it("monta o link de cada rede, sem duplicar o arroba", () => {
    expect(networkProfileUrl("instagram", "ana.silva")).toBe("https://www.instagram.com/ana.silva/");
    expect(networkProfileUrl("instagram_facebook", "@ana.silva")).toBe("https://www.instagram.com/ana.silva/");
    expect(networkProfileUrl("tiktok", "@ana")).toBe("https://www.tiktok.com/@ana");
    expect(networkProfileUrl("youtube", "ana")).toBe("https://www.youtube.com/@ana");
  });

  it("sem usuário ou rede desconhecida não tem link; o usuário é codificado", () => {
    expect(networkProfileUrl("instagram", "  ")).toBeUndefined();
    expect(networkProfileUrl("kwai", "ana")).toBeUndefined();
    expect(networkProfileUrl("tiktok", "a b/c")).toBe("https://www.tiktok.com/@a%20b%2Fc");
  });
});

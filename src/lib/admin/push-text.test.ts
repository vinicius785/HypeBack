import { describe, expect, it } from "vitest";

import { clampPushBody, clampPushTitle, PUSH_BODY_MAX, PUSH_TITLE_MAX, pushBodyLength, pushTitleLength } from "./push-text";

describe("limites do push", () => {
  it("título 31 e descrição 106", () => {
    expect(PUSH_TITLE_MAX).toBe(31);
    expect(PUSH_BODY_MAX).toBe(106);
  });

  it("o título conta o emoji como 1 caractere (mesmo os de vários pontos de código) e não conta os **", () => {
    expect(pushTitleLength("🎉 Nova campanha")).toBe(15);
    expect(pushTitleLength("❤️ oi")).toBe(4);
    expect(pushTitleLength("👩‍💻 oi")).toBe(4);
    expect(pushTitleLength("**Oferta** nova")).toBe(11);
    expect(pushTitleLength("**🎉 Oferta**")).toBe(8);
  });

  it("a descrição conta tudo: espaços, pontuação e até os **", () => {
    expect(pushBodyLength("Entre no app e confira.")).toBe(23);
    expect(pushBodyLength("**oi**")).toBe(6);
    expect(pushBodyLength("🎉 oi")).toBe(4);
  });

  it("corta no limite sem partir um emoji", () => {
    expect(clampPushTitle("a".repeat(40))).toHaveLength(31);
    expect(clampPushTitle("a".repeat(30) + "🎉🎉")).toBe("a".repeat(30) + "🎉");
    expect(clampPushBody("b".repeat(200))).toHaveLength(106);
    expect(clampPushTitle("curto")).toBe("curto");
  });

  it("os ** de fora não gastam o limite do título", () => {
    const text = "**" + "a".repeat(31) + "**";
    expect(clampPushTitle(text)).toBe(text);
    expect(pushTitleLength(text)).toBe(31);
    expect(clampPushTitle("**" + "a".repeat(40) + "**").startsWith("**" + "a".repeat(31))).toBe(true);
  });
});

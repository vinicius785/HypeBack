import { describe, expect, it } from "vitest";

import { clampPos, coverScale, cropRect, repositionForScale, validateProfilePhoto } from "./photo-crop";

describe("validateProfilePhoto", () => {
  it("aceita JPEG, PNG e WebP até 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateProfilePhoto({ type, size: 1000 })).toBeNull();
    }
    expect(validateProfilePhoto({ type: "image/png", size: 5 * 1024 * 1024 })).toBeNull();
  });
  it("recusa outros formatos, arquivos grandes e vazios, com mensagem clara", () => {
    expect(validateProfilePhoto({ type: "image/gif", size: 10 })).toMatch(/JPEG, PNG ou WebP/);
    expect(validateProfilePhoto({ type: "application/pdf", size: 10 })).toMatch(/Formato/);
    expect(validateProfilePhoto({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
    expect(validateProfilePhoto({ type: "image/png", size: 0 })).toMatch(/vazio/);
  });
});

describe("recorte", () => {
  it("a escala cobre o quadro pelo lado menor", () => {
    expect(coverScale(1000, 500, 280)).toBeCloseTo(0.56);
    expect(coverScale(400, 800, 280)).toBeCloseTo(0.7);
  });
  it("não deixa a imagem sair do quadro", () => {
    const s = coverScale(1000, 500, 280);
    expect(clampPos({ x: 50, y: 50 }, 1000, 500, s, 280)).toEqual({
      x: 0,
      y: 0,
    });
    expect(clampPos({ x: -9999, y: -9999 }, 1000, 500, s, 280)).toEqual({
      x: 280 - 560,
      y: 0,
    });
  });
  it("trocar o zoom mantém o centro", () => {
    const next = repositionForScale({ x: -10, y: -20 }, 1, 2, 280);
    expect(next).toEqual({ x: 140 - (140 + 10) * 2, y: 140 - (140 + 20) * 2 });
  });
  it("a região recortada acompanha a posição", () => {
    const r = cropRect({ x: -56, y: 0 }, 0.56, 280);
    expect(r.sx).toBeCloseTo(100);
    expect(r.sy).toBeCloseTo(0);
    expect(r.size).toBeCloseTo(500);
  });
});

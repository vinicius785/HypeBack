import { describe, expect, it } from "vitest";

import { hasImageExtension, isHeicImage, isVideoFile } from "./preview-media-type";

describe("isVideoFile", () => {
  it("usa a extensão do arquivo antes de qualquer outra pista", () => {
    expect(isVideoFile("https://cdn.example.com/a/b.mp4")).toBe(true);
    expect(isVideoFile("https://cdn.example.com/a/b.jpg")).toBe(false);
  });

  it("ignora a query string (URL assinada de Spaces/S3)", () => {
    const signed =
      "https://bucket.sfo3.digitaloceanspaces.com/x/9f2.mov?X-Amz-Signature=abc&X-Amz-Expires=900";
    expect(isVideoFile(signed)).toBe(true);
  });

  it("não deixa o formato do post sobrepor a extensão", () => {
    // Um reels pode ter capa em JPG: o arquivo é imagem, o post é que é vídeo.
    expect(isVideoFile("https://cdn.example.com/capa.jpg", "reels")).toBe(false);
  });

  it("cai no formato do post quando a URL não tem extensão", () => {
    expect(isVideoFile("https://cdn.example.com/media/abc123", "reels")).toBe(true);
    expect(isVideoFile("https://cdn.example.com/media/abc123", "story")).toBe(false);
  });

  it("assume imagem quando não há extensão nem formato conhecido", () => {
    expect(isVideoFile("https://cdn.example.com/media/abc123")).toBe(false);
    expect(isVideoFile("https://cdn.example.com/media/abc123", "post")).toBe(false);
  });

  it("trata URL vazia como não-vídeo", () => {
    expect(isVideoFile("")).toBe(false);
  });

  it("não confunde extensão no meio do caminho com a do arquivo", () => {
    // Antes, um `includes('.mp4')` marcava isto como vídeo.
    expect(isVideoFile("https://cdn.example.com/mp4-thumbs/capa.png")).toBe(false);
  });
});

describe("isHeicImage", () => {
  it("reconhece HEIC/HEIF, com ou sem query", () => {
    expect(isHeicImage("https://cdn.example.com/foto.heic")).toBe(true);
    expect(isHeicImage("https://cdn.example.com/foto.HEIF?sig=1")).toBe(true);
    expect(isHeicImage("https://cdn.example.com/foto.jpg")).toBe(false);
  });
});

describe("hasImageExtension", () => {
  it("cobre as extensões de imagem suportadas", () => {
    expect(hasImageExtension("https://cdn.example.com/a.webp")).toBe(true);
    expect(hasImageExtension("https://cdn.example.com/a.mp4")).toBe(false);
  });
});

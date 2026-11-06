import { describe, expect, it } from "vitest";

import { bannerFileForUpload, dataUrlToFile } from "./campaign-banner";

// PNG de 1×1 pixel
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("dataUrlToFile", () => {
  it("transforma uma data URL base64 num arquivo com o tipo e os bytes certos", async () => {
    const file = dataUrlToFile(PNG_1PX, "capa");
    expect(file).toBeInstanceOf(File);
    expect(file?.type).toBe("image/png");
    expect(file?.name).toBe("capa.png");
    const bytes = await new Promise<Uint8Array>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(file as File);
    });
    // assinatura do PNG
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("jpeg ganha extensão .jpg", () => {
    expect(dataUrlToFile("data:image/jpeg;base64,/9j/4AAQ")?.name).toBe("banner.jpg");
  });

  it("o que não é data URL ou está quebrado vira null", () => {
    expect(dataUrlToFile("https://cdn.exemplo.com/a.png")).toBeNull();
    expect(dataUrlToFile("")).toBeNull();
    expect(dataUrlToFile("data:image/png;base64,@@@")).toBeNull();
  });
});

describe("bannerFileForUpload (publicar a campanha)", () => {
  it("na mesma sessão usa o arquivo escolhido", () => {
    const f = new File(["x"], "b.jpg", { type: "image/jpeg" });
    expect(bannerFileForUpload("data:image/jpeg;base64,AAAA", f)).toBe(f);
  });

  it("rascunho restaurado (só a prévia, sem o arquivo): reconstrói o arquivo e o banner não se perde", () => {
    const file = bannerFileForUpload(PNG_1PX, undefined);
    expect(file).toBeInstanceOf(File);
    expect(file?.type).toBe("image/png");
  });

  it("sem banner nenhum não há o que enviar", () => {
    expect(bannerFileForUpload("", undefined)).toBeNull();
    expect(bannerFileForUpload(undefined, undefined)).toBeNull();
  });
});

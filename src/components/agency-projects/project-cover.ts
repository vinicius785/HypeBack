/** Capa do projeto: a imagem é reduzida no navegador (no máximo 1600x900, JPEG) antes de ir para a API. */

export const COVER_MAX_WIDTH = 1600;
export const COVER_MAX_HEIGHT = 900;
export const COVER_JPEG_QUALITY = 0.78;

/** Tamanho final: cabe em `maxWidth x maxHeight` mantendo a proporção; imagem menor não é ampliada. */
export function fitWithin(width: number, height: number, maxWidth = COVER_MAX_WIDTH, maxHeight = COVER_MAX_HEIGHT): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler essa imagem."));
    };
    image.src = url;
  });
}

/** Reduz a imagem escolhida para a capa (JPEG com fundo branco, para PNG/WebP transparentes). */
export async function resizeCoverImage(file: File): Promise<File> {
  const image = await loadImage(file);
  const size = fitWithin(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(image, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", COVER_JPEG_QUALITY));
  if (!blob) throw new Error("Não foi possível preparar a imagem.");
  return new File([blob], "capa.jpg", { type: "image/jpeg" });
}

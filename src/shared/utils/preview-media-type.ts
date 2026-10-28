/**
 * Decide se a URL de preview de um conteúdo aponta para vídeo ou imagem.
 *
 * Existe porque a API guarda só a URL do arquivo — não o MIME. Os uploads
 * passam pelo `StorageService`, que preserva a extensão na chave
 * (`<uuid>.<ext>`), então a extensão é o sinal mais confiável. O `contentType`
 * (`reels`, `story`, `post`…) é o formato do post, não do arquivo, e por isso
 * entra só como desempate quando não há extensão — caso de URLs de CDN de rede
 * social coladas à mão.
 */

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".jfif",
  ".heic",
  ".heif",
];

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".ogg",
  ".mov",
  ".avi",
  ".mkv",
  ".m4v",
  ".3gp",
  ".flv",
  ".mpg",
  ".mpeg",
];

/** Formatos de post que são vídeo por natureza. */
const VIDEO_CONTENT_TYPES = ["video", "reels", "reel", "shorts", "short", "tiktok"];

/** Caminho sem query string, em minúsculas. Assinaturas S3/Spaces vivem na query. */
function cleanPath(url: string): string {
  return url.toLowerCase().split("?")[0];
}

/** `true` se a URL termina em extensão de imagem conhecida. */
export function hasImageExtension(url: string): boolean {
  const path = cleanPath(url);
  return IMAGE_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * HEIC/HEIF: nenhum navegador de desktop decodifica de forma confiável, então a
 * UI oferece o download do original em vez de um quadro quebrado.
 */
export function isHeicImage(url: string): boolean {
  const path = cleanPath(url);
  return path.endsWith(".heic") || path.endsWith(".heif");
}

export function isVideoFile(url: string, contentType?: string): boolean {
  if (!url) return false;

  const path = cleanPath(url);

  // A extensão manda: é o que o próprio upload gravou na chave.
  if (IMAGE_EXTENSIONS.some((ext) => path.endsWith(ext))) return false;
  if (VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext))) return true;

  // Sem extensão, o formato do post é o melhor palpite que sobra.
  if (contentType && VIDEO_CONTENT_TYPES.includes(contentType.toLowerCase())) {
    return true;
  }

  // Default imagem: URL de CDN sem extensão quase sempre é foto, e um <img>
  // que falha degrada para placeholder — um <video> que falha trava o card.
  return false;
}

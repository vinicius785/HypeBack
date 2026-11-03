/** Matemática do recorte circular da foto de perfil (sem DOM, para testar). */

export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PROFILE_PHOTO_OUTPUT = 512;
export const PROFILE_PHOTO_MAX_ZOOM = 3;

/** Mensagem de erro para um arquivo que não serve; `null` quando está tudo certo. */
export function validateProfilePhoto(file: Pick<File, "type" | "size">): string | null {
  if (!(PROFILE_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return "Formato não suportado. Use uma imagem JPEG, PNG ou WebP.";
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    return "A imagem é grande demais. O tamanho máximo é 5 MB.";
  }
  if (file.size === 0) return "O arquivo está vazio.";
  return null;
}

/** Escala mínima para a imagem cobrir todo o quadro (`view` px) com zoom 1. */
export function coverScale(width: number, height: number, view: number): number {
  return Math.max(view / width, view / height);
}

export interface Pos {
  x: number;
  y: number;
}

/** Posição do canto superior esquerdo da imagem, presa para nunca deixar o quadro vazio. */
export function clampPos(pos: Pos, width: number, height: number, scale: number, view: number): Pos {
  const dw = width * scale;
  const dh = height * scale;
  return {
    x: Math.min(0, Math.max(view - dw, pos.x)),
    y: Math.min(0, Math.max(view - dh, pos.y)),
  };
}

/** Mantém o centro do quadro no mesmo ponto da imagem ao trocar o zoom. */
export function repositionForScale(pos: Pos, prev: number, next: number, view: number): Pos {
  const k = next / prev;
  const c = view / 2;
  return { x: c - (c - pos.x) * k, y: c - (c - pos.y) * k };
}

/** Região da imagem original que aparece no quadro (em pixels da imagem). */
export function cropRect(pos: Pos, scale: number, view: number) {
  return { sx: -pos.x / scale, sy: -pos.y / scale, size: view / scale };
}

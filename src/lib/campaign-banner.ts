/**
 * Medida única do banner da campanha: quadrado de 1080 × 1080 px (1:1), o formato que o app mostra no cartão da campanha
 * e nas miniaturas. Todo texto, recorte, pré-visualização e caixa de banner do backoffice parte daqui (nenhuma medida escrita
 * à mão). Banners antigos, mais largos (5:2), continuam funcionando: as caixas de 1:1 mostram o centro deles (`object-fit: cover`).
 */

export const CAMPAIGN_BANNER_SIZE = 1080;
export const CAMPAIGN_BANNER_WIDTH = CAMPAIGN_BANNER_SIZE;
export const CAMPAIGN_BANNER_HEIGHT = CAMPAIGN_BANNER_SIZE;
/** Texto para telas e dicas: "1080 × 1080 px". */
export const CAMPAIGN_BANNER_LABEL = `${CAMPAIGN_BANNER_WIDTH} × ${CAMPAIGN_BANNER_HEIGHT} px`;
/** Valor de `aspect-ratio` das caixas que mostram o banner. */
export const CAMPAIGN_BANNER_ASPECT = "1 / 1";
export const CAMPAIGN_BANNER_TYPES = ["image/jpeg", "image/jpg", "image/png"] as const;
export const CAMPAIGN_BANNER_ACCEPT = CAMPAIGN_BANNER_TYPES.join(",");
export const CAMPAIGN_BANNER_TYPE_ERROR = "Use uma imagem JPG ou PNG";

/** Mensagem de erro para um arquivo que não serve de banner; `null` quando está tudo certo. */
export function validateCampaignBannerFile(file: Pick<File, "type">): string | null {
  return (CAMPAIGN_BANNER_TYPES as readonly string[]).includes(file.type) ? null : CAMPAIGN_BANNER_TYPE_ERROR;
}

/** A imagem já é quadrada (até 1% de diferença entre os lados): dispensa o recorte, só é reduzida para o tamanho do banner. */
export function isSquareImage(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  return Math.abs(width - height) / Math.max(width, height) <= 0.01;
}

/** Converte uma `data:` URL em arquivo; `null` quando não é uma `data:` URL válida. Não depende de `fetch`. */
export function dataUrlToFile(dataUrl: string, baseName = "banner"): File | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const type = m[1] || "image/jpeg";
  try {
    const raw = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const ext = type === "image/png" ? "png" : "jpg";
    return new File([bytes], `${baseName}.${ext}`, { type });
  } catch {
    return null;
  }
}

/**
 * Arquivo do banner a enviar ao publicar. Na mesma sessão é o `File` escolhido; num rascunho restaurado só sobrou a
 * prévia (`data:` URL, o `File` não vai para o localStorage): reconstruímos o arquivo a partir dela. `null` = sem banner.
 */
export function bannerFileForUpload(banner: string | undefined, bannerFile: unknown): File | null {
  if (bannerFile instanceof File) return bannerFile;
  if (banner && banner.startsWith("data:")) return dataUrlToFile(banner);
  return null;
}

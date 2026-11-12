/**
 * Limites do texto da notificação (push no app): título de 31 caracteres e descrição de 106.
 *
 * - "Caractere" é o que a pessoa vê: um emoji conta 1 (mesmo os de vários pontos de código, como ❤️ ou 👩‍💻);
 * - no título os `**` do negrito NÃO contam (o título `**Oferta** nova` tem 11 caracteres);
 * - na descrição contam todos, inclusive espaços e pontuação.
 */
export const PUSH_TITLE_MAX = 31;
export const PUSH_BODY_MAX = 106;

const BOLD_MARK = "**";

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("pt-BR", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

const countOf = (text: string) => graphemes(text).length;

/** Quantos caracteres o título tem para o limite (sem os `**`). */
export function pushTitleLength(title: string): number {
  return countOf(title.split(BOLD_MARK).join(""));
}

/** Quantos caracteres a descrição tem para o limite (todos). */
export function pushBodyLength(body: string): number {
  return countOf(body);
}

/** O maior começo do texto que cabe no limite (corta por caractere visível, nunca no meio de um emoji). */
function clampTo(text: string, max: number, length: (value: string) => number): string {
  if (length(text) <= max) return text;
  const parts = graphemes(text);
  let kept = "";
  for (const part of parts) {
    if (length(kept + part) > max) break;
    kept += part;
  }
  return kept;
}

export const clampPushTitle = (title: string): string => clampTo(title, PUSH_TITLE_MAX, pushTitleLength);
export const clampPushBody = (body: string): string => clampTo(body, PUSH_BODY_MAX, pushBodyLength);

import type { ReactNode } from "react";

const URL_RE = /((?:https?:\/\/|www\.)[^\s<>]+)/gi;
const TRAILING = /[.,;:!?)\]}'"»]+$/;

/** Endereço seguro para abrir: só http(s); `www.` ganha https. Qualquer outro esquema vira texto. */
export function hrefOf(raw: string): string | undefined {
  const url = /^www\./i.test(raw) ? `https://${raw}` : raw;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** Texto com links clicáveis (abrem em outra aba, sem `opener`); a pontuação final fica fora do link. */
export function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const raw = m[0];
    const trail = raw.match(TRAILING)?.[0] ?? "";
    const link = trail ? raw.slice(0, -trail.length) : raw;
    const href = hrefOf(link);
    if (!href) continue;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <a key={`l${k++}`} href={href} target="_blank" rel="noopener noreferrer nofollow" className="cx-link">
        {link}
      </a>,
    );
    last = start + link.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

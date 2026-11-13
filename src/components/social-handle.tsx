import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";

import { getNetworkLabel, getSocialNetworkProfileUrl } from "@/shared/constants/network-labels";

import "@/styles/social-handle.css";

/** Só letras, números, ponto, hífen e sublinhado: o que os @ das redes aceitam. Qualquer outra coisa (barra, interrogação, espaço) não vira link. */
const HANDLE_PATTERN = /^[\p{L}\p{N}._-]+$/u;

/** O @ sem o arroba e sem espaços nas pontas. */
export function cleanHandle(username: string | null | undefined): string {
  return (username ?? "").trim().replace(/^@/, "").trim();
}

/**
 * Endereço do perfil público na rede (Instagram, TikTok, YouTube, X/Twitter, Facebook), ou `undefined` quando a rede não é conhecida,
 * não há @ ou o @ tem caracteres que um @ de rede não tem (para nunca montar um endereço torto a partir de texto livre).
 */
export function socialHandleUrl(network: string | null | undefined, username: string | null | undefined): string | undefined {
  const handle = cleanHandle(username);
  if (!handle || !HANDLE_PATTERN.test(handle)) return undefined;
  return getSocialNetworkProfileUrl(network, handle);
}

interface SocialHandleProps {
  /** O @ da pessoa, com ou sem arroba. */
  username: string | null | undefined;
  /** Tipo da rede (`instagram`, `tiktok`, `youtube`…): decide para onde o clique leva. */
  network: string | null | undefined;
  className?: string;
  /** O que mostrar no lugar de `@usuário` (padrão: o próprio @). */
  children?: ReactNode;
}

/**
 * O @ de um criador. Com a rede conhecida, é um link que abre o perfil dele nessa rede em outra aba (`noopener noreferrer`, sem
 * mandar a página de origem); sem rede, ou com um @ estranho, continua sendo só o texto. Dentro de cartões clicáveis ou arrastáveis,
 * o clique no @ não aciona o cartão (`stopPropagation`).
 */
export function SocialHandle({ username, network, className, children }: SocialHandleProps) {
  const handle = cleanHandle(username);
  if (!handle) return null;
  const text = children ?? `@${handle}`;
  const url = socialHandleUrl(network, handle);
  if (!url) return <span className={className}>{text}</span>;

  const stop = (event: MouseEvent | PointerEvent | KeyboardEvent) => event.stopPropagation();
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`social-handle${className ? ` ${className}` : ""}`}
      title={`Abrir ${getNetworkLabel(network, "a rede")} de @${handle}`}
      onClick={stop}
      onPointerDown={stop}
      onKeyDown={stop}
    >
      {text}
    </a>
  );
}

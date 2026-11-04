import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import type { TeamChatAttachment } from "@/shared/services/team-chat";

import { formatFileSize, isImageMime } from "./format";

/** Só abre links http(s); qualquer outro esquema (ex.: `javascript:`) vira texto sem link. */
function safeHref(url: string): string | undefined {
  const full = getUploadUrl(url);
  return full && /^https?:\/\//i.test(full) ? full : undefined;
}

/** Anexos de um balão: imagem com pré-visualização (abre em outra aba) ou arquivo com ícone, nome e tamanho. */
export function MessageAttachments({
  attachments,
  onMediaLoad,
}: {
  attachments: TeamChatAttachment[];
  /** A imagem carregou depois da rolagem (ou falhou e mostra o texto alternativo): a altura da lista mudou. */
  onMediaLoad?: () => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="tc-att">
      {attachments.map((a, i) => {
        const href = safeHref(a.url);
        if (isImageMime(a.mime_type) && href) {
          return (
            <a key={`${a.url}-${i}`} className="tc-img" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Abrir imagem ${a.name}`}>
              <img src={href} alt={a.name} loading="lazy" onLoad={onMediaLoad} onError={onMediaLoad} />
            </a>
          );
        }
        const body = (
          <>
            <span aria-hidden="true">
              <I n="file" cls="sm" />
            </span>
            <div>
              <b>{a.name || "Arquivo"}</b>
              <small>{formatFileSize(a.size)}</small>
            </div>
          </>
        );
        return href ? (
          <a key={`${a.url}-${i}`} className="cm-k tc-file" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Abrir arquivo ${a.name}`}>
            {body}
          </a>
        ) : (
          <div key={`${a.url}-${i}`} className="cm-k tc-file">
            {body}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Preview de um arquivo de conteúdo de campanha (imagem ou vídeo).
 *
 * Substitui o antigo `renderSinglePreview`, que tinha dois defeitos:
 *
 * 1. **`<video>` reaproveitado entre URLs.** O preview era montado por uma
 *    função inline, então o React reconciliava o mesmo elemento `<video>` ao
 *    trocar de conteúdo (carrossel do modal, mudança de filtro, refetch) e só
 *    reescrevia o atributo `src`. O navegador NÃO recarrega um `<video>` por
 *    troca de `src` — exige `load()`. Resultado: o título dizia "Preview 2 de 3"
 *    e o player continuava no vídeo 1. Agora quem chama passa `key={url}`, e o
 *    React remonta o elemento a cada URL nova.
 *
 * 2. **`replaceChild` no `onError`.** O handler arrancava do DOM um nó que o
 *    React controlava e punha uma `div` no lugar. O fiber seguia apontando para
 *    o nó removido: o render seguinte que tocasse essa subárvore quebrava com
 *    `NotFoundError: Failed to execute 'removeChild'`, e enquanto não quebrava,
 *    o placeholder de erro ficava grudado — preview de um conteúdo aparecia
 *    sobre o outro. O estado de falha agora é estado do React.
 *
 * `getUploadUrl` deixa URL absoluta intacta (é o caso dos uploads em
 * Spaces/Supabase) e só resolve caminho relativo, que de outro modo cairia no
 * rewrite de SPA da Vercel e voltaria como HTML — 200, nunca 404.
 */
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { getUploadUrl } from "@/lib/utils/api";
import { isHeicImage, isVideoFile } from "@/shared/utils/preview-media-type";

export interface ContentPreviewProps {
  /** URL do arquivo, absoluta ou relativa ao host de uploads. */
  url: string;
  /** Formato do post (`reels`, `story`…). Desempata quando a URL não tem extensão. */
  contentType?: string;
}

function PreviewFallback({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-neutral-200 p-4 text-center">
      <Icon name="Image" color="#A3A3A3" size={28} />
      <p className="text-xs text-neutral-600">{message}</p>
    </div>
  );
}

export function ContentPreview({ url, contentType }: ContentPreviewProps) {
  const [failed, setFailed] = useState(false);

  const src = getUploadUrl(url);

  if (!src) {
    return <PreviewFallback message="Arquivo indisponível" />;
  }

  if (failed) {
    return <PreviewFallback message="Não foi possível carregar o arquivo" />;
  }

  // HEIC/HEIF: o navegador não decodifica, então nem tentamos — o revisor
  // precisa do arquivo original para conseguir avaliar.
  if (isHeicImage(src)) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-neutral-100 p-4 text-center">
        <Icon name="Image" size={30} color="#737373" />
        <p className="text-xs text-neutral-600">
          O navegador pode não exibir HEIC/HEIF. Abra o original para revisar.
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          download
          onClick={(e) => e.stopPropagation()}
          className="rounded-full bg-primary-600 px-4 py-2 text-xs font-semibold text-white"
        >
          Abrir arquivo original
        </a>
      </div>
    );
  }

  if (isVideoFile(src, contentType)) {
    return (
      <video
        src={src}
        className="h-full w-full object-contain"
        controls
        playsInline
        // `metadata` evita baixar dezenas de MB só para montar a lista.
        preload="metadata"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img
      src={src}
      alt="Preview do conteúdo"
      className="h-full w-full object-contain"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

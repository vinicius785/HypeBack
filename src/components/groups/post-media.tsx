/**
 * Mídia de um post da comunidade na moderação (imagem ou vídeo).
 *
 * Existe compartilhado porque as duas telas de moderação — posts de um grupo e
 * feed global — renderizam exatamente o mesmo bloco, e antes já divergiam em
 * detalhes de tamanho quando só havia imagem.
 *
 * Vídeo tem prioridade sobre imagem: é o que o app mostra quando o post traz os
 * dois (o composer não deixa, mas um cliente antigo/terceiro poderia).
 * `preload="metadata"` evita baixar dezenas de MB só para listar a moderação.
 */
import { getUploadUrl } from "@/lib/utils/api";

export interface PostMediaProps {
  imageUrl: string | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
}

export function PostMedia({
  imageUrl,
  videoUrl,
  videoThumbnailUrl,
}: PostMediaProps) {
  const video = getUploadUrl(videoUrl);
  const poster = getUploadUrl(videoThumbnailUrl);
  const image = getUploadUrl(imageUrl);

  if (video) {
    return (
      <video
        src={video}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        aria-label="Vídeo do post"
        className="mt-1 max-h-48 w-fit rounded-xl bg-black"
      />
    );
  }

  if (image) {
    return (
      <img
        src={image}
        alt="Conteúdo do post"
        className="mt-1 max-h-48 w-fit rounded-xl object-cover"
      />
    );
  }

  return null;
}

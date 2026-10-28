import { useEffect, useState } from "react";

import { getUploadUrl } from "@/lib/utils/api";

interface UserAvatarProps {
  /** Nome do usuário — a inicial entra no fallback. */
  name?: string | null;
  /** Caminho de upload (`/uploads/...`) ou URL completa. Resolvido via getUploadUrl. */
  src?: string | null;
  /** Tamanho + forma do contêiner (ex.: "size-[60px] rounded-2xl"). Default: avatar circular 40px. */
  className?: string;
  /** Classe da fonte da inicial (ex.: "text-lg"). */
  textClassName?: string;
  alt?: string;
}

/**
 * Avatar de usuário com fallback consistente: quando NÃO há imagem **ou** ela
 * falha ao carregar (`onError`), renderiza a 1ª letra do nome sobre fundo cinza.
 *
 * Use em qualquer lugar que exiba a foto de um usuário/criador, para evitar
 * imagem quebrada (path ausente no disco, URL inválida, 404 etc.).
 */
export function UserAvatar({
  name,
  src,
  className = "size-10 rounded-full",
  textClassName = "text-sm",
  alt,
}: UserAvatarProps) {
  const resolved = getUploadUrl(src ?? undefined);
  const [broken, setBroken] = useState(false);

  // Nova URL → tenta carregar de novo (limpa erro anterior).
  useEffect(() => {
    setBroken(false);
  }, [resolved]);

  const initial = (name?.trim()?.charAt(0) ?? "").toUpperCase() || "?";

  if (!resolved || broken) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center bg-neutral-200 font-medium text-neutral-500 ${textClassName} ${className}`}
        aria-label={alt ?? name ?? undefined}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt ?? name ?? ""}
      onError={() => setBroken(true)}
      className={`shrink-0 bg-neutral-200 object-cover ${className}`}
    />
  );
}

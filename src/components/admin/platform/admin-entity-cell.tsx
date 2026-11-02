import { useEffect, useState, type ReactNode } from "react";

import { getUploadUrl } from "@/lib/utils/api";

import "@/styles/admin-platform.css";

interface AdminAvatarProps {
  name: string;
  /** Caminho/URL da foto (`photo` do contrato). Sem foto, ou foto quebrada, entram as iniciais. */
  photo?: string | null;
  /** Redondo para pessoas; quadrado para workspaces e campanhas. */
  shape?: "round" | "square";
  size?: number;
}

interface AdminEntityCellProps extends AdminAvatarProps {
  /** Linha de apoio (e-mail do dono, workspace da campanha, CNPJ). */
  subtitle?: ReactNode;
}

/** Iniciais do nome, sem símbolos soltos ("Acme & Co" → "AC"). */
export function adminInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function resolvePhoto(photo: string | null | undefined): string | undefined {
  if (!photo) return undefined;
  try {
    return getUploadUrl(photo);
  } catch {
    // Sem VITE_SERVER_URL (ambiente de teste) não há como montar a URL: cai nas iniciais.
    return undefined;
  }
}

/**
 * Foto ou iniciais, sozinha: o `leading` do cabeçalho de uma página de detalhe. Decorativa (`aria-hidden`):
 * o nome da entidade já está no título ao lado.
 */
export function AdminAvatar({ name, photo, shape = "round", size = 40 }: AdminAvatarProps) {
  const url = resolvePhoto(photo);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);

  return (
    <span
      className="adm-entity-av"
      data-shape={shape === "square" ? "square" : undefined}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.33)) }}
      aria-hidden="true"
    >
      {url && !broken ? <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} /> : adminInitials(name)}
    </span>
  );
}

/** Avatar + nome + apoio: a primeira coluna das listas de workspaces, usuários, campanhas e criadores. */
export function AdminEntityCell({ name, subtitle, photo, shape = "round", size = 40 }: AdminEntityCellProps) {
  return (
    <div className="adm-entity">
      <AdminAvatar name={name} photo={photo} shape={shape} size={size} />
      <span className="adm-entity-text">
        <b title={name}>{name}</b>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </div>
  );
}

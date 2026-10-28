import type { icons } from "lucide-react";
import { Icon } from "@/components/ui/icon";

/** Lucide não inclui marca TikTok — glyph simples alinhado à aba de seleção. */
function TikTokGlyph({
  size = 22,
  color = "#404040",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden
      className="shrink-0"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

/**
 * Nome do ícone Lucide para o tipo de rede (instagram, tiktok, …).
 * Valores compostos (ex.: instagram_facebook) mapeiam para o ícone principal.
 */
export function getLucideSocialNetworkIconName(
  networkType?: string
): keyof typeof icons {
  const raw = (networkType || "").toLowerCase().trim();
  if (raw.includes("tiktok")) return "Music";
  if (raw.includes("instagram")) return "Instagram";
  if (raw.includes("youtube")) return "Youtube";
  if (raw.includes("twitter") || raw === "x") return "Twitter";
  if (raw.includes("facebook")) return "Facebook";
  const direct: Record<string, keyof typeof icons> = {
    instagram: "Instagram",
    youtube: "Youtube",
    tiktok: "Music",
    facebook: "Facebook",
    twitter: "Twitter",
    ugc: "Share2",
  };
  return direct[raw] || "Share2";
}

export function SocialNetworkIcon({
  networkType,
  size = 16,
  color = "#404040",
  className,
}: {
  networkType?: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const raw = (networkType || "").toLowerCase().trim();
  if (raw === "tiktok" || raw.includes("tiktok")) {
    return <TikTokGlyph size={size} color={color} />;
  }
  return (
    <Icon
      name={getLucideSocialNetworkIconName(networkType)}
      size={size}
      color={color}
      className={className}
    />
  );
}

/** Rótulo amigável para tooltip (ex.: instagram → Instagram). */
export function getSocialNetworkDisplayLabel(networkType?: string): string {
  const raw = (networkType || "").toLowerCase().trim();
  if (!raw) return "";
  if (raw.includes("tiktok")) return "TikTok";
  if (raw.includes("instagram")) return "Instagram";
  if (raw.includes("youtube")) return "YouTube";
  if (raw.includes("twitter") || raw === "x") return "Twitter";
  if (raw.includes("facebook")) return "Facebook";
  if (raw.includes("ugc")) return "UGC";
  return (networkType || "").trim();
}

/** Selo no canto do avatar (cards de inscrição / curadoria / roteiros / conteúdos). */
export function SocialNetworkCornerBadge({
  networkType,
  title,
}: {
  networkType?: string;
  title?: string;
}) {
  const raw = (networkType || "").trim();
  if (!raw) return null;
  return (
    <span
      className="pointer-events-none absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm"
      title={title}
    >
      <SocialNetworkIcon networkType={networkType} size={14} color="#404040" />
    </span>
  );
}

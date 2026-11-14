import { useEffect, useState } from "react";
import { icons } from "lucide-react";

import { getUploadUrl } from "@/lib/utils/api";

import "@/styles/prototype.css";

/** Nomes de ícone do protótipo → ícones lucide equivalentes. */
const MAP: Record<string, keyof typeof icons> = {
  house: "House",
  mega: "Megaphone",
  users: "Users",
  user: "User",
  bell: "Bell",
  volume: "Volume2",
  mute: "VolumeX",
  cal: "Calendar",
  chev: "ChevronRight",
  chevdown: "ChevronDown",
  chevup: "ChevronUp",
  chevl: "ChevronLeft",
  expand: "Maximize2",
  shrink: "Minimize2",
  eye: "Eye",
  clock: "Clock",
  share: "Share2",
  star: "Star",
  pin: "MapPin",
  check: "Check",
  checks: "CheckCheck",
  search: "Search",
  funnel: "Funnel",
  sort: "ArrowDownUp",
  video: "Video",
  sparkles: "Sparkles",
  zap: "Zap",
  heart: "Heart",
  msg: "MessageSquare",
  plus: "Plus",
  minus: "Minus",
  external: "ExternalLink",
  more: "Ellipsis",
  shield: "Shield",
  verified: "CircleCheck",
  seal: "BadgeCheck",
  lock: "Lock",
  gear: "Settings",
  grid: "LayoutGrid",
  wallet: "Wallet",
  x: "X",
  trend: "TrendingUp",
  link: "Link",
  file: "FileText",
  ban: "Ban",
  trash: "Trash2",
  refresh: "RefreshCw",
  alert: "TriangleAlert",
  logout: "LogOut",
  list: "List",
  map: "Map",
  locate: "LocateFixed",
  banknote: "Banknote",
  download: "Download",
  chart: "ChartLine",
  box: "Package",
  send: "Send",
  copy: "Copy",
  paperclip: "Paperclip",
  notepad: "NotepadText",
  arrdown: "ArrowDown",
  arrup: "ArrowUp",
  flag: "Flag",
  image: "Image",
  instagram: "Instagram",
  youtube: "Youtube",
  tiktok: "Music2",
  phone: "Smartphone",
  back: "ArrowLeft",
  tag: "Tag",
  pointer: "MousePointerClick",
};

/** Ícone no padrão do protótipo (`<svg class="ico sm rot">`). */
export function I({ n, cls = "" }: { n: string; cls?: string }) {
  // O Lucide não tem a marca do TikTok (só uma nota musical): usa o ícone original, preenchido e na cor do texto.
  if (n === "tiktok") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={`ico ${cls}`.trim()}
        style={{ fill: "currentColor", stroke: "none" }}
        aria-hidden
      >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    );
  }
  const Lucide = icons[MAP[n] ?? "Circle"];
  return <Lucide className={`ico ${cls}`.trim()} aria-hidden strokeWidth={2} />;
}

/** Avatar `.iav` do protótipo, com foto real e iniciais como reserva. */
export function Av({
  name,
  src,
  size = 40,
}: {
  name: string;
  src?: string;
  size?: number;
}) {
  const url = src ? getUploadUrl(src) : undefined;
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  const showImg = !!url && !broken;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      className="iav face"
      style={{
        width: size,
        height: size,
        background: showImg ? undefined : "#050505",
        fontSize: Math.max(11, Math.round(size * 0.34)),
      }}
    >
      {showImg ? (
        <img
          src={url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setBroken(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}

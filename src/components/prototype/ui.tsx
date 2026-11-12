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
  back: "ArrowLeft",
  tag: "Tag",
  pointer: "MousePointerClick",
};

/** Ícone no padrão do protótipo (`<svg class="ico sm rot">`). */
export function I({ n, cls = "" }: { n: string; cls?: string }) {
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

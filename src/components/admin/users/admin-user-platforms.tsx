import { EMPTY_TEXT } from "@/lib/admin/format";
import type { AdminUserPlatform } from "@/shared/admin-platform.types";

const PLATFORM_LABEL: Record<AdminUserPlatform, string> = { ios: "iOS", android: "Android" };

/** "iOS", "Android" ou os dois (o usado por último primeiro). Vazio = não se sabe: "—", nunca um palpite. */
export function platformsText(platforms: readonly string[] | null | undefined): string {
  const names = (platforms ?? []).map((p) => PLATFORM_LABEL[p as AdminUserPlatform] ?? p);
  return names.length > 0 ? names.join(" e ") : EMPTY_TEXT;
}

export function UserPlatforms({ platforms }: { platforms?: readonly string[] | null }) {
  const text = platformsText(platforms);
  return <span className={text === EMPTY_TEXT ? "adm-muted" : "adm-users-sub"}>{text}</span>;
}

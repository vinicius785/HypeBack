const DEFAULT_IOS_APP_STORE_URL =
  "https://apps.apple.com/br/app/hype-app-influenciadores/id6778357608";
const DEFAULT_ANDROID_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=br.com.hypeapp.v2";
const ANDROID_PACKAGE = "br.com.hypeapp.v2";

function configuredHttpsUrl(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

export const HYPEAPP_IOS_APP_STORE_URL = configuredHttpsUrl(
  import.meta.env.VITE_IOS_APP_STORE_URL,
  DEFAULT_IOS_APP_STORE_URL,
);

export const HYPEAPP_ANDROID_PLAY_STORE_URL = configuredHttpsUrl(
  import.meta.env.VITE_ANDROID_PLAY_STORE_URL,
  DEFAULT_ANDROID_PLAY_STORE_URL,
);

export const HYPEAPP_ANDROID_OPEN_INTENT =
  `intent://#Intent;package=${ANDROID_PACKAGE};` +
  "action=android.intent.action.MAIN;" +
  "category=android.intent.category.LAUNCHER;" +
  `S.browser_fallback_url=${encodeURIComponent(HYPEAPP_ANDROID_PLAY_STORE_URL)};end`;

export function resolveHypeAppDownloadUrl(
  userAgent: string,
  maxTouchPoints = 0,
): string {
  const isIos =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  if (isIos) return HYPEAPP_IOS_APP_STORE_URL;
  if (/Android/i.test(userAgent)) return HYPEAPP_ANDROID_OPEN_INTENT;
  return HYPEAPP_IOS_APP_STORE_URL;
}

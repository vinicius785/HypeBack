import { describe, expect, it } from "vitest";

import {
  HYPEAPP_ANDROID_OPEN_INTENT,
  HYPEAPP_IOS_APP_STORE_URL,
  resolveHypeAppDownloadUrl,
} from "./app-links";

describe("resolveHypeAppDownloadUrl", () => {
  it("direciona iPhone e iPad para a App Store oficial", () => {
    expect(resolveHypeAppDownloadUrl("Mozilla/5.0 (iPhone)")).toBe(
      HYPEAPP_IOS_APP_STORE_URL,
    );
    expect(resolveHypeAppDownloadUrl("Mozilla/5.0 (Macintosh)", 5)).toBe(
      HYPEAPP_IOS_APP_STORE_URL,
    );
  });

  it("mantém intent Android com fallback para a loja", () => {
    expect(resolveHypeAppDownloadUrl("Mozilla/5.0 (Linux; Android 15)")).toBe(
      HYPEAPP_ANDROID_OPEN_INTENT,
    );
  });
});

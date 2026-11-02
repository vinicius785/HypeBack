import { afterEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/shared/types";

import { isPlatformAdmin } from "./platform-admin";

const user = (extra: Partial<User> = {}) => ({ email: "pessoa@marca.com", ...extra }) as User;

afterEach(() => vi.unstubAllEnvs());

describe("isPlatformAdmin", () => {
  it("só o campo do backend vale", () => {
    expect(isPlatformAdmin(user({ is_platform_admin: true }))).toBe(true);
    expect(isPlatformAdmin(user({ is_platform_admin: false }))).toBe(false);
    expect(isPlatformAdmin(user())).toBe(false);
    expect(isPlatformAdmin(null)).toBe(false);
    expect(isPlatformAdmin(undefined)).toBe(false);
  });

  it("a antiga lista de e-mails VITE_PLATFORM_ADMIN_EMAILS não libera mais ninguém", () => {
    vi.stubEnv("VITE_PLATFORM_ADMIN_EMAILS", "pessoa@marca.com");
    expect(isPlatformAdmin(user())).toBe(false);
  });
});

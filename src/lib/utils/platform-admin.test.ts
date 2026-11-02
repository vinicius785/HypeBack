import { afterEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/shared/types";

import { isPlatformAdmin, isPlatformStaff } from "./platform-admin";

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

describe("isPlatformStaff", () => {
  it("administrador, suporte e somente leitura fazem parte da equipe", () => {
    expect(isPlatformStaff(user({ is_platform_admin: true }))).toBe(true);
    expect(isPlatformStaff(user({ platform_role: "admin" }))).toBe(false); // sem a flag do backend, só o papel não basta
    expect(isPlatformStaff(user({ platform_role: "support" }))).toBe(true);
    expect(isPlatformStaff(user({ platform_role: "viewer" }))).toBe(true);
  });

  it("quem não tem papel, ou é nulo, fica de fora", () => {
    expect(isPlatformStaff(user())).toBe(false);
    expect(isPlatformStaff(user({ is_platform_admin: false }))).toBe(false);
    expect(isPlatformStaff(null)).toBe(false);
    expect(isPlatformStaff(undefined)).toBe(false);
  });

  it("suporte e somente leitura NÃO são administradores da plataforma", () => {
    expect(isPlatformAdmin(user({ platform_role: "support" }))).toBe(false);
    expect(isPlatformAdmin(user({ platform_role: "viewer" }))).toBe(false);
  });
});

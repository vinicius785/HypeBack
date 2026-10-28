import type { User } from "@/shared/types";

/**
 * Verifica se o usuário tem acesso ao Super Admin Dashboard.
 *
 * Ordem de checagem:
 * 1. `user.is_platform_admin === true` (campo retornado pelo backend em `GET /me`)
 * 2. Fallback temporário: email em `VITE_PLATFORM_ADMIN_EMAILS` (CSV)
 *
 * O fallback existe enquanto o backend não implementa `platform_role`/ability
 * `platform:admin`. Quando estiver pronto, remover a lista de emails do `.env`
 * — o check do backend continua valendo automaticamente.
 *
 * Ver `docs/api-super-admin-dashboard.md` (seção "Controle de acesso") para o
 * contrato esperado do backend.
 */
export function isPlatformAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.is_platform_admin === true) return true;
  const raw = import.meta.env.VITE_PLATFORM_ADMIN_EMAILS;
  if (typeof raw !== "string" || !raw.trim()) return false;
  const allowList = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowList.length === 0) return false;
  return allowList.includes(user.email.trim().toLowerCase());
}

import type { User } from "@/shared/types";

/**
 * Verifica se o usuário tem acesso ao Admin da plataforma: só vale `user.is_platform_admin === true`,
 * campo que o backend devolve em `GET /me`.
 *
 * Isto só decide o que aparece no menu; a API valida a permissão em cada rota `/admin`. Não existe lista
 * de e-mails no front: qualquer variável `VITE_*` é gravada no JavaScript público do build e deixaria
 * os e-mails dos administradores legíveis por quem abrir o app.
 */
export function isPlatformAdmin(user: User | null | undefined): boolean {
  return user?.is_platform_admin === true;
}

/**
 * Faz parte da equipe da plataforma (admin, suporte ou somente leitura)? É o que decide se o Admin aparece no
 * menu e se a rota abre. O que cada papel PODE fazer vem de `GET /admin/me` (`useAdminCapabilities`); a API
 * valida o papel em cada rota.
 */
export function isPlatformStaff(user: User | null | undefined): boolean {
  return isPlatformAdmin(user) || user?.platform_role === "support" || user?.platform_role === "viewer";
}

/**
 * O backoffice é servido em um subcaminho (`/backoffice`, definido em `base` no
 * `vite.config.ts`). `BASE_PATH` não termina em barra: "/backoffice" ou "" (testes).
 */
export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

/** URL absoluta de uma rota do app, considerando o subcaminho (links compartilháveis). */
export function appUrl(path: string): string {
  return `${window.location.origin}${BASE_PATH}${path}`;
}

/** URL de um arquivo estático (ex.: `version.json`) considerando o subcaminho. */
export function assetUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${file.replace(/^\//, "")}`;
}

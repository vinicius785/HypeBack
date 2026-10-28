import type { Niche } from "@/shared/types";

/**
 * Resolve o vínculo pai↔filho vindo da API (`parent_id`, `parentId` ou `parent.id`).
 */
export function getNicheParentId(n: Niche): string | null {
  const o = n as unknown as Record<string, unknown>;
  const nested =
    o.parent && typeof o.parent === "object" && o.parent !== null
      ? (o.parent as Record<string, unknown>).id
      : undefined;
  const parentNicheNested =
    o.parent_niche && typeof o.parent_niche === "object" && o.parent_niche !== null
      ? (o.parent_niche as Record<string, unknown>).id
      : undefined;
  const parentScalar =
    typeof o.parent === "number" || typeof o.parent === "string" ? o.parent : undefined;
  const p =
    o.parent_id ??
    o.parentId ??
    o.parent_niche_id ??
    o.main_niche_id ??
    o.niche_parent_id ??
    o.category_id ??
    parentScalar ??
    nested ??
    parentNicheNested;
  if (p == null || p === "") return null;
  const s = String(p).trim();
  if (s === "" || s === "0") return null;
  return s;
}

/** Filho direto do nicho principal (valor do form pode ser string; API pode misturar number/string). */
export function isNicheChildOf(mainKey: string, n: Niche): boolean {
  const trimmed = mainKey.trim();
  if (!trimmed) return false;
  const p = getNicheParentId(n);
  if (p == null) return false;
  if (p === trimmed) return true;
  const a = Number(trimmed);
  const b = Number(p);
  if (Number.isFinite(a) && Number.isFinite(b) && a === b) return true;
  return false;
}

/** Nicho raiz (sem pai útil na árvore). */
export function isNicheRoot(n: Niche): boolean {
  return getNicheParentId(n) == null;
}

/** Id estável para option value / comparação com `mainNiche` no form. */
export function getNicheIdKey(n: Niche): string {
  return String((n as unknown as Record<string, unknown>).id ?? n.id);
}

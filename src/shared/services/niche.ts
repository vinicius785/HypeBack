import { getApiUrl, getAuthToken } from "@/lib/utils/api";
import type { Niche } from "../types";

const NESTED_CHILD_KEYS = [
  "subniches",
  "sub_niches",
  "children",
  "child_niches",
  "niche_children",
] as const;

function hasNestedNicheChildren(items: unknown[]): boolean {
  return items.some((x) => {
    if (!x || typeof x !== "object") return false;
    const o = x as Record<string, unknown>;
    return NESTED_CHILD_KEYS.some((k) => Array.isArray(o[k]));
  });
}

function getNestedChildArrays(o: Record<string, unknown>): unknown[] {
  for (const k of NESTED_CHILD_KEYS) {
    const v = o[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function resolveParentRaw(o: Record<string, unknown>): unknown {
  const nestedParent =
    o.parent && typeof o.parent === "object" && o.parent !== null
      ? (o.parent as Record<string, unknown>).id
      : undefined;
  const parentNicheNested =
    o.parent_niche && typeof o.parent_niche === "object" && o.parent_niche !== null
      ? (o.parent_niche as Record<string, unknown>).id
      : undefined;
  const parentScalar =
    typeof o.parent === "number" || typeof o.parent === "string" ? o.parent : undefined;
  return (
    o.parent_id ??
    o.parentId ??
    o.parent_niche_id ??
    o.main_niche_id ??
    o.niche_parent_id ??
    o.category_id ??
    parentScalar ??
    nestedParent ??
    parentNicheNested
  );
}

function rowHasExplicitParent(o: Record<string, unknown>): boolean {
  const p = resolveParentRaw(o);
  return p !== undefined && p !== null && p !== "";
}

/** Achata árvore (`children` / `subniches` / …) e infere `parent_id` quando a API não manda. */
function collectNichesFlat(nodes: unknown[], parentId: unknown, acc: Niche[]): void {
  for (const raw of nodes) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const rowForNorm: Record<string, unknown> = { ...o };
    if (!rowHasExplicitParent(o) && parentId != null && parentId !== "") {
      rowForNorm.parent_id = parentId;
    }
    const n = normalizeNicheRow(rowForNorm);
    if (n) acc.push(n);
    const kids = getNestedChildArrays(o);
    if (kids.length > 0) collectNichesFlat(kids, o.id, acc);
  }
}

function extractNichesFromPayload(list: unknown[]): Niche[] {
  if (!hasNestedNicheChildren(list)) {
    return list.map(normalizeNicheRow).filter((n): n is Niche => n != null);
  }
  const acc: Niche[] = [];
  collectNichesFlat(list, null, acc);
  return acc;
}

function coerceId(v: unknown): number | string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    return t;
  }
  return String(v);
}

/**
 * Unifica formatos da API: `parent` aninhado, `parentId`, `parent_id` numérico ou string.
 */
function normalizeNicheRow(raw: unknown): Niche | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = o.name;
  if (name == null || String(name).trim() === "") return null;

  const id = coerceId(o.id);
  if (id == null) return null;

  const parentRaw = resolveParentRaw(o);
  let parent_id: number | string | null = null;
  if (parentRaw !== undefined && parentRaw !== null && parentRaw !== "") {
    const p = coerceId(parentRaw);
    parent_id = p;
  }

  return {
    id,
    parent_id,
    name: String(name),
  };
}

/** Limite alto para reduzir round-trips; a API pode ignorar e usar o próprio teto. */
const NICHES_PER_PAGE = 100;

const nichesHeaders = (): HeadersInit => ({
  Accept: "application/json",
  "Client-Type": "backoffice",
  Authorization: `Bearer ${getAuthToken()}`,
});

async function throwIfNicheRequestFailed(request: Response): Promise<void> {
  if (request.ok) return;
  let errorData: { message?: string };
  try {
    errorData = await request.json();
  } catch {
    errorData = { message: "Failed to get niches" };
  }
  const error = new Error(errorData?.message || "Failed to get niches") as Error & {
    status?: number;
  };
  error.status = request.status;
  throw error;
}

/**
 * Uma página de GET /niches (`data` + `meta.total_pages`, ou legado: só `data` / array).
 */
async function fetchNichesRawPage(
  page: number,
): Promise<{ rows: unknown[]; totalPages: number }> {
  const url = new URL(getApiUrl("/niches"));
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(NICHES_PER_PAGE));

  const request = await fetch(url.toString(), {
    method: "GET",
    headers: nichesHeaders(),
  });
  await throwIfNicheRequestFailed(request);

  const body: unknown = await request.json();

  if (Array.isArray(body)) {
    return { rows: body, totalPages: 1 };
  }

  if (body == null || typeof body !== "object") {
    return { rows: [], totalPages: 1 };
  }

  const o = body as Record<string, unknown>;
  const rows = Array.isArray(o.data) ? o.data : [];
  const meta = o.meta;
  const totalPages =
    meta &&
    typeof meta === "object" &&
    typeof (meta as Record<string, unknown>).total_pages === "number"
      ? Math.max(1, (meta as { total_pages: number }).total_pages)
      : 1;

  return { rows, totalPages };
}

function dedupeNicheRowsById(rows: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const id = (r as Record<string, unknown>).id;
    const key = id != null ? String(id) : `__idx_${out.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * Busca todos os nichos disponíveis.
 *
 * Otimização: descobre `total_pages` na página 1 e dispara as demais páginas
 * em paralelo via `Promise.all` — derruba latência de O(N) para ~O(1)
 * (limitado pelo pool de conexões HTTP do browser).
 */
export async function getNiches(): Promise<Niche[]> {
  const first = await fetchNichesRawPage(1);
  const { rows: firstRows, totalPages } = first;

  let restRows: unknown[] = [];
  if (totalPages > 1) {
    const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const pages = await Promise.all(
      remaining.map((p) => fetchNichesRawPage(p).then((r) => r.rows)),
    );
    restRows = pages.flat();
  }

  return extractNichesFromPayload(
    dedupeNicheRowsById([...firstRows, ...restRows]),
  );
}

// ---------------------------------------------------------------------------
// Cache local persistente (localStorage)
//
// Nichos são quase imutáveis e independentes de workspace. Persistir entre
// reloads elimina N round-trips em cold start sem custo perceptível de
// memória (payload tipicamente < 30 KB JSON).
//
// `NICHES_CACHE_VERSION` invalida tudo automaticamente quando o tipo `Niche`
// muda — basta incrementar.
// ---------------------------------------------------------------------------

const NICHES_CACHE_KEY = "hypeapp:niches:v1";
const NICHES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface PersistedNiches {
  savedAt: number;
  data: Niche[];
}

/** Lê do localStorage. Retorna null se ausente, corrompido ou expirado. */
export function loadPersistedNiches(): Niche[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(NICHES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedNiches;
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      !Array.isArray(parsed.data)
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > NICHES_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** Salva no localStorage. Falhas silenciosas (quota, modo privado, etc.). */
export function savePersistedNiches(data: Niche[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedNiches = { savedAt: Date.now(), data };
    window.localStorage.setItem(NICHES_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // quota cheia / storage indisponível — ignora
  }
}

/** Limpa o cache (use após admin criar nichos no backend). */
export function clearPersistedNiches(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(NICHES_CACHE_KEY);
  } catch {
    // ignore
  }
}

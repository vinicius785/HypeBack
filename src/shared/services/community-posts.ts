/**
 * Moderação de posts da comunidade — escopo **global (super-admin)**.
 *
 * Mesmas particularidades de `groups.ts`: sem header `Workspace-Id`, protegido
 * por `PlatformAdminGuard`, listagem por cursor preservando `meta`.
 *
 * Complementa a moderação por grupo: aqui entram também os posts do feed geral
 * (sem grupo), que a rota de grupos não enxerga.
 */
import { getApiUrl, getAuthToken } from "@/lib/utils/api";
import type { CursorMeta, GroupPost } from "@/shared/types";

const BASE = "/admin/community/posts";

/** Referência ao grupo do post — `null` quando o post é do feed geral. */
export interface CommunityPostGroupRef {
  id: string;
  name: string;
  color: string;
}

export interface CommunityPostModeration extends GroupPost {
  group: CommunityPostGroupRef | null;
}

export interface CommunityPostPage {
  items: CommunityPostModeration[];
  meta: CursorMeta;
}

/** `all` = tudo, `none` = apenas feed geral, ou o id de um grupo. */
export type CommunityPostScope = string;

export interface ListCommunityPostsParams {
  search?: string;
  group?: CommunityPostScope;
  cursor?: string | null;
  limit?: number;
}

function authHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "Client-Type": "backoffice",
    Authorization: `Bearer ${getAuthToken() ?? ""}`,
    // NÃO incluir "Workspace-Id" — escopo global (PlatformAdminGuard).
  };
}

async function failWith(res: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const body = await res.json();
    if (typeof body?.message === "string") message = body.message;
  } catch {
    /* corpo não-JSON — mantém fallback */
  }
  throw Object.assign(new Error(message), { status: res.status });
}

export async function listCommunityPosts(
  params: ListCommunityPostsParams = {},
): Promise<CommunityPostPage> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.group && params.group !== "all") qs.set("group", params.group);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  const res = await fetch(getApiUrl(`${BASE}${suffix}`), {
    headers: authHeaders(),
  });
  if (!res.ok) return failWith(res, `Falha ao listar posts (${res.status})`);

  const json = await res.json();
  return {
    items: (json.data ?? []) as CommunityPostModeration[],
    meta: json.meta ?? { next_cursor: null, has_more: false },
  };
}

/** Soft-delete de qualquer post da comunidade (com ou sem grupo). 204. */
export async function deleteCommunityPost(postId: string): Promise<void> {
  const res = await fetch(getApiUrl(`${BASE}/${postId}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) return failWith(res, `Falha ao excluir o post (${res.status})`);
}

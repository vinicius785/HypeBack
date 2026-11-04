/**
 * Equipe da comunidade — escopo **global (super-admin)**, como `community-posts.ts`: sem header `Workspace-Id`,
 * protegido por `PlatformAdminGuard`. Moderador e selo roxo são só identificação visual, nunca dão acesso ao Admin.
 */
import { getApiUrl, getAuthToken } from "@/lib/utils/api";

const BASE = "/admin/community/members";

export interface CommunityMember {
  id: string;
  name: string;
  username: string | null;
  email: string;
  avatar_url: string | null;
  is_moderator: boolean;
  /** Selo roxo de conta oficial. */
  is_verified: boolean;
  verified_at: string | null;
}

export interface CommunityMembersMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface CommunityMembersPage {
  items: CommunityMember[];
  meta: CommunityMembersMeta;
}

/** `team` = quem já é moderador ou conta oficial; `all` = qualquer pessoa (para buscar e promover). */
export type CommunityMembersFilter = "team" | "moderators" | "verified" | "all";

export interface ListCommunityMembersParams {
  filter?: CommunityMembersFilter;
  q?: string;
  page?: number;
  perPage?: number;
}

export interface UpdateCommunityMemberInput {
  moderator?: boolean;
  verified?: boolean;
}

function headers(json = false): Record<string, string> {
  return {
    Accept: "application/json",
    "Client-Type": "backoffice",
    Authorization: `Bearer ${getAuthToken() ?? ""}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
    // NÃO incluir "Workspace-Id" — escopo global (PlatformAdminGuard).
  };
}

async function failWith(res: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const body = await res.json();
    const raw = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
    if (typeof raw === "string" && raw) message = raw;
  } catch {
    /* corpo não-JSON — mantém o texto padrão */
  }
  throw Object.assign(new Error(message), { status: res.status });
}

export async function listCommunityMembers(params: ListCommunityMembersParams = {}): Promise<CommunityMembersPage> {
  const qs = new URLSearchParams();
  if (params.filter) qs.set("filter", params.filter);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.page) qs.set("page", String(params.page));
  if (params.perPage) qs.set("per_page", String(params.perPage));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(getApiUrl(`${BASE}${suffix}`), { headers: headers() });
  if (!res.ok) return failWith(res, "Não foi possível carregar as pessoas.");
  const body = await res.json();
  return { items: body.data as CommunityMember[], meta: body.meta as CommunityMembersMeta };
}

export async function updateCommunityMember(userId: string, input: UpdateCommunityMemberInput): Promise<CommunityMember> {
  const res = await fetch(getApiUrl(`${BASE}/${encodeURIComponent(userId)}`), {
    method: "PATCH",
    headers: headers(true),
    body: JSON.stringify(input),
  });
  if (!res.ok) return failWith(res, "Não foi possível salvar a alteração.");
  const body = await res.json();
  return body.data as CommunityMember;
}

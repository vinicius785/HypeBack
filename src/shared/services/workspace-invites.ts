import { getApiUrl, getAuthToken } from "@/lib/utils/api";
import { buildApiError } from "@/lib/workspace-state/api-error";

/** Convite para o time de uma marca, do ponto de vista de quem foi convidado (`GET /me/invites`). */
export interface MyWorkspaceInvite {
  id: number;
  workspaceId: string;
  workspaceName: string;
  role: string;
  roleLabel: string;
  invitedByName: string | null;
  createdAt: string;
  expiresAt: string;
}

/** Convite pendente, do ponto de vista da marca (`GET /workspaces/:id/invites`). */
export interface PendingWorkspaceInvite {
  id: number;
  email: string;
  role: string;
  roleLabel: string;
  invitedByName: string | null;
  createdAt: string;
  expiresAt: string;
}

const headers = () => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  "Client-Type": "backoffice",
  Authorization: `Bearer ${getAuthToken()}`,
});

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

function rows(body: unknown): Record<string, unknown>[] {
  const data = (body as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? data.filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : [];
}

async function failure(request: Response, fallback: string): Promise<never> {
  const body = await request.json().catch(() => ({}));
  throw buildApiError(request.status, body, fallback);
}

/**
 * Convites pendentes para o e-mail da pessoa logada. Uma API que ainda não tem a rota (404) vira "nenhum convite",
 * para o app não quebrar enquanto o servidor não foi atualizado.
 */
export async function listMyWorkspaceInvites(): Promise<MyWorkspaceInvite[]> {
  const request = await fetch(getApiUrl("/me/invites"), { headers: headers() });
  if (request.status === 404) return [];
  if (!request.ok) return failure(request, "Falha ao carregar os convites");

  return rows(await request.json().catch(() => ({})))
    .filter((r) => r.id != null && r.workspace_id != null)
    .map((r) => ({
      id: Number(r.id),
      workspaceId: String(r.workspace_id),
      workspaceName: text(r.workspace_name) ?? "Marca",
      role: String(r.role ?? "member"),
      roleLabel: text(r.role_label) ?? "Membro",
      invitedByName: text(r.invited_by_name),
      createdAt: String(r.created_at ?? ""),
      expiresAt: String(r.expires_at ?? ""),
    }));
}

export async function acceptWorkspaceInvite(inviteId: number): Promise<{ workspaceId: string }> {
  const request = await fetch(getApiUrl(`/me/invites/${inviteId}/accept`), { method: "POST", headers: headers() });
  if (!request.ok) return failure(request, "Não foi possível aceitar o convite");
  const body = (await request.json().catch(() => ({}))) as { data?: { workspace_id?: unknown } };
  return { workspaceId: String(body.data?.workspace_id ?? "") };
}

export async function declineWorkspaceInvite(inviteId: number): Promise<void> {
  const request = await fetch(getApiUrl(`/me/invites/${inviteId}/decline`), { method: "POST", headers: headers() });
  if (!request.ok) return failure(request, "Não foi possível recusar o convite");
}

export async function listWorkspaceInvites(workspaceId: string): Promise<PendingWorkspaceInvite[]> {
  const request = await fetch(getApiUrl(`/workspaces/${workspaceId}/invites`), { headers: headers() });
  if (request.status === 404) return [];
  if (!request.ok) return failure(request, "Falha ao carregar os convites pendentes");

  return rows(await request.json().catch(() => ({})))
    .filter((r) => r.id != null)
    .map((r) => ({
      id: Number(r.id),
      email: String(r.email ?? ""),
      role: String(r.role ?? "member"),
      roleLabel: text(r.role_label) ?? "Membro",
      invitedByName: text(r.invited_by_name),
      createdAt: String(r.created_at ?? ""),
      expiresAt: String(r.expires_at ?? ""),
    }));
}

export async function cancelWorkspaceInvite(workspaceId: string, inviteId: number): Promise<void> {
  const request = await fetch(getApiUrl(`/workspaces/${workspaceId}/invites/${inviteId}`), {
    method: "DELETE",
    headers: headers(),
  });
  if (!request.ok) return failure(request, "Não foi possível cancelar o convite");
}

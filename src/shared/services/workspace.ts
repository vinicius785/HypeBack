import { getApiUrl, getAuthToken } from "@/lib/utils/api";
import type {
  Workspace,
  WorkspaceMember,
  WorkspacePermissions,
  WorkspaceRole,
} from "../types";
import { mergeWorkspacePermissions } from "../utils/workspace-permissions";

function normalizeWorkspaceRow(row: unknown): Workspace | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : "";
  if (!id) return null;
  const perms = o.permissions;
  let permissions: WorkspacePermissions | undefined;
  if (Array.isArray(perms)) {
    // Nova API: array de strings ["workspace_read", "campaigns_read", ...]
    permissions = mergeWorkspacePermissions(perms as string[]);
  } else if (perms && typeof perms === "object") {
    permissions = perms as WorkspacePermissions;
  }
  const roleRaw = o.role != null ? String(o.role).toLowerCase() : "";
  const VALID_ROLES: WorkspaceRole[] = ["owner", "admin", "member", "aprovador", "observador", "juridico", "financeiro", "analista"];
  const role: WorkspaceRole | undefined = VALID_ROLES.includes(roleRaw as WorkspaceRole)
    ? (roleRaw as WorkspaceRole)
    : undefined;
  const str = (v: unknown) => (v != null && v !== "" ? String(v) : null);
  return {
    id,
    name: String(o.name ?? ""),
    photo: o.photo != null && o.photo !== "" ? String(o.photo) : undefined,
    description: o.description != null ? String(o.description) : undefined,
    niche_id:
      o.niche_id != null && !Number.isNaN(Number(o.niche_id))
        ? Number(o.niche_id)
        : undefined,
    legal_name: str(o.legal_name),
    tax_id: str(o.tax_id),
    postal_code: str(o.postal_code),
    street: str(o.street),
    street_number: str(o.street_number),
    unit: str(o.unit),
    neighborhood: str(o.neighborhood),
    city: str(o.city),
    state: str(o.state),
    created_at: o.created_at != null ? String(o.created_at) : undefined,
    updated_at: o.updated_at != null ? String(o.updated_at) : undefined,
    role,
    membership_id:
      o.membership_id != null && !Number.isNaN(Number(o.membership_id))
        ? Number(o.membership_id)
        : undefined,
    joined_at: o.joined_at != null ? String(o.joined_at) : undefined,
    permissions,
  };
}

function normalizeWorkspaceList(data: unknown): Workspace[] {
  if (!Array.isArray(data)) return [];
  return data.map(normalizeWorkspaceRow).filter((w): w is Workspace => w != null);
}

/**
 * Workspaces do usuário com `role`, `membership_id`, `permissions`.
 * @see API_BACKOFFICE_WORKSPACES_AND_PERMISSIONS.md — GET /backoffice/me/workspaces
 */
export async function getMyWorkspaces(): Promise<Workspace[]> {
  const request = await fetch(getApiUrl("/me/workspaces"), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to get workspaces" };
    }
    throw errorData || "Failed to get workspaces";
  }

  const response = await request.json();
  return normalizeWorkspaceList(response.data);
}

/** @deprecated Prefira `getMyWorkspaces`; mantido para chamadas legadas à listagem paginada. */
export async function getWorkspacesPaginated(
  page = 1,
  perPage = 50,
): Promise<Workspace[]> {
  const qs = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  const request = await fetch(getApiUrl(`/workspaces?${qs}`), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to get workspaces" };
    }
    throw errorData || "Failed to get workspaces";
  }

  const response = await request.json();
  return normalizeWorkspaceList(response.data);
}

export async function getWorkspaces(): Promise<Workspace[]> {
  return getMyWorkspaces();
}

export interface CreateWorkspaceData {
  name: string;
  niche_id?: number;
  description?: string;
  legal_name?: string;
  tax_id?: string;
  postal_code?: string;
  street?: string;
  street_number?: string;
  unit?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export async function createWorkspace(data: CreateWorkspaceData): Promise<Workspace> {
  const request = await fetch(getApiUrl("/workspaces"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(data),
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to create workspace" };
    }

    const error = new Error(errorData?.message || "Failed to create workspace") as any;
    error.status = request.status;
    throw error;
  }

  const response = await request.json();

  return response.data;
}

export interface UpdateWorkspaceInput {
  name: string;
  description?: string | null;
  niche_id?: number | null;
  legal_name?: string | null;
  tax_id?: string | null;
  postal_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  unit?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}

export async function updateWorkspace(
  workspaceId: string,
  data: UpdateWorkspaceInput,
): Promise<Workspace> {
  const body: Record<string, unknown> = { name: data.name };
  if (data.description !== undefined) body.description = data.description;
  if (data.niche_id !== undefined) body.niche_id = data.niche_id;
  if (data.legal_name !== undefined) body.legal_name = data.legal_name;
  if (data.tax_id !== undefined) body.tax_id = data.tax_id;
  if (data.postal_code !== undefined) body.postal_code = data.postal_code;
  if (data.street !== undefined) body.street = data.street;
  if (data.street_number !== undefined) body.street_number = data.street_number;
  if (data.unit !== undefined) body.unit = data.unit;
  if (data.neighborhood !== undefined) body.neighborhood = data.neighborhood;
  if (data.city !== undefined) body.city = data.city;
  if (data.state !== undefined) body.state = data.state;

  const request = await fetch(getApiUrl(`/workspaces/${workspaceId}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(body),
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to update workspace" };
    }
    throw errorData || "Failed to update workspace";
    }

  const response = await request.json();

  return response.data;
}

function normalizeWorkspaceMember(row: unknown): WorkspaceMember | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const uidRaw = o.user_id ?? o.userId;
  const userId =
    typeof uidRaw === "number"
      ? uidRaw
      : typeof uidRaw === "string" && !Number.isNaN(Number(uidRaw))
        ? Number(uidRaw)
        : NaN;
  if (Number.isNaN(userId)) return null;
  const roleRaw = o.role != null ? String(o.role).toLowerCase() : "";
  const VALID_ROLES_MEMBER: WorkspaceRole[] = ["owner", "admin", "member", "aprovador", "observador", "juridico", "financeiro", "analista"];
  const role: WorkspaceRole = VALID_ROLES_MEMBER.includes(roleRaw as WorkspaceRole)
    ? (roleRaw as WorkspaceRole)
    : "member";
  let permissions: string[] | undefined;
  const permsRaw = o.permissions;
  if (Array.isArray(permsRaw)) {
    permissions = permsRaw.filter((p): p is string => typeof p === "string");
  } else if (permsRaw && typeof permsRaw === "object") {
    // Formato objeto booleano: { campaigns_read: true, ... }
    permissions = Object.entries(permsRaw as Record<string, unknown>)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
  }

  return {
    user_id: userId,
    name: String(o.name ?? ""),
    email: String(o.email ?? ""),
    role,
    created_at: o.created_at != null ? String(o.created_at) : "",
    ...(permissions !== undefined ? { permissions } : {}),
  };
}

/**
 * Lista membros do workspace.
 * @see API_BACKOFFICE_WORKSPACES_AND_PERMISSIONS.md — GET /workspaces/:id/members
 */
export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const request = await fetch(getApiUrl(`/workspaces/${workspaceId}/members`), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Falha ao listar membros" };
    }
    throw errorData || "Falha ao listar membros";
  }

  const response = await request.json();
  const list = Array.isArray(response.data) ? response.data : [];
  return list
    .map(normalizeWorkspaceMember)
    .filter((m: WorkspaceMember | null): m is WorkspaceMember => m != null);
}

export interface InviteWorkspaceMemberInput {
  email: string;
  role: "admin" | "member" | "aprovador" | "observador" | "juridico" | "financeiro" | "analista";
  /**
   * Obrigatório na API se o e-mail ainda não tiver cadastro no backoffice.
   * @see API_BACKOFFICE_WORKSPACES_AND_PERMISSIONS.md seção 4.8
   */
  name?: string;
  /** Permissões customizadas — array de strings como retornado pela API. */
  permissions?: string[];
}

/** Resposta `201` de `POST .../workspaces/:id/members`. */
export interface InviteWorkspaceMemberResult {
  user_id: number;
  name: string;
  email: string;
  role: string;
  created_account: boolean;
}

function parseMembersInviteErrorMessage(errorData: unknown): string {
  if (!errorData || typeof errorData !== "object") {
    return "Falha ao convidar membro";
  }
  const o = errorData as Record<string, unknown>;
  const m = o.message;
  if (typeof m === "string" && m.trim()) return m.trim();
  if (Array.isArray(m) && m.length > 0) {
    return m.map(String).filter(Boolean).join(". ");
  }
  return "Falha ao convidar membro";
}

function normalizeInviteMemberResult(
  row: unknown,
): InviteWorkspaceMemberResult | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const uidRaw = o.user_id;
  const userId =
    typeof uidRaw === "number"
      ? uidRaw
      : typeof uidRaw === "string" && !Number.isNaN(Number(uidRaw))
        ? Number(uidRaw)
        : NaN;
  if (Number.isNaN(userId)) return null;
  return {
    user_id: userId,
    name: String(o.name ?? ""),
    email: String(o.email ?? ""),
    role: String(o.role ?? "member"),
    created_account: o.created_account === true,
  };
}

export async function inviteWorkspaceMember(
  workspaceId: string,
  data: InviteWorkspaceMemberInput,
): Promise<InviteWorkspaceMemberResult> {
  const body: Record<string, unknown> = {
    email: data.email.trim(),
    role: data.role,
  };
  const trimmedName = data.name?.trim();
  if (trimmedName) body.name = trimmedName;
  if (data.permissions && data.permissions.length > 0) body.permissions = data.permissions;

  const request = await fetch(getApiUrl(`/workspaces/${workspaceId}/members`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(body),
  });

  const responseJson = await request.json().catch(() => ({}));

  if (!request.ok) {
    const msg = parseMembersInviteErrorMessage(responseJson);
    const err = new Error(msg) as Error & { status?: number };
    err.status = request.status;
    throw err;
  }

  const normalized = normalizeInviteMemberResult(
    (responseJson as { data?: unknown }).data,
  );
  if (!normalized) {
    throw new Error("Resposta inválida ao convidar membro");
  }
  return normalized;
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: number,
  role: WorkspaceRole,
  permissions?: string[],
): Promise<void> {
  const body: Record<string, unknown> = { role };
  if (permissions !== undefined) body.permissions = permissions;
  const request = await fetch(
    getApiUrl(`/workspaces/${workspaceId}/members/${userId}`),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Falha ao alterar papel" };
    }
    const err = new Error(
      (errorData as { message?: string })?.message || "Falha ao alterar papel",
    ) as Error & { status?: number };
    err.status = request.status;
    throw err;
  }
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: number,
): Promise<void> {
  const request = await fetch(
    getApiUrl(`/workspaces/${workspaceId}/members/${userId}`),
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
      },
    },
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Falha ao remover membro" };
    }
    const err = new Error(
      (errorData as { message?: string })?.message || "Falha ao remover membro",
    ) as Error & { status?: number };
    err.status = request.status;
    throw err;
  }
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const request = await fetch(getApiUrl(`/workspaces/${workspaceId}`), {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to delete workspace" };
    }
    throw errorData || "Failed to delete workspace";
  }
}

/**
 * Faz upload da foto do workspace
 */
export async function uploadWorkspacePhoto(
  workspaceId: string,
  photo: File
): Promise<void> {
  const formData = new FormData();
  formData.append("photo", photo);

  const request = await fetch(getApiUrl(`/workspaces/${workspaceId}/photo`), {
    method: "POST",
    headers: {
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
      "Workspace-Id": workspaceId,
    },
    body: formData,
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to upload workspace photo" };
    }

    const error = new Error(
      errorData?.message || "Failed to upload workspace photo"
    ) as any;
    error.status = request.status;
    throw error;
  }
}
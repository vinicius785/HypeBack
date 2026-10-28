/**
 * Cliente HTTP centralizado para chamadas à API do backoffice.
 *
 * Elimina o boilerplate de auth/workspace repetido em todos os serviços:
 *   - getWorkspaceId() + validação de UUID
 *   - Bearer token no header Authorization
 *   - Client-Type: backoffice
 *   - Workspace-Id: <id>
 *   - Parsing de erros da API
 *
 * Uso:
 *   const data = await apiGet<Campaign[]>("/campaigns");
 *   await apiPost("/campaigns", payload);
 *   await apiPatch(`/campaigns/${id}`, updates);
 *   await apiDelete(`/campaigns/${id}`);
 */
import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function resolveWorkspaceHeaders(): Record<string, string> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório. Por favor, selecione um workspace.");
  }
  // Rejeita IDs puramente numéricos — indicam workspace não selecionado
  if (/^\d+$/.test(workspaceId)) {
    throw new Error("Workspace ID inválido. Por favor, selecione um workspace válido.");
  }
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Client-Type": "backoffice",
    Authorization: `Bearer ${getAuthToken() ?? ""}`,
    "Workspace-Id": workspaceId,
  };
}

async function handleError(response: Response, fallback: string): Promise<never> {
  let message: string = fallback;
  try {
    const body = await response.json();
    if (typeof body?.message === "string") message = body.message;
    else if (typeof body?.error === "string") message = body.error;
  } catch {
    // ignore parse error
  }
  throw new Error(message);
}

async function parseResponse<T>(response: Response, path: string): Promise<T> {
  if (!response.ok) {
    return handleError(response, `Request failed: ${path} (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  const json = await response.json();
  // A maioria dos endpoints encapsula em { data: ... }
  return (json.data !== undefined ? json.data : json) as T;
}

// ---------------------------------------------------------------------------
// Métodos públicos
// ---------------------------------------------------------------------------

export async function apiGet<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    method: "GET",
    headers: { ...resolveWorkspaceHeaders(), ...extraHeaders },
  });
  return parseResponse<T>(response, path);
}

export async function apiPost<T = void>(
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers = resolveWorkspaceHeaders();
  if (body === undefined) delete headers["Content-Type"];
  const response = await fetch(getApiUrl(path), {
    method: "POST",
    headers: { ...headers, ...extraHeaders },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse<T>(response, path);
}

export async function apiPut<T = void>(
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    method: "PUT",
    headers: { ...resolveWorkspaceHeaders(), ...extraHeaders },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse<T>(response, path);
}

export async function apiPatch<T = void>(
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    method: "PATCH",
    headers: { ...resolveWorkspaceHeaders(), ...extraHeaders },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse<T>(response, path);
}

export async function apiDelete<T = void>(
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    method: "DELETE",
    headers: { ...resolveWorkspaceHeaders(), ...extraHeaders },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse<T>(response, path);
}

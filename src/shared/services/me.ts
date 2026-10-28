import { getApiUrl, getAuthToken } from "@/lib/utils/api";
import type { User } from "../types";

function mapUserFromApi(raw: unknown): User {
  if (!raw || typeof raw !== "object") {
    throw new Error("Resposta de usuário inválida");
  }
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id)) {
    throw new Error("Resposta de usuário inválida");
  }
  const av = o.avatar ?? o.photo ?? o.profile_photo;
  const platformRole =
    typeof o.platform_role === "string" ? o.platform_role : undefined;
  const isPlatformAdmin =
    o.is_platform_admin === true ||
    platformRole === "admin" ||
    (Array.isArray(o.abilities) &&
      (o.abilities as unknown[]).includes("platform:admin"));
  return {
    id,
    name: String(o.name ?? ""),
    email: String(o.email ?? ""),
    phone: o.phone != null && String(o.phone).trim() ? String(o.phone) : null,
    email_verified_at:
      o.email_verified_at != null ? String(o.email_verified_at) : undefined,
    created_at: String(o.created_at ?? ""),
    updated_at: String(o.updated_at ?? ""),
    avatar: typeof av === "string" && av.trim() ? av : null,
    is_platform_admin: isPlatformAdmin || undefined,
  };
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
}

interface UpdatePhoneData {
  phone: string;
}

interface VerifyPhoneData {
  phone: string;
  code: string;
}

export async function getCurrentUser(): Promise<User> {
  const request = await fetch(getApiUrl("/me"), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!request.ok) {
    // Se for erro 429 (Too Many Requests), não tentar novamente
    if (request.status === 429) {
      const error = new Error("Muitas requisições. Aguarde um momento.") as any;
      error.status = 429;
      error.response = { status: 429 };
      throw error;
    }

    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to get current user" };
    }

    // Criar erro com status code para tratamento adequado
    const error = new Error(errorData?.message || "Failed to get current user") as any;
    error.status = request.status;
    error.response = { status: request.status };
    throw error;
  }

  const response = await request.json();

  return mapUserFromApi(response.data);
}

/**
 * Atualiza dados básicos do usuário autenticado.
 * Tenta `PUT /me`; se a API usar outro verbo/path, ajuste aqui.
 */
export async function updateCurrentUserProfile(
  data: UpdateProfileData,
): Promise<User> {
  const request = await fetch(getApiUrl("/me"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(data),
  });

  if (!request.ok) {
    let errorData: { message?: string; errors?: Record<string, string[]> };
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Não foi possível atualizar o perfil" };
    }
    const msg =
      typeof errorData?.message === "string"
        ? errorData.message
        : "Não foi possível atualizar o perfil";
    throw new Error(msg);
  }

  const response = await request.json();
  return mapUserFromApi(response.data);
}

export async function updatePhone(data: UpdatePhoneData): Promise<void> {
  const request = await fetch(getApiUrl("/me/phone"), {
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
      errorData = { message: "Failed to update phone" };
    }
    throw errorData || "Failed to update phone";
    }
}

export async function verifyPhone(data: VerifyPhoneData): Promise<void> {
  const request = await fetch(getApiUrl("/me/phone/verify"), {
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
      errorData = { message: "Failed to verify phone" };
    }
    throw errorData || "Failed to verify phone";
    }
}

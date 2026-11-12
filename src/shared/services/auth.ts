import { getApiUrl, getAuthToken } from "../../lib/utils/api";

interface SignInRequestData {
  email: string;
  password: string;
}

interface SignUpRequestData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

interface ForgotPasswordRequestData {
  email: string;
}

interface ResetPasswordRequestData {
  code: string;
  password: string;
}

export async function signIn(
  data: SignInRequestData
): Promise<{ token: string }> {
  const request = await fetch(getApiUrl("/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Client-Type": "backoffice",
    },
    body: JSON.stringify(data),
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to login" };
    }
    throw errorData || "Failed to login";
    }

  const response = await request.json();

  return response.data;
}

export async function signUp(
  data: SignUpRequestData
): Promise<{ token: string }> {
  const { password_confirmation, ...rest } = data;
  const request = await fetch(getApiUrl("/auth/register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Client-Type": "backoffice",
    },
    body: JSON.stringify(rest),
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to register" };
    }
    throw errorData || "Failed to register";
    }

  const response = await request.json();

  return response.data;
}

export async function forgotPassword(
  data: ForgotPasswordRequestData
): Promise<{ message: string }> {
  const request = await fetch(getApiUrl("/auth/forgot-password"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Client-Type": "backoffice",
    },
    body: JSON.stringify(data),
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to forgot password" };
    }
    throw new Error(errorData?.message || "Failed to forgot password");
    }

  const response = await request.json();

  return response.data;
}

export async function resetPassword(
  data: ResetPasswordRequestData
): Promise<{ message: string }> {
  const request = await fetch(getApiUrl("/auth/reset-password"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Client-Type": "backoffice",
    },
    body: JSON.stringify(data),
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to reset password" };
    }
    throw new Error(errorData?.message || "Failed to reset password");
    }

  const response = await request.json();

  return response.data;
}

export async function logout(): Promise<void> {
  const request = await fetch(getApiUrl("/auth/logout"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
      errorData = { message: "Failed to logout" };
    }
    throw errorData || "Failed to logout";
    }
}

interface StaffResetPasswordRequestData {
  email: string;
  code: string;
  password: string;
}

/** Falha da redefinição por código da equipe: só status, código de domínio e textos do servidor (nunca os dados enviados). */
export class StaffResetError extends Error {
  readonly status: number;
  readonly code: string | null;
  /** O `message` do servidor como lista (validação manda vários textos; os outros erros, um). */
  readonly messages: string[];

  constructor(init: { status: number; code: string | null; messages: string[] }) {
    super(init.messages[0] ?? "Falha ao redefinir a senha");
    this.name = "StaffResetError";
    this.status = init.status;
    this.code = init.code;
    this.messages = init.messages;
  }
}

/**
 * Equipe da plataforma redefine a PRÓPRIA senha com o código gerado por outro admin
 * (`POST /backoffice/auth/staff-reset-password`, pública: sem Authorization). Todas as sessões antigas da conta caem.
 * Nada do que vai no corpo (e-mail, código, senha) é registrado em log.
 */
export async function staffResetPassword(data: StaffResetPasswordRequestData): Promise<{ message: string }> {
  let request: Response;
  try {
    request = await fetch(getApiUrl("/auth/staff-reset-password"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
      },
      body: JSON.stringify(data),
    });
  } catch {
    throw new StaffResetError({ status: 0, code: "NETWORK_ERROR", messages: [] });
  }

  if (!request.ok) {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const record = (typeof body === "object" && body !== null ? body : {}) as { message?: unknown; error?: unknown };
    const messages = Array.isArray(record.message)
      ? record.message.filter((m): m is string => typeof m === "string")
      : typeof record.message === "string"
        ? [record.message]
        : [];
    throw new StaffResetError({
      status: request.status,
      code: typeof record.error === "string" ? record.error : null,
      messages,
    });
  }

  const response = await request.json();
  return response.data;
}

interface FirstAccessRequestData {
  email: string;
  code: string;
  password: string;
}

/** Falha do primeiro acesso: só status, código de domínio e textos do servidor (nunca os dados enviados). */
export class FirstAccessError extends Error {
  readonly status: number;
  readonly code: string | null;
  /** O `message` do servidor como lista (validação manda vários textos; os outros erros, um). */
  readonly messages: string[];

  constructor(init: { status: number; code: string | null; messages: string[] }) {
    super(init.messages[0] ?? "Falha no primeiro acesso");
    this.name = "FirstAccessError";
    this.status = init.status;
    this.code = init.code;
    this.messages = init.messages;
  }
}

/**
 * Primeiro acesso de uma conta criada pelo Admin (`POST /backoffice/auth/first-access`, pública: sem Authorization). O dono
 * define a senha com o código do e-mail de convite e já recebe o token (entra direto). Nada do que vai no corpo (e-mail,
 * código, senha) é registrado em log.
 */
export async function firstAccess(data: FirstAccessRequestData): Promise<{ token: string }> {
  let request: Response;
  try {
    request = await fetch(getApiUrl("/auth/first-access"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
      },
      body: JSON.stringify(data),
    });
  } catch {
    throw new FirstAccessError({ status: 0, code: "NETWORK_ERROR", messages: [] });
  }

  if (!request.ok) {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const record = (typeof body === "object" && body !== null ? body : {}) as { message?: unknown; error?: unknown };
    const messages = Array.isArray(record.message)
      ? record.message.filter((m): m is string => typeof m === "string")
      : typeof record.message === "string"
        ? [record.message]
        : [];
    throw new FirstAccessError({
      status: request.status,
      code: typeof record.error === "string" ? record.error : null,
      messages,
    });
  }

  const response = await request.json();
  return response.data;
}

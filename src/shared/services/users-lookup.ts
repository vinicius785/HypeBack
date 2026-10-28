/**
 * Backoffice — lookup de users por email/id (e batch via ids CSV).
 * Endpoint: `GET /backoffice/blockchain/users/lookup`.
 */
import { apiGet } from "@/lib/http-client";

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  type: number;
  wallet: string | null;
  balanceOnchainPoints: string;
}

/** Resolve um user pelo email exato. Lança erro se não encontrado. */
export async function lookupUserByEmail(email: string): Promise<UserSummary> {
  const res = await apiGet<{ user: UserSummary }>(
    `/blockchain/users/lookup?email=${encodeURIComponent(email)}`,
  );
  return res.user;
}

/** Resolve um user pelo id. Lança erro se não encontrado. */
export async function lookupUserById(id: number): Promise<UserSummary> {
  const res = await apiGet<{ user: UserSummary }>(
    `/blockchain/users/lookup?id=${id}`,
  );
  return res.user;
}

/** Resolve N users pelo ids (apenas os encontrados retornam). */
export async function lookupUsersByIds(ids: number[]): Promise<UserSummary[]> {
  if (ids.length === 0) return [];
  const csv = ids.join(",");
  const res = await apiGet<{ users: UserSummary[] }>(
    `/blockchain/users/lookup?ids=${csv}`,
  );
  return res.users;
}

/**
 * Resolve um user a partir de uma string que pode ser email ou id.
 * Auto-detecta: se contém '@' → email; senão tenta inteiro.
 */
export async function lookupUserAuto(input: string): Promise<UserSummary> {
  const trimmed = input.trim();
  if (trimmed.includes("@")) {
    return lookupUserByEmail(trimmed);
  }
  const id = Number(trimmed);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Forneça um email válido ou um id inteiro positivo.");
  }
  return lookupUserById(id);
}

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/http-client";

export type RosterStatus = "invited" | "active" | "declined" | "removed";

export interface RosterNetwork {
  type: string;
  username: string;
  members: number;
}

/** Proposta do criador no convite: uma comissão menor e, se quis, uma mensagem. */
export interface RosterCounterOffer {
  commission_percent: number;
  message: string | null;
  created_at: string;
}

/** Criador do elenco de uma agência (`/backoffice/agency/roster`). */
export interface RosterMember {
  id: string;
  status: RosterStatus;
  exclusive: boolean;
  /** % da agência sobre as campanhas do criador; `null` em convites feitos antes da regra. */
  commission_percent: number | null;
  /** Proposta pendente do criador; `null` se não há. */
  counter_offer: RosterCounterOffer | null;
  /** Pedido de saída: nulos sem pedido. Até `leaves_at` o vínculo e a comissão continuam valendo. */
  leave_requested_at: string | null;
  leaves_at: string | null;
  invited_at: string;
  responded_at: string | null;
  creator: {
    id: number;
    name: string;
    photo: string | null;
    username: string | null;
    followers_total: number;
    networks: RosterNetwork[];
  };
}

/** Criador que marcou "quero uma agência" (`/agency/roster/available`). Só o que a API manda: sem e-mail, telefone ou documento. */
export interface AvailableCreator {
  user_id: number;
  name: string;
  username: string | null;
  photo: string | null;
  niches: string[];
  followers_total: number;
  networks: RosterNetwork[];
  /** Desde quando está disponível (ISO). */
  available_since: string | null;
  /** Não nulo = esta agência já convidou e o convite espera resposta. */
  invite: { roster_id: string; status: RosterStatus } | null;
}

export interface AvailableCreatorsPage {
  data: AvailableCreator[];
  meta: { page: number; per_page: number; total: number; has_more: boolean };
  /** A API ainda não tem a rota (404): a tela mostra um aviso em vez de quebrar. */
  unavailable?: boolean;
}

export const AVAILABLE_PER_PAGE = 20;

/** Criadores querendo agência, com busca por nome ou @. 404 vira `unavailable` (API sem a rota). */
export async function getAvailableCreators({ q, page = 1, perPage = AVAILABLE_PER_PAGE }: { q?: string; page?: number; perPage?: number }): Promise<AvailableCreatorsPage> {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (q?.trim()) params.set("q", q.trim());
  try {
    return await apiGet<AvailableCreatorsPage>(`/agency/roster/available?${params}`);
  } catch (failure) {
    if ((failure as { status?: number } | null)?.status === 404) return { data: [], meta: { page, per_page: perPage, total: 0, has_more: false }, unavailable: true };
    throw failure;
  }
}

/** Códigos de erro do elenco (campo `error` da resposta) com o texto para a pessoa. */
export const ROSTER_ERROR_MESSAGES: Record<string, string> = {
  ROSTER_ALREADY_INVITED: "Este criador já foi convidado.",
  ROSTER_ALREADY_ACTIVE: "Este criador já está no elenco.",
  CREATOR_IN_OTHER_AGENCY: "Este criador já é exclusivo de outra agência.",
  CREATOR_EXCLUSIVE: "Este criador é exclusivo de uma agência.",
  ROSTER_NOT_ACTIVE: "A exclusividade só vale para quem já aceitou entrar no elenco.",
  AGENCY_ONLY: "O elenco é exclusivo de workspaces de agência.",
  counter_not_found: "O criador não tem proposta neste convite (ela pode ter sido retirada).",
  invite_not_available: "Este convite não está mais disponível.",
};

/** Comissão da agência: de 0 a 100, com no máximo 1 casa decimal. Devolve o motivo, ou `null` se vale. */
export function commissionError(raw: string): string | null {
  const text = raw.trim().replace(",", ".");
  if (!text) return "Informe a comissão.";
  if (!/^\d{1,3}(\.\d)?$/.test(text) || Number(text) < 0 || Number(text) > 100) return "Use de 0 a 100, com no máximo uma casa decimal.";
  return null;
}

/** `"12,5"` → `12.5`. Só chame depois de `commissionError` devolver `null`. */
export function parseCommission(raw: string): number {
  return Number(raw.trim().replace(",", "."));
}

/** `15` → "15%", `12.5` → "12,5%". */
export function formatCommission(percent: number | null | undefined): string {
  return percent === null || percent === undefined ? "—" : `${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function getAgencyRoster(status?: RosterStatus): Promise<RosterMember[]> {
  return apiGet<RosterMember[]>(`/agency/roster${status ? `?status=${status}` : ""}`);
}

/** `commission_percent` é obrigatório: sem ele o convite falha. O criador vê a comissão antes de aceitar. */
export function inviteToRoster(userId: number, commissionPercent: number): Promise<RosterMember> {
  return apiPost<RosterMember>("/agency/roster", { user_id: userId, commission_percent: commissionPercent });
}

export type RosterCounterAnswer = { action: "accept" } | { action: "decline" } | { action: "offer"; commission_percent: number };

/** Responde à proposta do criador: aceitar (ele entra já com a comissão proposta), recusar (vale a original) ou fazer nova oferta. */
export function answerRosterCounter(rosterId: string, answer: RosterCounterAnswer): Promise<RosterMember> {
  return apiPost<RosterMember>(`/agency/roster/${rosterId}/counter`, answer);
}

export function removeFromRoster(rosterId: string): Promise<{ id: string; status: RosterStatus }> {
  return apiDelete<{ id: string; status: RosterStatus }>(`/agency/roster/${rosterId}`);
}

export function setRosterExclusive(rosterId: string, exclusive: boolean): Promise<{ id: string; exclusive: boolean }> {
  return apiPatch<{ id: string; exclusive: boolean }>(`/agency/roster/${rosterId}`, { exclusive });
}

// ── Conversa com o criador (`/agency/roster/:rosterId/chat/messages`) ───────────────────────────────────────────

export interface RosterChatAuthor {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
}

export interface RosterChatAttachment {
  url: string;
  name?: string;
  mime_type?: string;
  size?: number;
}

export interface RosterChatMessage {
  id: string;
  text: string;
  created_at: string;
  image_url: string | null;
  video_url: string | null;
  video_thumbnail_url: string | null;
  attachments: Array<string | RosterChatAttachment> | null;
  author: RosterChatAuthor;
}

export interface RosterChatBody {
  text?: string;
  image_url?: string | null;
  video_url?: string | null;
  video_thumbnail_url?: string | null;
  attachments?: unknown[];
}

/** Mais nova primeiro (até 50). Ler a primeira página zera as não lidas de quem abriu. */
export function listRosterChat(rosterId: string): Promise<RosterChatMessage[]> {
  return apiGet<RosterChatMessage[]>(`/agency/roster/${rosterId}/chat/messages?limit=50`);
}

export function sendRosterChat(rosterId: string, body: RosterChatBody): Promise<RosterChatMessage> {
  return apiPost<RosterChatMessage>(`/agency/roster/${rosterId}/chat/messages`, body);
}

/** Apaga a própria mensagem (idempotente). */
export function deleteRosterChat(rosterId: string, messageId: string): Promise<void> {
  return apiDelete<void>(`/agency/roster/${rosterId}/chat/messages/${messageId}`);
}

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/http-client";

export type RosterStatus = "invited" | "active" | "declined" | "removed";

export interface RosterNetwork {
  type: string;
  username: string;
  members: number;
}

/** Criador do elenco de uma agência (`/backoffice/agency/roster`). */
export interface RosterMember {
  id: string;
  status: RosterStatus;
  exclusive: boolean;
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

/** Códigos de erro do elenco (campo `error` da resposta) com o texto para a pessoa. */
export const ROSTER_ERROR_MESSAGES: Record<string, string> = {
  ROSTER_ALREADY_INVITED: "Este criador já foi convidado.",
  ROSTER_ALREADY_ACTIVE: "Este criador já está no elenco.",
  CREATOR_IN_OTHER_AGENCY: "Este criador já é exclusivo de outra agência.",
  CREATOR_EXCLUSIVE: "Este criador é exclusivo de uma agência.",
  ROSTER_NOT_ACTIVE: "A exclusividade só vale para quem já aceitou entrar no elenco.",
  AGENCY_ONLY: "O elenco é exclusivo de workspaces de agência.",
};

export function getAgencyRoster(status?: RosterStatus): Promise<RosterMember[]> {
  return apiGet<RosterMember[]>(`/agency/roster${status ? `?status=${status}` : ""}`);
}

export function inviteToRoster(userId: number): Promise<RosterMember> {
  return apiPost<RosterMember>("/agency/roster", { user_id: userId });
}

export function removeFromRoster(rosterId: string): Promise<{ id: string; status: RosterStatus }> {
  return apiDelete<{ id: string; status: RosterStatus }>(`/agency/roster/${rosterId}`);
}

export function setRosterExclusive(rosterId: string, exclusive: boolean): Promise<{ id: string; exclusive: boolean }> {
  return apiPatch<{ id: string; exclusive: boolean }>(`/agency/roster/${rosterId}`, { exclusive });
}

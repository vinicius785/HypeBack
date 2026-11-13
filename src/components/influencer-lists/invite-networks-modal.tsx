import { useMemo } from "react";

import { I } from "@/components/prototype/ui";
import { useInfluencerAccounts } from "@/hooks/use-influencer-accounts";
import type { InfluencerProfile } from "@/shared/services/influencer";

const NET_ICON: Record<string, string> = { instagram: "instagram", tiktok: "tiktok", youtube: "youtube" };
const NET_NAME: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", ugc: "UGC" };

export interface InviteAccount {
  id: string;
  type: string;
  label: string;
  username: string;
  members: number;
}

const fmtMembers = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`
    : n >= 1_000
      ? `${Math.round(n / 1_000)} mil`
      : String(n);

export type InviteAccountRow = InviteAccount & { blocked: boolean };

/**
 * Contas do criador para o convite. A lista completa vem de `GET /influencers/:id/profiles` (a mesma do perfil),
 * então não depende de quantas contas já foram carregadas na tela; `known` é a reserva se ela não carregar.
 */
export function useInviteAccounts(userId: number, known: InviteAccount[], enabled = true) {
  const { data, isLoading, isError } = useInfluencerAccounts(userId, enabled);
  const accounts = useMemo<InviteAccountRow[]>(() => {
    if (data && data.length > 0) {
      return data.map((p: InfluencerProfile) => ({
        id: p.id,
        type: p.type.toLowerCase(),
        label: NET_NAME[p.type.toLowerCase()] ?? (p.type_label || p.type),
        username: p.username,
        members: p.members,
        blocked: p.can_invite === false,
      }));
    }
    return known.map((k) => ({ ...k, blocked: false }));
  }, [data, known]);
  // UGC não é rede social, é o tipo de conteúdo: não aparece na escolha, mas segue junto no convite (os ids vão sempre).
  const isUgc = (a: InviteAccountRow) => a.type === "ugc";
  const networks = useMemo(() => accounts.filter((a) => !isUgc(a)), [accounts]);
  const ugcIds = useMemo(() => accounts.filter((a) => isUgc(a) && !a.blocked).map((a) => a.id), [accounts]);
  return { accounts: networks, ugcIds, isLoading: enabled && isLoading, isError };
}

export const formatMembers = fmtMembers;

/** Lista de contas com seleção: em quais redes sociais do criador o convite vale. */
export function NetworkChoiceList({
  accounts,
  picked,
  onToggle,
  isLoading,
  isError,
}: {
  accounts: InviteAccountRow[];
  picked: Set<string>;
  onToggle: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) return <div className="sk" style={{ height: 120 }} />;
  return (
    <>
      {isError && <small className="cf-err" role="alert">Não foi possível carregar todas as contas. Mostrando as que já estavam na tela.</small>}
      <ul className="cx-inv">
        {accounts.map((a) => (
          <li key={a.id}>
            <label className={a.blocked ? "off" : ""}>
              <input type="checkbox" checked={picked.has(a.id)} disabled={a.blocked} onChange={() => onToggle(a.id)} />
              <span className="cx-inv-i">
                <I n={NET_ICON[a.type] ?? "video"} cls="sm" />
              </span>
              <span className="cx-inv-n">
                <b>{a.label}</b>
                <small>@{a.username} · {a.type === "ugc" ? "tipo de conteúdo" : `${fmtMembers(a.members)} seguidores`}{a.blocked ? " · não pode ser convidada" : ""}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";

import { I } from "@/components/prototype/ui";
import { useInfluencerAccounts } from "@/hooks/use-influencer-accounts";
import type { InfluencerProfile } from "@/shared/services/influencer";

import { PvModal } from "./pv-modal";

const NET_ICON: Record<string, string> = { instagram: "instagram", tiktok: "tiktok", youtube: "youtube" };
const NET_NAME: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", ugc: "UGC" };

export interface InviteAccount {
  id: string;
  type: string;
  label: string;
  username: string;
  members: number;
}

interface InviteNetworksModalProps {
  userId: number;
  name: string;
  /** Contas que já estavam no cartão (reserva se a lista completa não carregar). */
  known: InviteAccount[];
  onConfirm: (profileIds: string[]) => void;
  onClose: () => void;
}

const fmtMembers = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`
    : n >= 1_000
      ? `${Math.round(n / 1_000)} mil`
      : String(n);

/**
 * Antes de convidar um criador com várias redes: escolhe em quais contas o
 * convite vai. A lista completa vem de `GET /influencers/:id/profiles` (a mesma
 * do perfil), então não depende de quantas contas já foram carregadas na tela.
 */
export function InviteNetworksModal({ userId, name, known, onConfirm, onClose }: InviteNetworksModalProps) {
  const { data, isLoading, isError } = useInfluencerAccounts(userId);

  const accounts = useMemo<Array<InviteAccount & { blocked: boolean }>>(() => {
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

  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    setPicked(new Set(accounts.filter((a) => !a.blocked).map((a) => a.id)));
  }, [accounts]);

  // Criador com uma única conta convidável: não há o que escolher, segue direto.
  const invitable = accounts.filter((a) => !a.blocked);
  const noChoice = !isLoading && invitable.length <= 1;
  useEffect(() => {
    if (noChoice) onConfirm(invitable.map((a) => a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noChoice]);
  if (noChoice) return null;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <PvModal
      sub="Enviar convite"
      title={`Convidar ${name}`}
      onClose={onClose}
      footer={
        <>
          <small>{picked.size} {picked.size === 1 ? "rede selecionada" : "redes selecionadas"}</small>
          <button type="button" className="btn out" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" disabled={picked.size === 0 || isLoading} onClick={() => onConfirm([...picked])}>
            Continuar
          </button>
        </>
      }
    >
      <p className="cx-inv-t">Em quais redes sociais deste criador o convite vale?</p>
      {isLoading ? (
        <div className="sk" style={{ height: 120 }} />
      ) : (
        <>
          {isError && <small className="cf-err" role="alert">Não foi possível carregar todas as contas. Mostrando as que já estavam na tela.</small>}
          <ul className="cx-inv">
            {accounts.map((a) => (
              <li key={a.id}>
                <label className={a.blocked ? "off" : ""}>
                  <input type="checkbox" checked={picked.has(a.id)} disabled={a.blocked} onChange={() => toggle(a.id)} />
                  <span className="cx-inv-i">
                    <I n={NET_ICON[a.type] ?? "video"} cls="sm" />
                  </span>
                  <span className="cx-inv-n">
                    <b>{a.label}</b>
                    <small>@{a.username} · {fmtMembers(a.members)} seguidores{a.blocked ? " · não pode ser convidada" : ""}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </PvModal>
  );
}

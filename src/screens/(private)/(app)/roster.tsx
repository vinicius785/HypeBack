import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { I, Av } from "@/components/prototype/ui";
import { useWorkspacePermissions } from "@/contexts/workspace-context";
import { useIsAgencyWorkspace } from "@/hooks/use-agency-brands";
import { rosterErrorMessage, useAgencyRoster, useRemoveFromRoster, useSetRosterExclusive } from "@/hooks/use-agency-roster";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import type { RosterMember } from "@/shared/services/agency-roster";

import "@/styles/agency-roster.css";

export const Route = createFileRoute("/(private)/(app)/roster")({
  component: RosterPage,
});

type Tab = "active" | "invited";

const fmtFollowers = (n: number) => n.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function MemberCard({
  member,
  canWrite,
  busy,
  confirming,
  onToggleExclusive,
  onAskRemove,
  onCancelRemove,
  onRemove,
}: {
  member: RosterMember;
  canWrite: boolean;
  busy: boolean;
  confirming: boolean;
  onToggleExclusive: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
}) {
  const c = member.creator;
  const active = member.status === "active";
  return (
    <article className="rst-card">
      <div className="rst-top">
        <Av name={c.name} src={c.photo ?? undefined} size={48} />
        <div className="rst-id">
          <b title={c.name}>{c.name}</b>
          <small>
            {c.username ? `@${c.username} · ` : ""}
            {fmtFollowers(c.followers_total)} seguidores
          </small>
        </div>
        <span className={`rst-chip${active ? " on" : ""}`}>{active ? "No elenco" : "Convite enviado"}</span>
      </div>

      {c.networks.length > 0 ? (
        <ul className="rst-nets" aria-label="Redes sociais">
          {c.networks.map((n) => (
            <li key={`${n.type}-${n.username}`}>
              {getNetworkLabel(n.type, n.type)}
              <small>{fmtFollowers(n.members)}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rst-empty-nets">Sem redes sociais conectadas.</p>
      )}

      {active ? (
        <div className="rst-ex">
          <span>
            <b>{member.exclusive ? "Exclusivo da agência" : "Aberto a outros workspaces"}</b>
            <small>
              {member.exclusive
                ? "Só a sua agência vê e convida este criador."
                : "Este criador também aparece para outros workspaces."}
            </small>
          </span>
          {canWrite ? (
            <button
              type="button"
              role="switch"
              className="rst-sw"
              aria-checked={member.exclusive}
              aria-label={`Exclusividade de ${c.name}`}
              disabled={busy}
              onClick={onToggleExclusive}
            />
          ) : null}
        </div>
      ) : (
        <p className="rst-confirm">Ele entra no elenco quando aceitar o convite pelo app.</p>
      )}

      {canWrite ? (
        confirming ? (
          <>
            <p className="rst-confirm" role="alert">
              {active ? `Tirar ${c.name} do elenco? Ele volta a aparecer para outros workspaces.` : `Cancelar o convite para ${c.name}?`}
            </p>
            <div className="rst-row">
              <button type="button" className="btn out" onClick={onCancelRemove} disabled={busy}>
                Voltar
              </button>
              <button type="button" className="btn out dng" onClick={onRemove} disabled={busy}>
                {active ? "Confirmar remoção" : "Cancelar convite"}
              </button>
            </div>
          </>
        ) : (
          <div className="rst-row">
            <button type="button" className="btn out dng" onClick={onAskRemove} disabled={busy}>
              {active ? "Remover do elenco" : "Cancelar convite"}
            </button>
          </div>
        )
      ) : null}
    </article>
  );
}

function RosterPage() {
  const isAgency = useIsAgencyWorkspace();
  const permissions = useWorkspacePermissions();
  const canWrite = permissions.influencers_invite;
  const navigate = useNavigate();
  const { data: members = [], isLoading, error } = useAgencyRoster();
  const remove = useRemoveFromRoster();
  const setExclusive = useSetRosterExclusive();
  const [tab, setTab] = useState<Tab>("active");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const wrap = (children: React.ReactNode) => (
    <div className="pv">
      <div className="wrap" style={{ maxWidth: "none" }}>
        {children}
      </div>
    </div>
  );

  if (!isAgency) {
    return wrap(
      <div className="ov-empty big">
        <span>
          <I n="lock" />
        </span>
        <b>O elenco é exclusivo de agências</b>
        <small>Este workspace não é de agência. Fale com a equipe Hype para ativar o acesso de agência.</small>
      </div>,
    );
  }

  const active = members.filter((m) => m.status === "active");
  const invited = members.filter((m) => m.status === "invited");
  const shown = tab === "active" ? active : invited;
  const findCreators = () => void navigate({ to: "/creators" });

  const onRemove = (m: RosterMember) =>
    remove.mutate(m.id, {
      onSuccess: () => {
        setConfirmId(null);
        toast.success(m.status === "active" ? "Criador removido do elenco" : "Convite cancelado");
      },
      onError: (e) => toast.error(rosterErrorMessage(e, "Não foi possível concluir.")),
    });

  const onToggle = (m: RosterMember) =>
    setExclusive.mutate(
      { rosterId: m.id, exclusive: !m.exclusive },
      {
        onSuccess: () => toast.success(m.exclusive ? "Criador aberto a outros workspaces" : "Criador exclusivo da agência"),
        onError: (e) => toast.error(rosterErrorMessage(e, "Não foi possível alterar a exclusividade.")),
      },
    );

  return wrap(
    <>
      <div className="head fade">
        <div>
          <h1>Elenco</h1>
          <p>Criadores que aceitaram fazer parte da sua agência. Por padrão, só vocês veem e convidam esses criadores.</p>
        </div>
        <div className="btns">
          <button type="button" className="btn" onClick={findCreators}>
            <I n="search" cls="sm" />
            Encontrar criadores
          </button>
        </div>
      </div>

      <div className="tools fade rst-tabs">
        <div className="seg" role="tablist" aria-label="Estado do elenco">
          <button type="button" role="tab" aria-selected={tab === "active"} className={tab === "active" ? "on" : ""} onClick={() => setTab("active")}>
            No elenco{active.length ? ` (${active.length})` : ""}
          </button>
          <button type="button" role="tab" aria-selected={tab === "invited"} className={tab === "invited" ? "on" : ""} onClick={() => setTab("invited")}>
            Convites{invited.length ? ` (${invited.length})` : ""}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="ov-empty big">
          <small>Carregando…</small>
        </div>
      ) : error ? (
        <div className="ov-empty big">
          <span>
            <I n="x" />
          </span>
          <b>Erro ao carregar o elenco</b>
          <small>{error instanceof Error ? error.message : "Tente novamente."}</small>
        </div>
      ) : shown.length === 0 ? (
        <div className="ov-empty big">
          <span>
            <I n="star" />
          </span>
          <b>{tab === "active" ? "Seu elenco ainda está vazio" : "Nenhum convite pendente"}</b>
          <small>
            {tab === "active"
              ? "Convide criadores pelo catálogo. Eles entram no elenco quando aceitarem o convite pelo app."
              : "Os convites que você enviar aparecem aqui até o criador responder."}
          </small>
          <button type="button" className="btn" onClick={findCreators}>
            <I n="search" cls="sm" />
            Encontrar criadores
          </button>
        </div>
      ) : (
        <div className="rst-grid fade">
          {shown.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              canWrite={canWrite}
              busy={remove.isPending || setExclusive.isPending}
              confirming={confirmId === m.id}
              onToggleExclusive={() => onToggle(m)}
              onAskRemove={() => setConfirmId(m.id)}
              onCancelRemove={() => setConfirmId(null)}
              onRemove={() => onRemove(m)}
            />
          ))}
        </div>
      )}
    </>,
  );
}

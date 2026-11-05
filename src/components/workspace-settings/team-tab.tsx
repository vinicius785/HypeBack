import { useMemo, useState } from "react";

import { I, Av } from "@/components/prototype/ui";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkspaceMember, WorkspaceRole } from "@/shared/types";
import type { PendingWorkspaceInvite } from "@/shared/services/workspace-invites";
import { expiryLabel } from "@/components/workspace-invites/my-invites";
import "@/styles/settings-redesign.css";
import "@/styles/settings.css";

import { ROLE_LABEL } from "./constants";
import { SettingsSection } from "./settings-section";

interface Props {
  workspaceName: string;
  members: WorkspaceMember[];
  loading: boolean;
  /** Falha ao carregar a equipe. */
  error?: boolean;
  onRetry?: () => void;
  selfId?: number | string;
  canInvite: boolean;
  canManagePermissions: boolean;
  canRemoveMember: (m: WorkspaceMember) => boolean;
  removing: boolean;
  /** Convites enviados que a pessoa ainda não aceitou. */
  pendingInvites?: PendingWorkspaceInvite[];
  cancelingInvite?: boolean;
  onCancelInvite?: (invite: PendingWorkspaceInvite) => void;
  onInvite: () => void;
  onEdit: (m: WorkspaceMember) => void;
  onRemove: (m: WorkspaceMember) => void;
}

const RANK: Partial<Record<WorkspaceRole, number>> = { owner: 0, admin: 1 };
const SEARCH_MIN = 8;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Aba Equipe: quem tem acesso (proprietário, administradores, demais funções), convites e ações. */
export function TeamTab({
  workspaceName,
  members,
  loading,
  error = false,
  onRetry,
  selfId,
  canInvite,
  canManagePermissions,
  canRemoveMember,
  removing,
  pendingInvites = [],
  cancelingInvite = false,
  onCancelInvite,
  onInvite,
  onEdit,
  onRemove,
}: Props) {
  const [conf, setConf] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...members].sort((a, b) => (RANK[a.role] ?? 2) - (RANK[b.role] ?? 2) || a.name.localeCompare(b.name, "pt-BR")),
    [members],
  );
  const q = norm(query);
  const rows = q ? sorted.filter((m) => norm(`${m.name} ${m.email}`).includes(q)) : sorted;
  return (
    <div className="st-card stg-team">
      <SettingsSection
        id="stg-tm"
        title="Membros"
        description={`${members.length} ${members.length === 1 ? "pessoa" : "pessoas"} com acesso a ${workspaceName}.`}
        action={
          canInvite ? (
            <button type="button" className="btn" onClick={onInvite}>
              <I n="plus" cls="sm" />
              Adicionar membro
            </button>
          ) : undefined
        }
      >

        {!loading && !error && members.length >= SEARCH_MIN && (
          <label className="stg-tq">
            <I n="search" cls="sm" />
            <input type="search" aria-label="Buscar na equipe" placeholder="Buscar por nome ou e-mail" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        )}

        {loading ? (
          <div className="stg-rows" aria-busy="true" aria-label="Carregando equipe">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[64px] w-full rounded-[20px]" />
            ))}
          </div>
        ) : error ? (
          <div className="stg-empty" role="alert">
            <b>Não foi possível carregar a equipe</b>
            <small>Confira a conexão e tente de novo.</small>
            {onRetry && (
              <button type="button" className="btn out" onClick={onRetry}>
                Tentar de novo
              </button>
            )}
          </div>
        ) : members.length === 0 ? (
          <div className="stg-empty">
            <b>Nenhum membro por aqui ainda</b>
            <small>{canInvite ? "Convide pessoas para trabalhar com você neste workspace." : "Quem tiver acesso aparece nesta lista."}</small>
            {canInvite && (
              <button type="button" className="btn" onClick={onInvite}>
                <I n="plus" cls="sm" />
                Adicionar membro
              </button>
            )}
          </div>
        ) : rows.length === 0 ? (
          <div className="stg-empty small">
            <b>Ninguém encontrado</b>
            <small>Nenhum membro combina com “{query}”.</small>
          </div>
        ) : (
          <div className="stg-tbl">
            <div className="stg-th-row" aria-hidden="true">
              <span />
              <span>Nome</span>
              <span>E-mail</span>
              <span>Função</span>
              <span />
            </div>
            <ul className="stg-rows" aria-label="Membros da equipe">
              {rows.map((m) => {
                const isSelf = selfId != null && String(selfId) === String(m.user_id);
                const isOwner = m.role === "owner";
                const confirming = conf === m.user_id;
                const canEditPerms = canManagePermissions && !isOwner;
                // O proprietário nunca sai por aqui, e ninguém remove a si mesmo.
                const canRemove = canRemoveMember(m) && !isSelf && !isOwner;
                return (
                  <li key={m.user_id} className={`stg-row${confirming ? " cf" : ""}`}>
                    <Av name={m.name} size={36} />
                    <div className="stg-nm">
                      <b title={m.name}>{m.name}</b>
                      {isSelf && <em>Você</em>}
                    </div>
                    <span className="stg-em" title={m.email}>
                      {m.email}
                    </span>
                    <span className={`stg-role ${m.role}`}>{ROLE_LABEL[m.role]}</span>
                    <div className="stg-act">
                      {confirming ? (
                        <div className="stg-cf" role="group" aria-label={`Remover ${m.name} da equipe`}>
                          <span>Remover {m.name.split(" ")[0]}?</span>
                          <button type="button" className="stg-tb" onClick={() => setConf(null)}>
                            Voltar
                          </button>
                          <button
                            type="button"
                            className="stg-tb dng"
                            disabled={removing}
                            onClick={() => {
                              onRemove(m);
                              setConf(null);
                            }}
                          >
                            {removing ? "Removendo…" : "Remover"}
                          </button>
                        </div>
                      ) : (
                        <>
                          {isOwner && (
                            <span className="stg-lock" title="O proprietário tem acesso fixo: não pode ser removido nem ter o papel alterado por aqui">
                              <I n="lock" cls="sm" />
                              Acesso fixo
                            </span>
                          )}
                          {canEditPerms && (
                            <button type="button" className="stg-tb" aria-label={`Permissões de ${m.name}`} onClick={() => onEdit(m)}>
                              Permissões
                            </button>
                          )}
                          {!canRemove && canEditPerms && <span className="stg-ph" aria-hidden="true" />}
                          {canRemove && (
                            <button type="button" className="stg-ib" aria-label={`Remover ${m.name}`} title="Remover da equipe" onClick={() => setConf(m.user_id)}>
                              <I n="trash" cls="sm" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!loading && !error && members.length > 0 && !canInvite && !canManagePermissions && (
          <p className="stg-hint">Você pode ver a equipe, mas só administradores convidam pessoas e mudam permissões.</p>
        )}
      </SettingsSection>

      {pendingInvites.length > 0 && (
        <SettingsSection id="stg-pi" title="Convites aguardando resposta" description="Entram na equipe quando aceitarem.">
          <div className="stg-tbl">
            <ul className="stg-rows" aria-label="Convites pendentes">
              {pendingInvites.map((invite) => (
                <li key={invite.id} className="stg-row">
                  <Av name={invite.email} size={36} />
                  <div className="stg-nm">
                    <b className="mute">Aguardando resposta</b>
                  </div>
                  <span className="stg-em" title={invite.email}>
                    {invite.email}
                    <small>
                      {[invite.invitedByName ? `Convidado por ${invite.invitedByName}` : "", expiryLabel(invite.expiresAt)].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                  <span className={`stg-role ${invite.role}`}>{ROLE_LABEL[invite.role as keyof typeof ROLE_LABEL] ?? invite.roleLabel}</span>
                  <div className="stg-act">
                    {canInvite && onCancelInvite && (
                      <button
                        type="button"
                        className="stg-tb"
                        disabled={cancelingInvite}
                        aria-label={`Cancelar convite de ${invite.email}`}
                        onClick={() => onCancelInvite(invite)}
                      >
                        Cancelar convite
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </SettingsSection>
      )}
    </div>
  );
}

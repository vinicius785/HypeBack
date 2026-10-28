import { useState } from "react";

import { I, Av } from "@/components/prototype/ui";
import type { WorkspaceMember } from "@/shared/types";

import { ROLE_LABEL } from "./constants";

interface Props {
  workspaceName: string;
  members: WorkspaceMember[];
  loading: boolean;
  selfId?: number | string;
  canInvite: boolean;
  canManagePermissions: boolean;
  canRemoveMember: (m: WorkspaceMember) => boolean;
  removing: boolean;
  onInvite: () => void;
  onEdit: (m: WorkspaceMember) => void;
  onRemove: (m: WorkspaceMember) => void;
}

export function TeamTab({
  workspaceName,
  members,
  loading,
  selfId,
  canInvite,
  canManagePermissions,
  canRemoveMember,
  removing,
  onInvite,
  onEdit,
  onRemove,
}: Props) {
  const [conf, setConf] = useState<number | null>(null);

  return (
    <div className="wkx-cd">
      <div className="wkx-h">
        <div>
          <h3>Equipe</h3>
          <p>
            {members.length} {members.length === 1 ? "pessoa com acesso" : "pessoas com acesso"} a {workspaceName}.
          </p>
        </div>
        {canInvite && (
          <button type="button" className="btn" onClick={onInvite}>
            <I n="plus" cls="sm" />
            Adicionar membro
          </button>
        )}
      </div>
      {loading ? (
        <p className="wkx-empty">Carregando membros…</p>
      ) : members.length === 0 ? (
        <p className="wkx-empty">Nenhum membro listado.</p>
      ) : (
        <div className="wkx-ml">
          {members.map((m, k) => {
            const isSelf = selfId != null && String(selfId) === String(m.user_id);
            const c = conf === m.user_id;
            return (
              <div key={m.user_id} className={`wkx-mr ${c ? "cf" : ""}`} style={{ "--k": k } as React.CSSProperties}>
                <Av name={m.name} size={50} />
                <div className="wkx-mn">
                  <b>
                    {m.name}
                    {isSelf && <em>Você</em>}
                  </b>
                  <small>{m.email}</small>
                </div>
                <span className={`wkx-rl ${m.role}`}>{ROLE_LABEL[m.role]}</span>
                <div className="wkx-ma">
                  {c ? (
                    <div className="hdx-cf">
                      <b>Remover {m.name.split(" ")[0]} da equipe?</b>
                      <div>
                        <button type="button" className="btn out" onClick={() => setConf(null)}>
                          Voltar
                        </button>
                        <button
                          type="button"
                          className="btn dng"
                          disabled={removing}
                          onClick={() => {
                            onRemove(m);
                            setConf(null);
                          }}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {canManagePermissions && m.role !== "owner" && (
                        <button type="button" className="btn out" onClick={() => onEdit(m)}>
                          Permissões
                        </button>
                      )}
                      {canRemoveMember(m) && !isSelf && (
                        <button
                          type="button"
                          className="round wkx-rm"
                          aria-label="Remover membro"
                          title="Remover"
                          onClick={() => setConf(m.user_id)}
                        >
                          <I n="trash" cls="sm" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

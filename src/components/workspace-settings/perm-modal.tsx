import { useState } from "react";

import { I } from "@/components/prototype/ui";
import type { WorkspaceMember, WorkspaceRole } from "@/shared/types";

import { WkModal } from "./wk-modal";
import {
  ASSIGNABLE_ROLES,
  groupAny,
  groupKeys,
  groupOn,
  PERMISSION_GROUPS,
  ROLE_LABEL,
  roleDefaultPerms,
  toggleGroup,
  type AssignableRole,
} from "./constants";

interface Props {
  member: WorkspaceMember;
  saving: boolean;
  onClose: () => void;
  /** `permissions` undefined = o servidor aplica o padrão do papel. */
  onSave: (role: WorkspaceRole, permissions: string[] | undefined) => void;
}

export function PermModal({ member, saving, onClose, onSave }: Props) {
  const isAssignable = (ASSIGNABLE_ROLES as string[]).includes(member.role);
  const [role, setRole] = useState<WorkspaceRole>(member.role);
  const [perms, setPerms] = useState<string[]>(
    member.permissions && member.permissions.length > 0
      ? member.permissions
      : isAssignable
        ? roleDefaultPerms(member.role as AssignableRole)
        : [],
  );
  const [touched, setTouched] = useState(false);

  const roleChanged = role !== member.role;
  const dirty = touched || roleChanged;

  const pickRole = (r: AssignableRole) => {
    setRole(r);
    setPerms(roleDefaultPerms(r));
    setTouched(false);
  };

  return (
    <WkModal
      cls="wkm"
      sub="Permissões de acesso"
      title={member.name}
      onClose={onClose}
      footer={
        <>
          <small>{member.email}</small>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn out" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            disabled={saving || !dirty}
            onClick={() => onSave(role, touched ? perms : undefined)}
          >
            <I n="check" cls="sm" />
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <div className="n4c">
        <label className="n4l">Papel</label>
        <div className="nchips">
          {ASSIGNABLE_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              className={`nch ${role === r ? "on" : ""}`}
              aria-pressed={role === r}
              onClick={() => pickRole(r)}
            >
              {role === r && <I n="check" cls="sm" />}
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
      <div className="n4c">
        <label className="n4l">O que essa pessoa pode fazer</label>
        <div className="wkm-pg">
          {PERMISSION_GROUPS.map((g, i) => {
            const on = groupOn(perms, i);
            const some = !on && groupAny(perms, i);
            const n = groupKeys(i).filter((k) => perms.includes(k)).length;
            return (
              <div className="lvf-sw" key={g.label}>
                <div>
                  <b>{g.label}</b>
                  <small className={some ? "part" : ""}>
                    {some ? `${n} de ${g.items.length} permissões` : g.hint}
                  </small>
                </div>
                <button
                  type="button"
                  className={`tgl ${on ? "on" : ""}`}
                  role="switch"
                  aria-checked={on}
                  aria-label={g.label}
                  onClick={() => {
                    setPerms(toggleGroup(perms, i));
                    setTouched(true);
                  }}
                >
                  <i />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </WkModal>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";

import { WkModal } from "./wk-modal";
import {
  ASSIGNABLE_ROLES,
  countGroups,
  PERMISSION_GROUPS,
  groupOn,
  ROLE_DESC,
  ROLE_LABEL,
  roleDefaultPerms,
  toggleGroup,
  type AssignableRole,
} from "./constants";

export interface InvitePayload {
  mode: "invite" | "new";
  name: string;
  email: string;
  role: AssignableRole;
  /** undefined = padrão do papel (servidor). */
  permissions: string[] | undefined;
}

interface Props {
  pending: boolean;
  canManagePermissions: boolean;
  /** Modo forçado pelo pai (ex.: API pediu nome). */
  forceNew: number;
  onClose: () => void;
  onSubmit: (p: InvitePayload) => void;
}

const mail = (v: string) => /^\S+@\S+\.\S+$/.test(v);

export function InviteModal({ pending, canManagePermissions, forceNew, onClose, onSubmit }: Props) {
  const [mode, setMode] = useState<"invite" | "new">("invite");
  const [seenForce, setSeenForce] = useState(forceNew);
  if (seenForce !== forceNew) {
    setSeenForce(forceNew);
    setMode("new");
  }
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("member");
  const [perms, setPerms] = useState<string[]>(roleDefaultPerms("member"));
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState(false);

  const okE = mail(email.trim());
  const nameBad = err && mode === "new" && name.trim().length < 2;
  const emailBad = err && !okE;
  const permBad = err && touched && perms.length === 0;
  const n = countGroups(perms);

  const submit = () => {
    if (!okE || (mode === "new" && name.trim().length < 2) || (touched && perms.length === 0)) {
      setErr(true);
      return;
    }
    onSubmit({
      mode,
      name: name.trim(),
      email: email.trim(),
      role,
      permissions: canManagePermissions && touched ? perms : undefined,
    });
  };

  return (
    <WkModal
      cls="wkm wki"
      sub="Equipe"
      title="Adicionar membro"
      bodyCls="wkm-b wkn-b"
      onClose={onClose}
      footer={
        <>
          <small>
            {mode === "invite" ? "Convite por e-mail" : "Criação de usuário"} · {ROLE_LABEL[role]}
          </small>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn out" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" disabled={pending} onClick={submit}>
            <I n="send" cls="sm" />
            {pending ? "Enviando…" : mode === "invite" ? "Enviar convite" : "Criar e vincular"}
          </button>
        </>
      }
    >
      <div className="wkn-sg">
        <button type="button" className={mode === "invite" ? "on" : ""} onClick={() => { setMode("invite"); setErr(false); }}>
          <I n="send" cls="sm" />
          Convidar por e-mail
        </button>
        <button type="button" className={mode === "new" ? "on" : ""} onClick={() => { setMode("new"); setErr(false); }}>
          <I n="user" cls="sm" />
          Criar usuário
        </button>
      </div>
      <p className="wkn-hn">
        {mode === "invite" ? (
          "A pessoa recebe um convite. Se já tem conta, é vinculada ao workspace."
        ) : (
          <>
            Você cadastra a pessoa e ela define a própria senha em{" "}
            <Link to="/reset-password" search={{ email: "" }}>
              Redefinir senha
            </Link>{" "}
            com o código de 6 dígitos enviado por e-mail (válido 1 hora).
          </>
        )}
      </p>
      {mode === "new" && (
        <div className={`wkn-fd ${nameBad ? "bad" : ""}`}>
          <label htmlFor="wkmn">Nome completo</label>
          <input id="wkmn" placeholder="Nome da pessoa" value={name} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          {nameBad && <small>Informe o nome</small>}
        </div>
      )}
      <div className={`wkn-fd ${emailBad ? "bad" : ""} ${okE ? "ok" : ""}`}>
        <label htmlFor="wkme">E-mail</label>
        <div className="wkn-in">
          <input id="wkme" type="email" placeholder="pessoa@empresa.com" value={email} autoComplete="off" onChange={(e) => setEmail(e.target.value)} />
          <i>
            <I n="check" cls="sm" />
          </i>
        </div>
        {emailBad && <small>Digite um e-mail válido</small>}
      </div>
      <div className="wkn-fd">
        <label>Papel</label>
        <div className="nchips">
          {ASSIGNABLE_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              className={`nch ${role === r ? "on" : ""}`}
              aria-pressed={role === r}
              onClick={() => {
                setRole(r);
                setPerms(roleDefaultPerms(r));
                setTouched(false);
                setErr(false);
              }}
            >
              {role === r && <I n="check" cls="sm" />}
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <p className="wkn-rd">{ROLE_DESC[role]}</p>
      </div>
      {canManagePermissions && (
        <div className={`wkn-ax ${permBad ? "bad" : ""}`}>
          <div className="wkn-ah">
            <div>
              <b>Acessos</b>
              <small>
                {n ? `${n} ${n === 1 ? "área liberada" : "áreas liberadas"}` : "Nenhuma área liberada"}
              </small>
            </div>
            <button type="button" className="wkn-pz" onClick={() => setOpen((v) => !v)}>
              {open ? "Recolher" : "Personalizar"}
              <I n="chev" cls="sm" />
            </button>
          </div>
          {open ? (
            <div className="wki-pg">
              {PERMISSION_GROUPS.map((g, i) => {
                const on = groupOn(perms, i);
                return (
                  <div key={g.label} className={`wki-pc ${on ? "on" : ""}`}>
                    <div>
                      <b>{g.label}</b>
                      <small>{g.hint}</small>
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
                        setErr(false);
                      }}
                    >
                      <i />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="wkn-ch">
              {n ? (
                PERMISSION_GROUPS.map((g, i) => (groupOn(perms, i) || perms.some((k) => g.items.some((x) => x.key === k)) ? <i key={g.label}>{g.label}</i> : null))
              ) : (
                <em>Nenhum acesso</em>
              )}
            </div>
          )}
          {permBad && <small className="wkn-er">Escolha ao menos um acesso</small>}
        </div>
      )}
    </WkModal>
  );
}

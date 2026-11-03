import { useId, useState } from "react";

import { adminToast, AdminConfirmDialog, type AdminConfirmValues } from "@/components/admin/platform";
import {
  useRefreshOnStaleWorkspace,
  useWorkspaceMemberAddMutation,
  useWorkspaceMemberRemoveMutation,
  useWorkspaceMemberRoleMutation,
} from "@/hooks/admin/use-admin-workspaces-mutations";
import type { AdminAssignableWorkspaceRole, AdminWorkspaceDetail, AdminWorkspaceMember } from "@/shared/admin-platform.types";

import { ASSIGNABLE_ROLES, isAssignableRole, roleLabel } from "./workspace-constants";
import { workspaceErrorMessage } from "./workspace-errors";
import { isValidEmail } from "./workspace-validation";

import "@/styles/admin-workspaces.css";

/** Qual diálogo de membro está aberto (e para quem). */
export type MemberDialogState =
  | { kind: "add" }
  | { kind: "role"; member: AdminWorkspaceMember }
  | { kind: "remove"; member: AdminWorkspaceMember }
  | null;

interface MemberDialogsProps {
  workspace: AdminWorkspaceDetail;
  dialog: MemberDialogState;
  onClose: () => void;
}

/** Diálogos da gestão de membros. Cada um só existe enquanto aberto: o texto digitado reinicia a cada abertura. */
export function WorkspaceMemberDialogs({ workspace, dialog, onClose }: MemberDialogsProps) {
  if (!dialog) return null;
  if (dialog.kind === "add") return <AddMemberDialog workspace={workspace} onClose={onClose} />;
  if (dialog.kind === "role") {
    return <ChangeRoleDialog key={dialog.member.user_id} workspace={workspace} member={dialog.member} onClose={onClose} />;
  }
  return <RemoveMemberDialog key={dialog.member.user_id} workspace={workspace} member={dialog.member} onClose={onClose} />;
}

function RoleSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: AdminAssignableWorkspaceRole | "";
  onChange: (role: AdminAssignableWorkspaceRole) => void;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      className="adm-input adm-workspaces-select"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as AdminAssignableWorkspaceRole)}
    >
      {value === "" ? (
        <option value="" disabled>
          Escolha um papel
        </option>
      ) : null}
      {ASSIGNABLE_ROLES.map((role) => (
        <option key={role} value={role}>
          {roleLabel(role)}
        </option>
      ))}
    </select>
  );
}

/** Falha da ação: a tela estava velha (workspace mudou) fecha e avisa; o resto fica no diálogo para corrigir. */
function useMemberFailure(onClose: () => void, setError: (message: string) => void) {
  const refreshIfStale = useRefreshOnStaleWorkspace();
  return (failure: unknown) => {
    if (refreshIfStale(failure)) {
      adminToast.error(workspaceErrorMessage(failure));
      onClose();
      return;
    }
    setError(workspaceErrorMessage(failure));
  };
}

function AddMemberDialog({ workspace, onClose }: { workspace: AdminWorkspaceDetail; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminAssignableWorkspaceRole>("member");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useWorkspaceMemberAddMutation(workspace.id);
  const fail = useMemberFailure(onClose, setError);
  const emailId = useId();
  const roleId = useId();
  const emailValid = isValidEmail(email);

  const submit = async ({ reason }: AdminConfirmValues) => {
    setError(null);
    try {
      await mutation.mutateAsync({ reason, email: email.trim().toLowerCase(), role });
      adminToast.success("Membro adicionado.");
      onClose();
    } catch (failure) {
      fail(failure);
    }
  };

  return (
    <AdminConfirmDialog
      open
      title="Adicionar membro"
      eyebrow={`Workspace · ${workspace.name}`}
      description="Informe o e-mail da pessoa e o papel que ela terá neste workspace."
      confirmLabel="Adicionar"
      pendingLabel="Adicionando…"
      pending={mutation.isPending}
      error={error}
      confirmDisabled={!emailValid}
      onConfirm={submit}
      onClose={onClose}
    >
      <div className="adm-field">
        <label htmlFor={emailId}>E-mail da pessoa</label>
        <input
          id={emailId}
          type="email"
          className="adm-input"
          value={email}
          readOnly={mutation.isPending}
          autoComplete="off"
          spellCheck={false}
          placeholder="nome@empresa.com.br"
          aria-invalid={touched && !emailValid ? true : undefined}
          data-adm-autofocus
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        <div className="adm-field-foot">
          <span data-error={touched && !emailValid ? "true" : undefined}>
            {touched && !emailValid ? "Informe um e-mail válido." : ""}
          </span>
        </div>
      </div>
      <div className="adm-field">
        <label htmlFor={roleId}>Papel</label>
        <RoleSelect id={roleId} value={role} onChange={setRole} disabled={mutation.isPending} />
      </div>
    </AdminConfirmDialog>
  );
}

function ChangeRoleDialog({
  workspace,
  member,
  onClose,
}: {
  workspace: AdminWorkspaceDetail;
  member: AdminWorkspaceMember;
  onClose: () => void;
}) {
  // Quem hoje é "Personalizado" começa sem papel escolhido: esse papel não dá para atribuir pelo Admin.
  const [role, setRole] = useState<AdminAssignableWorkspaceRole | "">(isAssignableRole(member.role) ? member.role : "");
  const [error, setError] = useState<string | null>(null);
  const mutation = useWorkspaceMemberRoleMutation(workspace.id, member.user_id);
  const fail = useMemberFailure(onClose, setError);
  const roleId = useId();

  const submit = async ({ reason }: AdminConfirmValues) => {
    if (role === "" || role === member.role) return;
    setError(null);
    try {
      await mutation.mutateAsync({ reason, role });
      adminToast.success(`Papel de ${member.name} alterado para ${roleLabel(role)}.`);
      onClose();
    } catch (failure) {
      fail(failure);
    }
  };

  return (
    <AdminConfirmDialog
      open
      title="Alterar papel"
      eyebrow={`${member.name} · ${workspace.name}`}
      description={
        <>
          Papel atual: <b>{roleLabel(member.role)}</b>.
          {member.has_custom_permissions ? " Esta pessoa tem permissões personalizadas, que sobrescrevem o padrão do papel." : ""}
        </>
      }
      confirmLabel="Alterar papel"
      pendingLabel="Alterando…"
      pending={mutation.isPending}
      error={error}
      confirmDisabled={role === "" || role === member.role}
      onConfirm={submit}
      onClose={onClose}
    >
      <div className="adm-field">
        <label htmlFor={roleId}>Novo papel</label>
        <RoleSelect id={roleId} value={role} onChange={setRole} disabled={mutation.isPending} />
        {role !== "" && role === member.role ? (
          <div className="adm-field-foot">
            <span>Escolha um papel diferente do atual.</span>
          </div>
        ) : null}
      </div>
    </AdminConfirmDialog>
  );
}

function RemoveMemberDialog({
  workspace,
  member,
  onClose,
}: {
  workspace: AdminWorkspaceDetail;
  member: AdminWorkspaceMember;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useWorkspaceMemberRemoveMutation(workspace.id, member.user_id);
  const fail = useMemberFailure(onClose, setError);

  const submit = async ({ reason }: AdminConfirmValues) => {
    setError(null);
    try {
      await mutation.mutateAsync({ reason });
      adminToast.success(`${member.name} foi removido do workspace.`);
      onClose();
    } catch (failure) {
      fail(failure);
    }
  };

  return (
    <AdminConfirmDialog
      open
      tone="danger"
      title="Remover do workspace"
      eyebrow={`${member.name} · ${workspace.name}`}
      description={`Confirme a remoção de ${member.name} (${member.email}) deste workspace.`}
      consequences={[
        "A pessoa perde o acesso a este workspace.",
        "A conta dela continua existindo e o acesso a outros workspaces não muda.",
        "A remoção fica registrada no histórico, com o motivo.",
      ]}
      confirmLabel="Remover"
      pendingLabel="Removendo…"
      pending={mutation.isPending}
      error={error}
      onConfirm={submit}
      onClose={onClose}
    />
  );
}

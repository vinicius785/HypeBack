import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { adminToast, AdminConfirmDialog, type AdminConfirmValues } from "@/components/admin/platform";
import { useWorkspaceCreateMutation } from "@/hooks/admin/use-admin-workspaces-mutations";
import { AdminApiError } from "@/lib/admin/admin-client";

import { workspaceErrorMessage } from "./workspace-errors";
import {
  NEW_ACCOUNT_EMAIL_MAX,
  NEW_ACCOUNT_NAME_MAX,
  validateNewAccount,
  type NewAccountErrors,
  type NewAccountField,
  type NewAccountValues,
} from "./workspace-validation";

import "@/styles/admin-workspaces.css";

const EMPTY: NewAccountValues = { account_type: "", workspace_name: "", owner_name: "", owner_email: "" };

const FIELD_NAMES: readonly NewAccountField[] = ["account_type", "workspace_name", "owner_name", "owner_email"];

/**
 * 400 de validação: cada mensagem que cita um campo do corpo vai para o campo certo (o resto fica no erro geral do
 * diálogo, inclusive o que fala do motivo ou da chave de idempotência).
 */
function splitApiMessages(failure: unknown): { fields: NewAccountErrors; general: string | null } {
  if (!(failure instanceof AdminApiError) || failure.status !== 400) return { fields: {}, general: workspaceErrorMessage(failure) };
  const fields: NewAccountErrors = {};
  const rest: string[] = [];
  for (const message of failure.messages) {
    const field = FIELD_NAMES.find((name) => message.includes(name));
    if (field && !fields[field]) fields[field] = message;
    else rest.push(message);
  }
  return { fields, general: rest.length > 0 ? rest.join(" · ") : null };
}

/**
 * "Nova conta": cria uma conta de marca ou de agência e convida o dono por e-mail (`POST /admin/workspaces`). O motivo
 * (5 a 500, vai para o log de auditoria) é o campo padrão do `AdminConfirmDialog`. Nunca há senha na tela: o dono define a
 * própria pelo código que recebe no e-mail.
 */
export function WorkspaceCreateDialog({ onClose }: { onClose: () => void }) {
  const [values, setValues] = useState<NewAccountValues>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<NewAccountField, boolean>>>({});
  const [serverFields, setServerFields] = useState<NewAccountErrors>({});
  const [error, setError] = useState<string | null>(null);
  const mutation = useWorkspaceCreateMutation();
  const navigate = useNavigate();
  const ids = { type: useId(), name: useId(), owner: useId(), email: useId() };

  const errors = validateNewAccount(values);
  const valid = Object.keys(errors).length === 0;
  const dirty = Object.values(values).some((value) => value !== "");

  const set = (field: NewAccountField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setServerFields((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };
  const touch = (field: NewAccountField) => setTouched((current) => ({ ...current, [field]: true }));
  const shown = (field: NewAccountField) => (touched[field] ? errors[field] : undefined) ?? serverFields[field];

  const submit = async ({ reason }: AdminConfirmValues) => {
    if (!valid || mutation.isPending) return;
    setError(null);
    try {
      const result = await mutation.mutateAsync({
        workspace_name: values.workspace_name.trim(),
        account_type: values.account_type as "brand" | "agency",
        owner_name: values.owner_name.trim(),
        owner_email: values.owner_email.trim().toLowerCase(),
        reason,
      });
      adminToast.success(`Conta criada. Convite enviado para ${result.owner.email}.`);
      onClose();
      void navigate({ to: "/admin/workspaces/$workspaceId", params: { workspaceId: result.workspace.id } });
    } catch (failure) {
      const { fields, general } = splitApiMessages(failure);
      setServerFields(fields);
      setError(general);
    }
  };

  const field = (name: NewAccountField, id: string, label: string, input: React.ReactNode) => (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      {input}
      <div className="adm-field-foot">
        <span data-error={shown(name) ? "true" : undefined}>{shown(name) ?? ""}</span>
      </div>
    </div>
  );

  return (
    <AdminConfirmDialog
      open
      title="Nova conta"
      eyebrow="Workspaces"
      description="O dono recebe um e-mail de convite com um código para definir a senha. O código vale 7 dias."
      confirmLabel="Criar conta"
      pendingLabel="Criando…"
      tone="neutral"
      pending={mutation.isPending}
      error={error}
      confirmDisabled={!valid}
      dirty={dirty}
      reason={{ label: "Motivo", placeholder: "Por que esta conta está sendo criada? Fica no log de auditoria." }}
      onConfirm={submit}
      onClose={onClose}
    >
      {field(
        "account_type",
        ids.type,
        "Tipo da conta",
        <select
          id={ids.type}
          className="adm-input adm-workspaces-select"
          value={values.account_type}
          disabled={mutation.isPending}
          aria-invalid={shown("account_type") ? true : undefined}
          data-adm-autofocus
          onChange={(event) => set("account_type", event.target.value)}
          onBlur={() => touch("account_type")}
        >
          <option value="" disabled>
            Escolha o tipo
          </option>
          <option value="brand">Marca</option>
          <option value="agency">Agência</option>
        </select>,
      )}
      {field(
        "workspace_name",
        ids.name,
        "Nome da marca ou agência",
        <input
          id={ids.name}
          className="adm-input"
          value={values.workspace_name}
          maxLength={NEW_ACCOUNT_NAME_MAX}
          readOnly={mutation.isPending}
          autoComplete="off"
          aria-invalid={shown("workspace_name") ? true : undefined}
          onChange={(event) => set("workspace_name", event.target.value)}
          onBlur={() => touch("workspace_name")}
        />,
      )}
      {field(
        "owner_name",
        ids.owner,
        "Nome do dono",
        <input
          id={ids.owner}
          className="adm-input"
          value={values.owner_name}
          maxLength={NEW_ACCOUNT_NAME_MAX}
          readOnly={mutation.isPending}
          autoComplete="off"
          aria-invalid={shown("owner_name") ? true : undefined}
          onChange={(event) => set("owner_name", event.target.value)}
          onBlur={() => touch("owner_name")}
        />,
      )}
      {field(
        "owner_email",
        ids.email,
        "E-mail do dono",
        <input
          id={ids.email}
          type="email"
          className="adm-input"
          value={values.owner_email}
          maxLength={NEW_ACCOUNT_EMAIL_MAX}
          readOnly={mutation.isPending}
          autoComplete="off"
          spellCheck={false}
          placeholder="nome@empresa.com.br"
          aria-invalid={shown("owner_email") ? true : undefined}
          onChange={(event) => set("owner_email", event.target.value)}
          onBlur={() => touch("owner_email")}
        />,
      )}
    </AdminConfirmDialog>
  );
}

import { useId, useState } from "react";
import { toast } from "sonner";

import { AdminConfirmDialog, type AdminConfirmValues } from "@/components/admin/platform";
import {
  useRefreshOnStaleWorkspace,
  useWorkspaceUpdateMutation,
} from "@/hooks/admin/use-admin-workspaces-mutations";
import type { AdminWorkspaceDetail } from "@/shared/admin-platform.types";

import { workspaceErrorMessage } from "./workspace-errors";
import {
  buildUpdateFields,
  changedEditFields,
  editValuesFromDetail,
  validateEditValues,
  type WorkspaceEditField,
  type WorkspaceEditValues,
} from "./workspace-validation";

import "@/styles/admin-workspaces.css";

interface FieldSpec {
  field: WorkspaceEditField;
  label: string;
  /** Colunas que o campo ocupa na grade de 6. */
  span: 1 | 2 | 3 | 4 | 6;
  hint?: string;
  multiline?: boolean;
  inputMode?: "numeric";
  maxLength?: number;
  autoFocus?: boolean;
}

const MAIN_FIELDS: readonly FieldSpec[] = [
  { field: "name", label: "Nome", span: 6, autoFocus: true },
  { field: "legal_name", label: "Razão social", span: 3 },
  { field: "tax_id", label: "CNPJ", span: 3, inputMode: "numeric", hint: "14 dígitos; a máscara é opcional." },
  { field: "description", label: "Descrição", span: 6, multiline: true },
];

const ADDRESS_FIELDS: readonly FieldSpec[] = [
  { field: "postal_code", label: "CEP", span: 2, inputMode: "numeric" },
  { field: "street", label: "Rua", span: 4 },
  { field: "street_number", label: "Número", span: 2 },
  { field: "unit", label: "Complemento", span: 4 },
  { field: "neighborhood", label: "Bairro", span: 3 },
  { field: "city", label: "Cidade", span: 2 },
  { field: "state", label: "UF", span: 1, maxLength: 2 },
];

interface WorkspaceEditDialogProps {
  open: boolean;
  workspace: AdminWorkspaceDetail;
  onClose: () => void;
}

/**
 * "Editar dados": os campos que o contrato permite (`AdminWorkspaceUpdateBody`; o estado nunca muda por
 * aqui). Manda só o que mudou, mais o motivo; sem mudança nada é enviado (o botão fica desabilitado).
 * CNPJ (14 dígitos), CEP (8 dígitos) e UF (2 letras) são conferidos só quando a pessoa os altera.
 * Os valores iniciais ficam congelados na abertura: uma nova consulta do detalhe não mexe no que está sendo editado.
 */
export function WorkspaceEditDialog({ open, workspace, onClose }: WorkspaceEditDialogProps) {
  if (!open) return null;
  return <WorkspaceEditDialogBody workspace={workspace} onClose={onClose} />;
}

function WorkspaceEditDialogBody({ workspace, onClose }: Omit<WorkspaceEditDialogProps, "open">) {
  const [original] = useState(() => editValuesFromDetail(workspace));
  const [values, setValues] = useState<WorkspaceEditValues>(original);
  const [touched, setTouched] = useState<Partial<Record<WorkspaceEditField, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const mutation = useWorkspaceUpdateMutation(workspace.id);
  const refreshIfStale = useRefreshOnStaleWorkspace();
  const idPrefix = useId();

  const errors = validateEditValues(values, original);
  const changed = changedEditFields(values, original);
  const invalid = Object.keys(errors).length > 0;

  const submit = async ({ reason }: AdminConfirmValues) => {
    if (changed.length === 0 || invalid) return;
    setError(null);
    try {
      await mutation.mutateAsync({ reason, ...buildUpdateFields(values, original) });
      toast.success("Dados do workspace atualizados.");
      onClose();
    } catch (failure) {
      if (refreshIfStale(failure)) {
        toast.error(workspaceErrorMessage(failure));
        onClose();
        return;
      }
      setError(workspaceErrorMessage(failure));
    }
  };

  const renderField = (spec: FieldSpec) => {
    const id = `${idPrefix}-${spec.field}`;
    const message = touched[spec.field] ? errors[spec.field] : undefined;
    const common = {
      id,
      className: "adm-input",
      value: values[spec.field],
      readOnly: mutation.isPending,
      autoComplete: "off",
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message || spec.hint ? `${id}-note` : undefined,
      "data-adm-autofocus": spec.autoFocus ? true : undefined,
      onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [spec.field]: event.target.value })),
      onBlur: () => setTouched((current) => ({ ...current, [spec.field]: true })),
    };
    return (
      <div className="adm-field adm-workspaces-form-field" data-span={spec.span} key={spec.field}>
        <label htmlFor={id}>{spec.label}</label>
        {spec.multiline ? (
          <textarea {...common} rows={3} />
        ) : (
          <input
            {...common}
            type="text"
            inputMode={spec.inputMode}
            maxLength={spec.maxLength}
            data-uppercase={spec.field === "state" ? "true" : undefined}
          />
        )}
        {message || spec.hint ? (
          <div className="adm-field-foot" id={`${id}-note`}>
            <span data-error={message ? "true" : undefined}>{message ?? spec.hint}</span>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <AdminConfirmDialog
      open
      wide
      title="Editar dados"
      eyebrow={`Workspace · ${workspace.name}`}
      description="Altere só o que precisa; o resto fica como está. O estado do workspace (ativo, suspenso…) não muda por aqui."
      confirmLabel="Salvar alterações"
      pendingLabel="Salvando…"
      pending={mutation.isPending}
      error={error}
      confirmDisabled={changed.length === 0 || invalid}
      dirty={changed.length > 0}
      onConfirm={submit}
      onClose={onClose}
    >
      <div className="adm-workspaces-form">
        {MAIN_FIELDS.map(renderField)}
        <h3 className="adm-workspaces-form-title">Endereço</h3>
        {ADDRESS_FIELDS.map(renderField)}
      </div>
      {changed.length === 0 ? <p className="adm-workspaces-quiet">Nenhum campo foi alterado ainda.</p> : null}
    </AdminConfirmDialog>
  );
}

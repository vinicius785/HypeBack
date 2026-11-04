/**
 * Validação e montagem do corpo do "Editar dados" do workspace e do e-mail do novo membro.
 *
 * A edição manda só o que mudou (`AdminWorkspaceUpdateBody` é parcial): cada campo é comparado com o valor
 * original já normalizado, e só os campos alterados são validados. Assim um dado antigo fora do padrão
 * (um CNPJ cadastrado sem os 14 dígitos, por exemplo) não impede de corrigir outro campo.
 */
import type { AdminWorkspaceDetail, AdminWorkspaceUpdateBody } from "@/shared/admin-platform.types";

import { digitsOnly, formatCep, formatCnpj } from "./workspace-format";

export const WORKSPACE_EDIT_FIELDS = [
  "name",
  "legal_name",
  "tax_id",
  "description",
  "postal_code",
  "street",
  "street_number",
  "unit",
  "neighborhood",
  "city",
  "state",
  "account_type",
] as const;

export type WorkspaceEditField = (typeof WORKSPACE_EDIT_FIELDS)[number];
export type WorkspaceEditValues = Record<WorkspaceEditField, string>;
export type WorkspaceEditErrors = Partial<Record<WorkspaceEditField, string>>;
export type WorkspaceUpdateFields = Omit<AdminWorkspaceUpdateBody, "reason">;

/** Valor que o campo guarda de verdade: só dígitos no CNPJ e no CEP, UF em maiúsculas, texto aparado. */
export function normalizeEditValue(field: WorkspaceEditField, value: string): string {
  switch (field) {
    case "tax_id":
    case "postal_code":
      return digitsOnly(value);
    case "state":
      return value.trim().toUpperCase();
    default:
      return value.trim();
  }
}

/** O que cada campo mostra ao abrir o diálogo (CNPJ e CEP já com máscara, para leitura). */
export function editValuesFromDetail(detail: AdminWorkspaceDetail): WorkspaceEditValues {
  return {
    name: detail.name,
    legal_name: detail.legal_name ?? "",
    tax_id: formatCnpj(detail.tax_id),
    description: detail.description ?? "",
    postal_code: formatCep(detail.address.postal_code),
    street: detail.address.street ?? "",
    street_number: detail.address.street_number ?? "",
    unit: detail.address.unit ?? "",
    neighborhood: detail.address.neighborhood ?? "",
    city: detail.address.city ?? "",
    state: detail.address.state ?? "",
    account_type: detail.account_type ?? "brand",
  };
}

export function changedEditFields(values: WorkspaceEditValues, original: WorkspaceEditValues): WorkspaceEditField[] {
  return WORKSPACE_EDIT_FIELDS.filter(
    (field) => normalizeEditValue(field, values[field]) !== normalizeEditValue(field, original[field]),
  );
}

/**
 * CNPJ com os dois dígitos verificadores corretos: 14 dígitos (sem máscara), nem todos iguais. É a mesma
 * conta do servidor (`IsCnpj` do `PATCH /admin/workspaces/:id`), para a recusa aparecer ao digitar e não
 * como um 400 depois do envio.
 */
export function isValidCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  for (const size of [12, 13]) {
    let sum = 0;
    let weight = size - 7;
    for (let i = 0; i < size; i++) {
      sum += Number(cnpj[i]) * weight--;
      if (weight < 2) weight = 9;
    }
    const digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (Number(cnpj[size]) !== digit) return false;
  }
  return true;
}

/** Erro de cada campo ALTERADO e inválido; campo intacto nunca acusa erro. */
export function validateEditValues(values: WorkspaceEditValues, original: WorkspaceEditValues): WorkspaceEditErrors {
  const errors: WorkspaceEditErrors = {};
  for (const field of changedEditFields(values, original)) {
    const value = normalizeEditValue(field, values[field]);
    if (field === "name" && value === "") errors.name = "Informe o nome do workspace.";
    else if (field === "tax_id" && value !== "" && value.length !== 14) errors.tax_id = "CNPJ inválido: informe os 14 dígitos.";
    else if (field === "tax_id" && value !== "" && !isValidCnpj(value)) errors.tax_id = "CNPJ inválido: os dígitos verificadores não conferem.";
    else if (field === "postal_code" && value !== "" && value.length !== 8) errors.postal_code = "CEP inválido: informe os 8 dígitos.";
    else if (field === "state" && value !== "" && !/^[A-Z]{2}$/.test(value)) errors.state = "UF inválida: informe 2 letras (ex.: SP).";
    else if (field === "account_type" && value !== "brand" && value !== "agency") errors.account_type = "Escolha marca ou agência.";
  }
  return errors;
}

/** Corpo do PATCH sem o motivo: só os campos alterados; campo esvaziado vira `null` (o nome nunca é nulo). */
export function buildUpdateFields(values: WorkspaceEditValues, original: WorkspaceEditValues): WorkspaceUpdateFields {
  const fields: Record<string, string | null> = {};
  for (const field of changedEditFields(values, original)) {
    const value = normalizeEditValue(field, values[field]);
    fields[field] = value === "" && field !== "name" && field !== "account_type" ? null : value;
  }
  return fields as WorkspaceUpdateFields;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

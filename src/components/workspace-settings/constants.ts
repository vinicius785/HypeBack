import type { WorkspaceRole } from "@/shared/types";

export const UF = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  aprovador: "Aprovador",
  observador: "Observador",
  juridico: "Jurídico",
  financeiro: "Financeiro",
  analista: "Analista",
};

export type AssignableRole = Exclude<WorkspaceRole, "owner">;

/** Papéis atribuíveis, na ordem do protótipo. */
export const ASSIGNABLE_ROLES: AssignableRole[] = [
  "admin",
  "member",
  "aprovador",
  "observador",
  "juridico",
  "financeiro",
  "analista",
];

export const ROLE_DESC: Record<AssignableRole, string> = {
  admin: "Acesso total, inclusive equipe e financeiro.",
  member: "Trabalha com campanhas, criadores, roteiros e conteúdos.",
  aprovador: "Aprova criadores, roteiros e conteúdos.",
  observador: "Só acompanha os dados do workspace.",
  juridico: "Cuida dos contratos e dos conteúdos.",
  financeiro: "Cuida do saldo e dos pagamentos.",
  analista: "Analisa campanhas, criadores e financeiro.",
};

export interface PermGroup {
  label: string;
  hint: string;
  items: Array<{ key: string; label: string }>;
}

/** Grupos do protótipo; cada um liga/desliga as permissões reais do grupo. */
export const PERMISSION_GROUPS: PermGroup[] = [
  {
    label: "Workspace",
    hint: "Ver e editar dados da marca",
    items: [
      { key: "workspace_read", label: "Ver workspace" },
      { key: "workspace_settings_write", label: "Editar configurações" },
      { key: "workspace_photo_write", label: "Alterar foto" },
      { key: "workspace_delete", label: "Excluir workspace" },
    ],
  },
  {
    label: "Membros",
    hint: "Convidar, remover e definir papéis",
    items: [
      { key: "members_list", label: "Listar membros" },
      { key: "members_invite", label: "Convidar membros" },
      { key: "members_remove", label: "Remover membros" },
      { key: "members_role_write", label: "Gerenciar papéis e permissões" },
    ],
  },
  {
    label: "Campanhas",
    hint: "Criar, editar e publicar",
    items: [
      { key: "campaigns_read", label: "Ver campanhas" },
      { key: "campaigns_create", label: "Criar campanhas" },
      { key: "campaigns_write", label: "Editar campanhas" },
      { key: "campaigns_delete", label: "Excluir campanhas" },
      { key: "campaigns_publish", label: "Publicar campanhas" },
    ],
  },
  {
    label: "Influenciadores",
    hint: "Convidar, aprovar e ver valores",
    items: [
      { key: "influencers_read", label: "Ver influenciadores" },
      { key: "influencer_values_read", label: "Ver valores dos influenciadores" },
      { key: "influencers_invite", label: "Convidar influenciadores" },
      { key: "influencers_approve", label: "Aprovar influenciadores" },
      { key: "influencers_reject", label: "Rejeitar influenciadores" },
    ],
  },
  {
    label: "Roteiros",
    hint: "Escrever, aprovar e rejeitar",
    items: [
      { key: "scripts_read", label: "Ver roteiros" },
      { key: "scripts_write", label: "Escrever roteiros" },
      { key: "scripts_approve", label: "Aprovar roteiros" },
      { key: "scripts_reject", label: "Rejeitar roteiros" },
    ],
  },
  {
    label: "Conteúdo",
    hint: "Enviar, aprovar e rejeitar",
    items: [
      { key: "content_read", label: "Ver conteúdo" },
      { key: "content_write", label: "Enviar conteúdo" },
      { key: "content_approve", label: "Aprovar conteúdo" },
      { key: "content_reject", label: "Rejeitar conteúdo" },
    ],
  },
  {
    label: "Contratos",
    hint: "Ver e gerenciar contratos",
    items: [
      { key: "contracts_read", label: "Ver contratos" },
      { key: "contracts_write", label: "Gerenciar contratos" },
    ],
  },
  {
    label: "Financeiro",
    hint: "Saldo, pagamentos e relatórios",
    items: [
      { key: "financial_read", label: "Ver financeiro" },
      { key: "financial_balance_add", label: "Adicionar saldo" },
      { key: "financial_payments_approve", label: "Aprovar pagamentos" },
      { key: "financial_reports_export", label: "Exportar relatórios" },
    ],
  },
];

/** Grupos liberados por padrão em cada papel (índices de PERMISSION_GROUPS). */
export const ROLE_GROUPS: Record<AssignableRole, number[]> = {
  admin: [0, 1, 2, 3, 4, 5, 6, 7],
  member: [2, 3, 4, 5],
  aprovador: [3, 4, 5],
  observador: [0],
  juridico: [5, 6],
  financeiro: [7],
  analista: [2, 3, 7],
};

export const groupKeys = (i: number) => PERMISSION_GROUPS[i].items.map((x) => x.key);

export const roleDefaultPerms = (r: AssignableRole): string[] =>
  ROLE_GROUPS[r].flatMap(groupKeys);

export const groupOn = (value: string[], i: number) =>
  groupKeys(i).every((k) => value.includes(k));

export const groupAny = (value: string[], i: number) =>
  groupKeys(i).some((k) => value.includes(k));

export function toggleGroup(value: string[], i: number): string[] {
  const keys = groupKeys(i);
  if (groupOn(value, i)) return value.filter((k) => !keys.includes(k));
  return [...value, ...keys.filter((k) => !value.includes(k))];
}

export const countGroups = (value: string[]) =>
  PERMISSION_GROUPS.filter((_, i) => groupAny(value, i)).length;

export function maskCnpj(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCep(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

export function apiErr(e: unknown): string {
  if (e instanceof Error) {
    const st = (e as { status?: number }).status;
    if (st === 409) {
      const msg = e.message.toLowerCase();
      if (msg.includes("membro") || msg.includes("workspace") || msg.includes("already")) {
        return "Este e-mail já faz parte deste workspace.";
      }
      return e.message || "Conflito: e-mail já em uso.";
    }
    if (st === 400 && e.message.toLowerCase().includes("name")) {
      return 'Este e-mail não tem cadastro no backoffice. Use "Criar usuário" para criar uma conta com nome e e-mail.';
    }
    return e.message;
  }
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.filter(Boolean).join(", ");
  }
  return "Não foi possível concluir a ação.";
}

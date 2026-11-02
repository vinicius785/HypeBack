/**
 * Leitura humana de `before_state`, `after_state` e `impact` do log de alterações administrativas.
 *
 * O contrato tipa os três como `unknown`: podem ser objeto raso (`{ status: 'active' }`), objeto aninhado
 * (o resumo de impacto inteiro), lista, texto, número ou `null`. Nada daqui lança: a tela nunca mostra JSON cru
 * nem quebra por causa de um formato novo. Chaves viram rótulos em português, dinheiro (`*_cents`) sai exato,
 * estados e papéis saem pelo vocabulário do Admin, datas pelo fuso de São Paulo.
 */
import { formatBRLFromCents, formatCivilDate, formatDateTime, formatInt } from "@/lib/admin/format";
import { USER_STATUS_LABEL, WORKSPACE_ROLE_LABEL, WORKSPACE_STATUS_LABEL } from "@/lib/admin/labels";

export interface AuditDiffRow {
  /** Caminho do campo (`address.city`); chave estável. */
  key: string;
  label: string;
  before: string;
  after: string;
}

export interface AuditFactRow {
  key: string;
  label: string;
  value: string;
}

/** Texto de um valor ausente. */
export const AUDIT_EMPTY = "—";

const MAX_DEPTH = 4;
const MAX_ROWS = 60;
const MAX_TEXT = 160;

const FIELD_LABEL: Record<string, string> = {
  // cadastro do workspace
  status: "Status",
  status_reason: "Motivo do status",
  name: "Nome",
  description: "Descrição",
  legal_name: "Razão social",
  tax_id: "CNPJ",
  postal_code: "CEP",
  street: "Rua",
  street_number: "Número",
  unit: "Complemento",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "Estado",
  address: "Endereço",
  // acesso
  role: "Papel",
  email: "E-mail",
  sessions_active: "Sessões ativas",
  merged_user_id: "Usuário mesclado (id)",
  survivor_user_id: "Usuário mantido (id)",
  // resumo de impacto
  workspace: "Workspace",
  computed_at: "Calculado em",
  counts: "Contagens",
  money: "Valores",
  members: "Membros",
  campaigns_total: "Campanhas",
  campaigns_draft: "Campanhas em rascunho",
  campaigns_published: "Campanhas publicadas",
  campaigns_finished: "Campanhas finalizadas",
  participations: "Participações",
  creators: "Criadores",
  contracts: "Contratos",
  charges_total: "Cobranças",
  charges_pending: "Cobranças pendentes",
  withdrawals_in_flight: "Saques em andamento",
  ledger_entries: "Lançamentos por status",
  reserved: "Reservado",
  pending_release: "Em carência",
  available: "Disponível para saque",
  withdrawn: "Sacado",
  cancelled: "Cancelado",
  custody_cents: "Em custódia",
  committed_cents: "Comprometido",
  funded_total_cents: "Aportes totais",
  pending_charges_cents: "Cobranças pendentes (valor)",
  reserved_entries_cents: "Reservas em aberto",
  released_not_withdrawn_cents: "Liberado e ainda não sacado",
  withdrawals_in_flight_cents: "Saques em andamento (valor)",
  blockers: "Impedimentos",
  warnings: "Avisos",
  consequences: "Consequências",
  can: "Permitido",
};

/** `some_key_name` → "Some key name": plano B para chave que o vocabulário não conhece. */
export function humanizeKey(key: string): string {
  const text = key.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : key;
}

function labelOfPath(path: readonly string[]): string {
  if (path.length === 0) return "Valor";
  return path.map((segment) => FIELD_LABEL[segment] ?? humanizeKey(segment)).join(" › ");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clip(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

function safeJson(value: unknown): string {
  try {
    return clip(JSON.stringify(value) ?? String(value));
  } catch {
    return AUDIT_EMPTY;
  }
}

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID_KEY = /(^|_)id$/;

function formatScalar(key: string, value: unknown): string {
  if (value === null || value === undefined) return AUDIT_EMPTY;
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return AUDIT_EMPTY;
    if (key.endsWith("_cents")) return formatBRLFromCents(value);
    // Identificador não leva separador de milhar ("12.345" leria como número formatado).
    if (ID_KEY.test(key)) return String(value);
    return Number.isInteger(value) ? formatInt(value) : String(value);
  }
  if (typeof value === "string") {
    if (value === "") return "(vazio)";
    if (ISO_DATETIME.test(value)) return formatDateTime(value);
    if (CIVIL_DATE.test(value)) return formatCivilDate(value);
    if (key === "status" || key.endsWith("_status")) {
      const known = (WORKSPACE_STATUS_LABEL as Record<string, string>)[value] ?? (USER_STATUS_LABEL as Record<string, string>)[value];
      if (known) return known;
    }
    if (key === "role" || key.endsWith("_role")) {
      const known = (WORKSPACE_ROLE_LABEL as Record<string, string>)[value];
      if (known) return known;
    }
    return clip(value);
  }
  return safeJson(value);
}

/** Lista curta e legível: "Nenhum", itens simples separados por vírgula, objetos pela frase que carregam. */
function formatList(key: string, list: readonly unknown[]): string {
  if (list.length === 0) return "Nenhum";
  const parts = list.map((item) => {
    if (isPlainObject(item)) {
      const phrase = item.message ?? item.label ?? item.name ?? item.title;
      return typeof phrase === "string" ? phrase : safeJson(item);
    }
    return formatScalar(key, item);
  });
  return clip(parts.join(list.some(isPlainObject) ? "; " : ", "));
}

interface FlatEntry {
  path: string[];
  value: unknown;
}

/** Objeto aninhado → pares `caminho → valor` (listas e profundidade além do limite ficam como um valor só). */
function flatten(value: unknown): Map<string, FlatEntry> {
  const out = new Map<string, FlatEntry>();
  const walk = (current: unknown, path: string[], depth: number) => {
    if (out.size >= MAX_ROWS * 2) return;
    if (isPlainObject(current) && depth < MAX_DEPTH) {
      const entries = Object.entries(current);
      // `{}` não tem campos: não vira linha nenhuma.
      for (const [key, child] of entries) walk(child, [...path, key], depth + 1);
      return;
    }
    // Raiz vazia (`null`, `undefined`): não há campo nenhum para mostrar.
    if ((current === undefined || current === null) && path.length === 0) return;
    out.set(path.join("."), { path, value: current });
  };
  walk(value, [], 0);
  return out;
}

function formatEntry(entry: FlatEntry): string {
  const key = entry.path[entry.path.length - 1] ?? "";
  if (Array.isArray(entry.value)) return formatList(key, entry.value);
  if (isPlainObject(entry.value)) return safeJson(entry.value);
  return formatScalar(key, entry.value);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Só o que mudou, campo a campo (`antes → depois`). Campo que existe só de um lado aparece com "—" do outro;
 * campo igual nos dois lados não aparece. Sem nada diferente, a lista é vazia.
 */
export function buildAuditDiff(before: unknown, after: unknown): AuditDiffRow[] {
  const left = flatten(before);
  const right = flatten(after);
  const keys = [...new Set([...left.keys(), ...right.keys()])];
  const rows: AuditDiffRow[] = [];
  for (const key of keys) {
    const b = left.get(key);
    const a = right.get(key);
    // Ausente e `null` são a mesma coisa para quem lê: nada mudou.
    if (sameValue(b?.value ?? null, a?.value ?? null)) continue;
    rows.push({
      key: key || "value",
      label: labelOfPath((b ?? a)?.path ?? []),
      before: b ? formatEntry(b) : AUDIT_EMPTY,
      after: a ? formatEntry(a) : AUDIT_EMPTY,
    });
    if (rows.length >= MAX_ROWS) break;
  }
  return rows;
}

/** Resumo de impacto (e qualquer objeto) como pares rótulo/valor, na ordem em que o servidor mandou. */
export function buildAuditFacts(state: unknown): AuditFactRow[] {
  const rows: AuditFactRow[] = [];
  for (const [key, entry] of flatten(state)) {
    rows.push({ key: key || "value", label: labelOfPath(entry.path), value: formatEntry(entry) });
    if (rows.length >= MAX_ROWS) break;
  }
  return rows;
}

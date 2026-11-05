/** Suporte (Admin): pedidos de ajuda da plataforma, do app e do site. Contrato: `hypeapi-suporte/docs/support-spec.md`. */

export const SUPPORT_SOURCES = ["platform", "app", "site"] as const;
export type SupportSource = (typeof SUPPORT_SOURCES)[number];
export const SUPPORT_STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
export const SUPPORT_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];
export const SUPPORT_CATEGORIES = ["account", "billing", "campaign", "creator", "bug", "feature", "other"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type SupportAuthorType = "requester" | "staff" | "note";

export const SUPPORT_SOURCE_LABEL: Record<SupportSource, string> = { platform: "Plataforma", app: "App", site: "Site" };
export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  waiting: "Aguardando cliente",
  resolved: "Resolvido",
  closed: "Fechado",
};
export const SUPPORT_PRIORITY_LABEL: Record<SupportPriority, string> = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };
export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  account: "Conta",
  billing: "Financeiro",
  campaign: "Campanha",
  creator: "Criadores",
  bug: "Erro",
  feature: "Sugestão",
  other: "Outro",
};

export interface SupportTicket {
  id: string;
  number: number;
  source: SupportSource;
  status: SupportStatus;
  priority: SupportPriority;
  category: SupportCategory;
  subject: string;
  preview: string;
  requester: { user_id: number | null; name: string; email: string | null; phone: string | null };
  workspace: { id: string; name: string; photo: string | null } | null;
  context: { page_url?: string; app_version?: string; platform?: string; device?: string; user_agent?: string } | null;
  assignee: { id: number; name: string; avatar: string | null } | null;
  messages_count: number;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface SupportMessage {
  id: string;
  author_type: SupportAuthorType;
  author: { id: number | null; name: string; avatar: string | null };
  body: string;
  created_at: string;
}

export interface SupportTicketDetail extends SupportTicket {
  messages: SupportMessage[];
}

export interface SupportCounts {
  by_status: Record<SupportStatus, number>;
  by_source: Record<SupportSource, number>;
  unassigned: number;
  mine: number;
}

export type SupportStatusFilter = "active" | "resolved_all" | "all" | SupportStatus;

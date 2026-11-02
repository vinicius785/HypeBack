/** Respostas de exemplo tipadas pelo contrato (`admin-platform.types.ts`) para os testes das Atividades. */
import type { AdminActivityEvent, AdminAuditLogEntry } from "@/shared/admin-platform.types";

export const WORKSPACE_ID = "7a1e0000-0000-4000-8000-000000000002";
export const CAMPAIGN_ID = "ca3b0000-0000-4000-8000-000000000006";

export function makeEvent(overrides: Partial<AdminActivityEvent> = {}): AdminActivityEvent {
  return {
    id: "workspace:7a1e0000-0000-4000-8000-000000000002",
    occurred_at: "2026-10-30T15:00:00.000Z",
    kind: "workspace_created",
    source: "derived",
    title: "Workspace Café Serra Verde criado",
    actor: null,
    workspace: { id: WORKSPACE_ID, name: "Café Serra Verde" },
    target: { type: "workspace", id: WORKSPACE_ID, label: "Café Serra Verde" },
    reason: null,
    ...overrides,
  };
}

export const CAMPAIGN_EVENT = makeEvent({
  id: `campaign:${CAMPAIGN_ID}`,
  occurred_at: "2026-10-30T12:00:00.000Z",
  kind: "campaign_created",
  title: "Campanha Festival de Outono criada",
  target: { type: "campaign", id: CAMPAIGN_ID, label: "Festival de Outono" },
});

export const ADMIN_EVENT = makeEvent({
  id: "action:41",
  occurred_at: "2026-10-29T18:20:00.000Z",
  kind: "admin_action",
  source: "platform_admin_action_log",
  title: "Workspace suspenso pelo time da plataforma",
  actor: { user_id: 7, name: "Marina Admin" },
  reason: "Cobrança contestada, aguardando análise",
});

export function makeAuditEntry(overrides: Partial<AdminAuditLogEntry> = {}): AdminAuditLogEntry {
  return {
    id: 41,
    created_at: "2026-10-29T18:20:00.000Z",
    action: "workspace.suspend",
    action_label: "Workspace suspenso",
    actor: { user_id: 7, name: "Marina Admin", email: "marina@hype.test", role: "admin" },
    target: { type: "workspace", id: WORKSPACE_ID, label: "Café Serra Verde" },
    workspace: { id: WORKSPACE_ID, name: "Café Serra Verde" },
    reason: "Cobrança contestada, aguardando análise",
    before_state: { status: "active" },
    after_state: { status: "suspended" },
    impact: null,
    ip: "203.0.113.9",
    ...overrides,
  };
}

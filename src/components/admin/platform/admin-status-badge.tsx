import type { ReactNode } from "react";

import {
  ALERT_KIND_LABEL,
  ALERT_SEVERITY_LABEL,
  CAMPAIGN_STATUS_LABEL,
  CREATOR_REGISTRATION_LABEL,
  NOTIFICATION_STATUS_LABEL,
  NOTIFICATION_STATUS_TONE,
  USER_STATUS_LABEL,
  WORKSPACE_ACTIVITY_LABEL,
  WORKSPACE_KIND_LABEL,
  WORKSPACE_STATUS_LABEL,
  workspaceActivityDescription,
} from "@/lib/admin/labels";
import type {
  AdminAlertKind,
  AdminAlertSeverity,
  AdminCampaignStatus,
  AdminCreatorRegistrationState,
  AdminUserAccountStatus,
  AdminWorkspaceActivity,
  AdminWorkspaceKind,
  AdminWorkspaceStatus,
} from "@/shared/admin-platform.types";
import type { AdminNotificationStatus } from "@/shared/types";

import "@/styles/admin-platform.css";

/**
 * Cor da etiqueta (todas chapadas, com um ponto da própria cor):
 * ok verde · warn âmbar · bad vermelho (só erro/excluído) · brand roxo (acento) · muted cinza · outline só contorno ·
 * neutral cinza claro com texto preto.
 */
export type AdminBadgeTone = "neutral" | "ok" | "warn" | "bad" | "brand" | "muted" | "outline";

interface AdminBadgeProps {
  tone?: AdminBadgeTone;
  size?: "md" | "sm";
  title?: string;
  children: ReactNode;
}

/** Etiqueta genérica: use `AdminStatusBadge` quando o valor vem do vocabulário do contrato. */
export function AdminBadge({ tone = "neutral", size = "md", title, children }: AdminBadgeProps) {
  return (
    <span
      className="adm-badge"
      data-tone={tone === "neutral" ? undefined : tone}
      data-size={size === "sm" ? "sm" : undefined}
      title={title}
    >
      {children}
    </span>
  );
}

const WORKSPACE_TONE: Record<AdminWorkspaceStatus, AdminBadgeTone> = {
  active: "ok",
  suspended: "warn",
  archived: "muted",
  deleted: "bad",
};

const USER_TONE: Record<AdminUserAccountStatus, AdminBadgeTone> = {
  active: "ok",
  suspended: "warn",
  deleted: "bad",
  // "em cadastro": ainda não tem acesso, nem é problema (cinza)
  pending: "muted",
};

const CAMPAIGN_TONE: Record<AdminCampaignStatus, AdminBadgeTone> = {
  draft: "muted",
  published: "brand",
  finished: "neutral",
};

const SEVERITY_TONE: Record<AdminAlertSeverity, AdminBadgeTone> = {
  critical: "bad",
  warning: "warn",
  info: "neutral",
};

const ACTIVITY_TONE: Record<AdminWorkspaceActivity["state"], AdminBadgeTone> = {
  active: "ok",
  inactive: "muted",
  never: "muted",
};

const REGISTRATION_TONE: Record<AdminCreatorRegistrationState, AdminBadgeTone> = {
  complete: "ok",
  incomplete: "warn",
  stub: "muted",
};

const WORKSPACE_KIND_TONE: Record<AdminWorkspaceKind, AdminBadgeTone> = {
  brand: "neutral",
  creator_personal: "muted",
  orphan: "warn",
};

type AdminStatusBadgeProps = (
  | { kind: "workspace"; value: AdminWorkspaceStatus }
  | { kind: "user"; value: AdminUserAccountStatus }
  | { kind: "campaign"; value: AdminCampaignStatus }
  | { kind: "severity"; value: AdminAlertSeverity }
  /** Atividade real do workspace (não é o status do ciclo de vida). `windowDays` entra na dica. */
  | { kind: "activity"; value: AdminWorkspaceActivity["state"]; windowDays?: number }
  | { kind: "registration"; value: AdminCreatorRegistrationState }
  | { kind: "alert-kind"; value: AdminAlertKind }
  | { kind: "workspace-kind"; value: AdminWorkspaceKind }
  /** Status de um comunicado: rascunho, agendada, enviando, enviada, entrega parcial, falhou, cancelada. */
  | { kind: "notification"; value: AdminNotificationStatus }
) & {
  size?: "md" | "sm";
  /** Troca o texto padrão do vocabulário. */
  label?: string;
  title?: string;
};

interface Resolved {
  tone: AdminBadgeTone;
  label: string;
  title?: string;
}

function resolve(props: AdminStatusBadgeProps): Resolved {
  // Um valor novo do backend (fora da união conhecida) não pode quebrar a tela: cai em cinza com o texto cru.
  const raw = String(props.value);
  switch (props.kind) {
    case "workspace":
      return { tone: WORKSPACE_TONE[props.value] ?? "muted", label: WORKSPACE_STATUS_LABEL[props.value] ?? raw };
    case "user":
      return { tone: USER_TONE[props.value] ?? "muted", label: USER_STATUS_LABEL[props.value] ?? raw };
    case "campaign":
      return { tone: CAMPAIGN_TONE[props.value] ?? "muted", label: CAMPAIGN_STATUS_LABEL[props.value] ?? raw };
    case "severity":
      return { tone: SEVERITY_TONE[props.value] ?? "muted", label: ALERT_SEVERITY_LABEL[props.value] ?? raw };
    case "activity":
      return {
        tone: ACTIVITY_TONE[props.value] ?? "muted",
        label: WORKSPACE_ACTIVITY_LABEL[props.value] ?? raw,
        title: props.windowDays ? workspaceActivityDescription(props.value, props.windowDays) : undefined,
      };
    case "registration":
      return { tone: REGISTRATION_TONE[props.value] ?? "muted", label: CREATOR_REGISTRATION_LABEL[props.value] ?? raw };
    case "alert-kind":
      return { tone: "outline", label: ALERT_KIND_LABEL[props.value] ?? raw };
    case "workspace-kind":
      return { tone: WORKSPACE_KIND_TONE[props.value] ?? "muted", label: WORKSPACE_KIND_LABEL[props.value] ?? raw };
    case "notification":
      return { tone: NOTIFICATION_STATUS_TONE[props.value] ?? "muted", label: NOTIFICATION_STATUS_LABEL[props.value] ?? raw };
  }
}

/** Etiqueta de estado do vocabulário do contrato (workspace, usuário, campanha, alerta, atividade, cadastro, comunicado). */
export function AdminStatusBadge(props: AdminStatusBadgeProps) {
  const resolved = resolve(props);
  return (
    <AdminBadge tone={resolved.tone} size={props.size} title={props.title ?? resolved.title}>
      {props.label ?? resolved.label}
    </AdminBadge>
  );
}

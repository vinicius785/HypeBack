import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AdminConfirmDialog, type AdminConfirmValues } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { WorkspaceBlockers } from "@/components/admin/workspaces/workspace-impact";
import { adminKeys } from "@/hooks/admin/admin-query-keys";
import { useAdminCapabilities } from "@/hooks/admin/use-admin-team";
import { ADMIN_USERS_RESOURCE } from "@/hooks/admin/use-admin-users";
import { useAdminUserAction, type AdminUserActionName } from "@/hooks/admin/use-admin-users-actions";
import { getDeleteBlockers } from "@/lib/admin/admin-errors";
import { formatInt } from "@/lib/admin/format";
import type { AdminDeleteBlocker, AdminUserDetail } from "@/shared/admin-platform.types";

import { describeUserActionError, userActionErrorOutdatesScreen } from "./admin-user-errors";
import { sessionClientText } from "./admin-users-format";

import "@/styles/admin-users.css";

/** Por que a conta não aceita ação alguma (a tela explica em vez de oferecer um botão que o servidor recusaria). */
export type UserActionBlockedReason = "self" | "platform_admin" | "deleted" | "read_only";

export interface UserActionAvailability {
  suspend: boolean;
  reactivate: boolean;
  revokeSessions: boolean;
  /** Excluir (anonimizar) a conta: sem volta, só para administrador. */
  delete: boolean;
  blockedReason: UserActionBlockedReason | null;
}

/** O que o papel de quem está logado permite (`users.moderate` e a exclusão, que é só do administrador). */
export interface UserActionPermissions {
  moderate: boolean;
  delete: boolean;
}

const ALL_PERMISSIONS: UserActionPermissions = { moderate: true, delete: true };

/**
 * Quais ações a conta aceita, pelas mesmas regras que o servidor aplica (`CANNOT_ACT_ON_SELF`,
 * `CANNOT_ACT_ON_PLATFORM_ADMIN`, `INVALID_STATE_TRANSITION`). O contrato não traz um `can` para usuários,
 * então a tela deduz do que sabe; se a dedução ficar velha, o servidor recusa e o diálogo traduz o erro.
 * Encerrar sessões só aparece com sessão aberta: sem nenhuma, não há o que encerrar.
 */
export function userActionAvailability(
  user: AdminUserDetail,
  selfId: number | undefined,
  permissions: UserActionPermissions = ALL_PERMISSIONS,
): UserActionAvailability {
  const none = { suspend: false, reactivate: false, revokeSessions: false, delete: false };
  if (selfId !== undefined && selfId === user.id) return { ...none, blockedReason: "self" };
  if (user.is_platform_admin) return { ...none, blockedReason: "platform_admin" };
  if (user.status === "deleted") return { ...none, blockedReason: "deleted" };
  // Papel só de leitura: nenhum botão, e a tela explica por quê (em vez de esconder sem dizer nada).
  if (!permissions.moderate && !permissions.delete) return { ...none, blockedReason: "read_only" };
  return {
    suspend: permissions.moderate && user.status === "active",
    reactivate: permissions.moderate && user.status === "suspended",
    revokeSessions: permissions.moderate && user.sessions.active_count > 0,
    delete: permissions.delete,
    blockedReason: null,
  };
}

const BLOCKED_TEXT: Record<UserActionBlockedReason, string> = {
  self: "Esta é a sua conta: por segurança, você não pode suspendê-la nem encerrar as suas sessões por aqui.",
  platform_admin:
    "Esta pessoa é administradora da plataforma: o servidor não permite suspender a conta nem encerrar as sessões de outro administrador.",
  deleted: "Conta excluída: não há ações disponíveis.",
  read_only: "O seu papel na equipe só permite ver esta conta, sem executar ações.",
};

interface ActionCopy {
  title: (user: AdminUserDetail) => string;
  description: string;
  consequences: (user: AdminUserDetail) => ReactNode[];
  tone: "danger" | "neutral";
  confirm: string;
  pending: string;
  success: string;
}

/** "A sessão aberta deixa de funcionar" / "As 3 sessões abertas deixam de funcionar" (concordância com a contagem). */
function sessionsStop(count: number): string {
  return count === 1
    ? "A sessão aberta deixa de funcionar: na próxima ação a pessoa é desconectada."
    : `As ${formatInt(count)} sessões abertas deixam de funcionar: na próxima ação a pessoa é desconectada.`;
}

/** "A sessão aberta (App (celular)) será encerrada agora." / "As 2 sessões abertas serão encerradas agora." */
function sessionsEnd(user: AdminUserDetail): string {
  const count = user.sessions.active_count;
  const clients = user.sessions.clients.map(sessionClientText);
  const where = clients.length > 0 ? ` — ${clients.join(" e ")} —` : "";
  return count === 1
    ? `A sessão aberta${where} será encerrada agora.`
    : `As ${formatInt(count)} sessões abertas${where} serão encerradas agora.`;
}

const AUDIT_LINE = "A ação fica registrada no histórico da conta, com o seu nome e o motivo.";

const ACTION_COPY: Record<AdminUserActionName, ActionCopy> = {
  suspend: {
    title: (user) => `Suspender ${user.name}`,
    description: "A conta fica bloqueada até que alguém a reative.",
    consequences: (user) => [
      `${user.name} não consegue mais entrar na plataforma, em nenhum workspace.`,
      user.sessions.active_count > 0 ? sessionsStop(user.sessions.active_count) : "Não há sessão aberta agora.",
      "Nada é apagado: os dados e os vínculos com workspaces continuam como estão.",
      "Você pode reativar a conta depois.",
      AUDIT_LINE,
    ],
    tone: "danger",
    confirm: "Suspender conta",
    pending: "Suspendendo…",
    success: "Conta suspensa.",
  },
  reactivate: {
    title: (user) => `Reativar ${user.name}`,
    description: "A conta volta a ter acesso à plataforma.",
    consequences: (user) => [
      `${user.name} volta a poder entrar com o e-mail e a senha de sempre.`,
      "As sessões encerradas na suspensão não voltam: a pessoa precisa entrar de novo.",
      AUDIT_LINE,
    ],
    tone: "neutral",
    confirm: "Reativar conta",
    pending: "Reativando…",
    success: "Conta reativada.",
  },
  "revoke-sessions": {
    title: (user) => `Encerrar sessões de ${user.name}`,
    description: "A pessoa é desconectada de todos os aparelhos e navegadores onde está logada.",
    consequences: (user) => [
      sessionsEnd(user),
      "A conta continua ativa: a pessoa pode entrar de novo quando quiser.",
      AUDIT_LINE,
    ],
    tone: "neutral",
    confirm: "Encerrar todas as sessões",
    pending: "Encerrando…",
    success: "Sessões encerradas.",
  },
  delete: {
    title: (user) => `Excluir a conta de ${user.name}`,
    description: "Esta ação é permanente e não pode ser desfeita.",
    consequences: (user) => [
      "Nome, e-mail, telefone, documento, foto e endereços são apagados, e a conta nunca mais consegue entrar.",
      user.sessions.active_count > 0
        ? sessionsEnd(user)
        : "Não há sessão aberta agora.",
      "A pessoa sai de todos os workspaces em que está.",
      "Campanhas e registros financeiros continuam no histórico, sem os dados pessoais (LGPD).",
      "Se a ideia é só bloquear o acesso por um tempo, use Suspender: ela pode ser reativada.",
      "A ação fica registrada na trilha de auditoria, com o seu nome e o motivo. O registro não guarda o nome nem o e-mail da conta.",
    ],
    tone: "danger",
    confirm: "Excluir conta para sempre",
    pending: "Excluindo…",
    success: "Conta excluída.",
  },
};

function AdminUserActionDialog({
  user,
  action,
  onClose,
}: {
  user: AdminUserDetail;
  action: AdminUserActionName;
  onClose: () => void;
}) {
  const copy = ACTION_COPY[action];
  const queryClient = useQueryClient();
  const mutation = useAdminUserAction(user.id, action);
  const [error, setError] = useState<string | null>(null);
  // Impedimentos da exclusão (saldo, saque pendente, único proprietário): o servidor é quem decide, a tela lista.
  const [blockers, setBlockers] = useState<AdminDeleteBlocker[]>([]);

  const confirm = ({ reason, confirmText }: AdminConfirmValues) => {
    setError(null);
    setBlockers([]);
    mutation.mutate(
      action === "delete" ? { reason, confirm_email: confirmText.trim() } : { reason },
      {
        onSuccess: () => {
          toast.success(copy.success);
          onClose();
        },
        onError: (failure) => {
          setError(describeUserActionError(failure, action));
          setBlockers(getDeleteBlockers(failure));
          // O estado da tela ficou velho (outra pessoa agiu antes): mostra o de agora por baixo do diálogo.
          if (userActionErrorOutdatesScreen(failure)) {
            void queryClient.invalidateQueries({ queryKey: adminKeys.detail(ADMIN_USERS_RESOURCE, user.id) });
          }
        },
      },
    );
  };

  return (
    <AdminConfirmDialog
      open
      eyebrow={`Usuário · ${user.email}`}
      title={copy.title(user)}
      description={copy.description}
      consequences={copy.consequences(user)}
      tone={copy.tone}
      confirmLabel={copy.confirm}
      pendingLabel={copy.pending}
      pending={mutation.isPending}
      error={error}
      typedConfirmation={
        action === "delete"
          ? {
              expected: user.email,
              label: (
                <>
                  Para confirmar, digite o e-mail da conta: <b>{user.email}</b>
                </>
              ),
              hint: "Sem diferenciar maiúsculas e minúsculas.",
            }
          : undefined
      }
      onConfirm={confirm}
      onClose={onClose}
    >
      {blockers.length > 0 ? <WorkspaceBlockers blockers={blockers} /> : null}
    </AdminConfirmDialog>
  );
}

/**
 * As ações do cabeçalho do usuário: Suspender / Reativar, Encerrar sessões e Excluir conta, cada uma com o seu diálogo de
 * confirmação (motivo de 5 a 500 caracteres, consequências e erro do servidor traduzido). Conta que não aceita
 * ação (a própria, outro administrador da plataforma, excluída) mostra só uma explicação discreta.
 */
export function AdminUserActions({ user, selfId }: { user: AdminUserDetail; selfId: number | undefined }) {
  const [dialog, setDialog] = useState<AdminUserActionName | null>(null);
  const capabilities = useAdminCapabilities();
  // Enquanto o papel não chegou, nenhum botão aparece (evita mostrar um botão que o servidor vai recusar).
  const availability = userActionAvailability(
    user,
    selfId,
    capabilities.loading
      ? { moderate: false, delete: false }
      : { moderate: capabilities.can("users.moderate"), delete: capabilities.isAdmin },
  );

  return (
    <>
      {availability.revokeSessions ? (
        <button type="button" className="btn out" onClick={() => setDialog("revoke-sessions")}>
          Encerrar sessões
        </button>
      ) : null}
      {availability.suspend ? (
        <button type="button" className="btn adm-btn-danger-out" onClick={() => setDialog("suspend")}>
          Suspender
        </button>
      ) : null}
      {availability.reactivate ? (
        <button type="button" className="btn" onClick={() => setDialog("reactivate")}>
          Reativar
        </button>
      ) : null}
      {availability.delete ? (
        <button type="button" className="btn adm-btn-danger-out" onClick={() => setDialog("delete")}>
          <I n="trash" cls="sm" /> Excluir conta
        </button>
      ) : null}
      {availability.blockedReason && !capabilities.loading ? (
        <p className="adm-users-note">
          <I n="lock" cls="sm" />
          <span>{BLOCKED_TEXT[availability.blockedReason]}</span>
        </p>
      ) : null}
      {dialog ? <AdminUserActionDialog user={user} action={dialog} onClose={() => setDialog(null)} /> : null}
    </>
  );
}

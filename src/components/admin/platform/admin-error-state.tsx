import { I } from "@/components/prototype/ui";
import { isAdminApiError } from "@/lib/admin/admin-client";
import { describeAdminError } from "@/lib/admin/admin-errors";

import "@/styles/admin-platform.css";

interface AdminErrorStateProps {
  /** Erro da consulta (`AdminApiError` ou qualquer outro). O texto sai de `describeAdminError`. */
  error?: unknown;
  /** Sobrescreve o título/mensagem derivados do erro. */
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
  /** Sobre o fundo cinza da página (fora de um cartão): vira um cartão branco. */
  boxed?: boolean;
}

function titleFor(error: unknown): string {
  if (isAdminApiError(error, "ENDPOINT_UNAVAILABLE")) return "Recurso indisponível";
  if (isAdminApiError(error, "FORBIDDEN")) return "Sem permissão";
  if (isAdminApiError(error, "NETWORK_ERROR")) return "Sem conexão";
  if (isAdminApiError(error, "NOT_FOUND")) return "Não encontrado";
  return "Não foi possível carregar";
}

/** Falha de consulta, com o motivo em português e o botão de tentar de novo. */
export function AdminErrorState({ error, title, message, onRetry, retrying, compact, boxed }: AdminErrorStateProps) {
  const cls = ["adm-state", "adm-state-error", compact ? "adm-state-compact" : "", boxed ? "adm-state-boxed" : ""]
    .filter(Boolean)
    .join(" ");
  // Registro inexistente e falta de permissão não mudam ao repetir: o botão só aparece quando adianta (a rota
  // que o servidor ainda não tem pode aparecer em instantes, com o deploy).
  const retryable = !isAdminApiError(error, "NOT_FOUND") && !isAdminApiError(error, "FORBIDDEN");
  return (
    <div className={cls} role="alert">
      <I n="alert" />
      <b>{title ?? titleFor(error)}</b>
      <p>{message ?? describeAdminError(error)}</p>
      {onRetry && retryable ? (
        <div className="adm-state-action">
          <button type="button" className="btn out adm-btn-sm" disabled={retrying} onClick={onRetry}>
            <I n="refresh" cls="sm" />
            {retrying ? "Tentando…" : "Tentar de novo"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

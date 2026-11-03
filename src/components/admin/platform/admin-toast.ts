/**
 * Avisos passageiros do Admin (sucesso, erro, atenção, informação) sobre o `sonner` que o app já usa (o `Toaster` mora
 * em `src/screens/__root.tsx`). Uma voz só: durações padronizadas, o mesmo texto limpo e um `id` opcional
 * para o mesmo aviso não empilhar.
 *
 * Aviso é para o que a pessoa não precisa decidir agora. Erro que pede correção (campo, motivo) fica dentro
 * do diálogo/formulário; erro de carregar uma tela é `AdminErrorState`.
 */
import { toast } from "sonner";

import { translateValidationMessage } from "@/components/admin/users/admin-user-errors";
import { AdminApiError } from "@/lib/admin/admin-client";

/** Quanto cada aviso fica na tela (ms): sucesso é rápido de ler; erro fica mais, e mais ainda com "Tentar de novo". */
export const ADMIN_TOAST_DURATION = {
  success: 3500,
  info: 5000,
  /** Entre a informação e o erro: pede atenção, mas não é falha. */
  warning: 6500,
  error: 8000,
  errorWithRetry: 12000,
} as const;

export interface AdminToastOptions {
  /**
   * Identidade do aviso. Com o mesmo `id`, um aviso novo **substitui** o que está na tela em vez de empilhar
   * (ex.: `id: "save-group"` num botão que a pessoa clica várias vezes).
   */
  id?: string | number;
  /** Troca a duração padrão (ms). */
  duration?: number;
}

export interface AdminErrorToastOptions extends AdminToastOptions {
  /** Mostra o botão "Tentar de novo" no aviso; ele chama isto (e o aviso se fecha). */
  retry?: () => void;
  /** Texto do botão de tentar de novo. */
  retryLabel?: string;
}

const GENERIC_ERROR = "Não foi possível concluir a operação.";

/**
 * Texto de aviso limpo: sem espaços sobrando e sem pontuação final repetida (`Falhou..` vira `Falhou.`;
 * três pontos ou mais viram reticências). Não tira o ponto final de uma frase: só não o duplica.
 */
export function normalizeToastText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.{3,}$/, "…")
    .replace(/\.{2}$/, ".")
    .replace(/([!?])\1+$/, "$1");
}

/** Só as opções que vieram preenchidas, para o `sonner` não receber `id: undefined`. */
function baseOptions(options: AdminToastOptions | undefined, defaultDuration: number) {
  return {
    ...(options?.id !== undefined ? { id: options.id } : {}),
    duration: options?.duration ?? defaultDuration,
  };
}

export const adminToast = {
  /** Ação concluída. `adminToast.success("Grupo salvo")` */
  success(message: string, options?: AdminToastOptions): string | number {
    return toast.success(normalizeToastText(message), baseOptions(options, ADMIN_TOAST_DURATION.success));
  },

  /** Ação que falhou. `adminToast.error(adminErrorMessage(err, "Não foi possível salvar"), { retry: save })` */
  error(message: string, options?: AdminErrorToastOptions): string | number {
    const retry = options?.retry;
    return toast.error(normalizeToastText(message), {
      ...baseOptions(options, retry ? ADMIN_TOAST_DURATION.errorWithRetry : ADMIN_TOAST_DURATION.error),
      ...(retry ? { action: { label: options?.retryLabel ?? "Tentar de novo", onClick: () => retry() } } : {}),
    });
  },

  /** Informação neutra. `adminToast.info("Nada mudou")` */
  info(message: string, options?: AdminToastOptions): string | number {
    return toast.info(normalizeToastText(message), baseOptions(options, ADMIN_TOAST_DURATION.info));
  },

  /** Atenção, sem ser falha (algo concluiu pela metade, um limite perto). `adminToast.warning("3 de 5 enviados")` */
  warning(message: string, options?: AdminToastOptions): string | number {
    return toast.warning(normalizeToastText(message), baseOptions(options, ADMIN_TOAST_DURATION.warning));
  },

  /** Fecha um aviso pelo `id` (ou todos, sem `id`). */
  dismiss(id?: string | number): void {
    toast.dismiss(id);
  },
};

// ---------------------------------------------------------------------------
// Texto de erro
// ---------------------------------------------------------------------------

/** Texto que é código ou mensagem de biblioteca, não frase para a pessoa. */
function looksTechnical(text: string): boolean {
  return (
    /^[A-Z][A-Z0-9_]+$/.test(text) || // código de domínio (WORKSPACE_SUSPENDED)
    /^(Bad Request|Unauthorized|Forbidden|Not Found|Conflict|Unprocessable Entity|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)$/i.test(
      text,
    ) ||
    /^Request failed\b/i.test(text) ||
    /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \//i.test(text) ||
    /^(Failed to fetch|Load failed|NetworkError|Network request failed)/i.test(text)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Uma frase para cada mensagem, cada uma terminando em ponto, sem repetir. */
function joinSentences(messages: readonly string[]): string {
  const sentences = messages.map((m) => m.trim()).filter(Boolean).map((m) => (/[.!?…]$/.test(m) ? m : `${m}.`));
  return [...new Set(sentences)].join(" ");
}

/**
 * Texto útil de um erro de chamada à API, para o aviso (ou para o `error` de um diálogo):
 * - `AdminApiError`: o texto em português que o cliente já montou; quando o backend devolve uma lista de
 *   validação (400/422), uma frase para cada item, traduzida quando o texto é conhecido;
 * - erro da API do app (`Error` com `status`, de `buildApiError`): o `message` do servidor, exceto 5xx;
 * - `string`: ela mesma;
 * - qualquer outra coisa (`TypeError: Failed to fetch`, erro de programação, `undefined`) e todo texto que é
 *   código ou mensagem técnica: `fallback`. Erro técnico cru nunca chega à tela.
 */
export function adminErrorMessage(error: unknown, fallback: string = GENERIC_ERROR): string {
  const useful = (text: unknown): string | null => {
    if (typeof text !== "string") return null;
    const clean = normalizeToastText(text);
    return clean && !looksTechnical(clean) ? clean : null;
  };

  let message: string | null = null;

  if (error instanceof AdminApiError) {
    // Também com uma só mensagem: "reason must be longer than…" (inglês do DTO) precisa da tradução.
    if (error.code === "BAD_REQUEST" || error.code === "UNPROCESSABLE") {
      message = useful(joinSentences(error.messages.map(translateValidationMessage)));
    }
    message ??= useful(error.message);
  } else if (typeof error === "string") {
    message = useful(error);
  } else if (error instanceof Error || isRecord(error)) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && status < 500) message = useful((error as { message?: unknown }).message);
  }

  return message ?? normalizeToastText(fallback);
}

/**
 * Impedimentos da exclusão de workspace (`409 WORKSPACE_DELETE_BLOCKED`, `details.blockers`), em pt-BR claro
 * para o diálogo de exclusão. Valores sempre exatos (centavos inteiros) pelo formatador do Admin.
 */
import { formatBRLFromCents, formatInt } from "@/lib/admin/format";
import type { AdminDeleteBlocker } from "@/shared/admin-platform.types";

import { isRecord, readWorkspaceStateError } from "./lifecycle-errors";

/** Mesmo formato do contrato, com `code` aberto: um código novo do servidor ainda aparece (pelo `message`). */
export type DeleteBlocker = Omit<AdminDeleteBlocker, "code"> & { code: string };

const GENERIC_BLOCKER = "Há um impedimento que precisa ser resolvido antes.";

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * `null` quando o erro não é WORKSPACE_DELETE_BLOCKED (a tela trata como erro comum); lista vazia quando é, mas
 * o servidor não mandou os impedimentos (ou vieram fora do formato): o diálogo ainda explica o bloqueio.
 */
export function getDeleteBlockers(error: unknown): DeleteBlocker[] | null {
  const state = readWorkspaceStateError(error);
  if (state === null || state.code !== "WORKSPACE_DELETE_BLOCKED") return null;
  const raw = isRecord(state.details) ? state.details.blockers : undefined;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): DeleteBlocker[] => {
    if (!isRecord(entry) || typeof entry.code !== "string" || entry.code === "") return [];
    const count = finite(entry.count);
    const amount = finite(entry.amount_cents);
    return [
      {
        code: entry.code,
        message: typeof entry.message === "string" ? entry.message : "",
        ...(count !== undefined ? { count } : {}),
        ...(amount !== undefined ? { amount_cents: amount } : {}),
      },
    ];
  });
}

function plural(count: number, one: string, many: string): string {
  return `${formatInt(count)} ${count === 1 ? one : many}`;
}

/** Uma frase por impedimento. Sem os números que a frase pede, vale o texto do servidor. */
export function describeDeleteBlocker(blocker: DeleteBlocker): string {
  const money = blocker.amount_cents !== undefined ? formatBRLFromCents(blocker.amount_cents) : null;
  const count = blocker.count;
  switch (blocker.code) {
    case "HAS_CUSTODY_BALANCE":
      if (money) return `Há ${money} de saldo no workspace.`;
      break;
    case "HAS_COMMITTED_FUNDS":
      if (money) return `Há ${money} reservados para criadores.`;
      if (count !== undefined) return `Há ${plural(count, "reserva de criador em aberto", "reservas de criadores em aberto")}.`;
      break;
    case "HAS_PENDING_CHARGES":
      if (count !== undefined) {
        return `Há ${plural(count, "cobrança PIX aguardando pagamento", "cobranças PIX aguardando pagamento")}${money ? ` (${money})` : ""}.`;
      }
      break;
    case "HAS_WITHDRAWALS_IN_FLIGHT":
      if (count !== undefined) {
        return `Há ${plural(count, "saque de criador em andamento", "saques de criadores em andamento")}${money ? ` (${money})` : ""}.`;
      }
      break;
    case "HAS_PUBLISHED_CAMPAIGNS":
      if (count !== undefined) return `Há ${plural(count, "campanha publicada", "campanhas publicadas")}.`;
      break;
    default:
      break;
  }
  return blocker.message.trim() !== "" ? blocker.message.trim() : GENERIC_BLOCKER;
}

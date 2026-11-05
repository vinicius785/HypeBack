import type { AdminBadgeTone } from "@/components/admin/platform";
import { ACCOUNT_REQUEST_STATUS_LABEL, ACCOUNT_TYPE_LABEL, type AccountTypeRequest, type AccountTypeRequestStatus } from "@/shared/services/account-type-requests";

export const STATUS_TONE: Record<AccountTypeRequestStatus, AdminBadgeTone> = {
  pending: "warn",
  approved: "ok",
  rejected: "bad",
};

export const statusLabel = (status: AccountTypeRequestStatus) => ACCOUNT_REQUEST_STATUS_LABEL[status];

/** "Marca → Agência". */
export const transitionLabel = (r: Pick<AccountTypeRequest, "current_type" | "requested_type">) =>
  `${ACCOUNT_TYPE_LABEL[r.current_type]} → ${ACCOUNT_TYPE_LABEL[r.requested_type]}`;

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

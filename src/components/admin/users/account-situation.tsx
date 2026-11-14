import { AdminBadge, type AdminBadgeTone } from "@/components/admin/platform";
import type { AdminAccountSituation, AdminUserAccountStatus } from "@/shared/admin-platform.types";

/** O que a equipe pode escolher no menu: Ativa e Suspensa. Em análise e Reprovada seguem sendo mostradas se a API as informar. */
export const ACCOUNT_SITUATIONS: readonly AdminAccountSituation[] = ["active", "suspended"];

export const ACCOUNT_SITUATION_LABEL: Record<AdminAccountSituation, string> = {
  active: "Ativa",
  under_review: "Em análise",
  rejected: "Reprovada",
  suspended: "Suspensa",
};

export const ACCOUNT_SITUATION_TONE: Record<AdminAccountSituation, AdminBadgeTone> = {
  active: "ok",
  under_review: "warn",
  rejected: "bad",
  suspended: "bad",
};

/** O que o criador sente ao ficar em cada situação (uma frase para o diálogo de confirmação). */
export const ACCOUNT_SITUATION_EFFECT: Record<Exclude<AdminAccountSituation, "active">, string> = {
  under_review: "A conta fica em análise: o criador perde o acesso ao app, mas pode contestar pelo suporte.",
  rejected: "A conta é reprovada: o criador perde o acesso ao app, mas pode contestar pelo suporte.",
  suspended: "A conta é suspensa: o criador perde o acesso ao app, mas pode contestar pelo suporte.",
};

export const ACCOUNT_REASON_MAX = 500;

/** Situação a mostrar: a que a API informa, ou deduzida do estado antigo (suspensa ou ativa). */
export function situationOf(user: { status: AdminUserAccountStatus; account_status?: AdminAccountSituation }): AdminAccountSituation | null {
  if (user.account_status) return user.account_status;
  if (user.status === "suspended") return "suspended";
  if (user.status === "active") return "active";
  return null;
}

export function AccountSituationBadge({ value, size }: { value: AdminAccountSituation; size?: "md" | "sm" }) {
  return (
    <AdminBadge tone={ACCOUNT_SITUATION_TONE[value]} size={size}>
      {ACCOUNT_SITUATION_LABEL[value]}
    </AdminBadge>
  );
}

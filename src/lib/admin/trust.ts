/**
 * Nível de confiança da conta (1 a 5) no Admin: textos e regras de exibição. É uma ESTIMATIVA por sinais que ajuda a
 * equipe a priorizar o que olhar: nada aqui suspende, bloqueia ou decide por conta própria.
 */
import type { AdminUserTrust, AdminUserTrustLevel, AdminUserTrustReason } from "@/shared/admin-platform.types";

export const TRUST_LEVEL_TEXT: Record<AdminUserTrustLevel, string> = {
  1: "muito provável bot",
  2: "suspeito",
  3: "incerto",
  4: "provável pessoa real",
  5: "perfil real",
};

/** Aviso fixo que acompanha o nível (ele é uma estimativa, não uma prova). */
export const TRUST_DISCLAIMER = "Estimativa automática por sinais. Serve para priorizar a análise e não suspende a conta.";

/** Nome do filtro local da lista (vale só para as linhas da página carregada, e o nome já diz isso). */
export const TRUST_FILTER_LABEL = "Confiança 1–2 (só nesta página)";

/** Quantos motivos cabem na dica da lista; o resto vira "+N". */
export const TRUST_TIP_MAX_REASONS = 6;

/** Nível "suspeito" do filtro local: 1 e 2. */
export const TRUST_SUSPECT_MAX_LEVEL: AdminUserTrustLevel = 2;

/** `trust` utilizável (nível de 1 a 5); qualquer outra coisa vira `null` e a tela mostra "—". */
export function usableTrust(trust: AdminUserTrust | null | undefined): AdminUserTrust | null {
  if (!trust || !Number.isInteger(trust.level) || trust.level < 1 || trust.level > 5) return null;
  return { ...trust, reasons: Array.isArray(trust.reasons) ? trust.reasons : [] };
}

/** "Confiança 1 de 5: muito provável bot" (texto de leitor de tela do selo). */
export function trustAriaLabel(level: AdminUserTrustLevel): string {
  return `Confiança ${level} de 5: ${TRUST_LEVEL_TEXT[level]}`;
}

/** "+15" / "−45" (com o sinal de menos de verdade) / "0". */
export function formatTrustPoints(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return "0";
}

/** Os primeiros motivos (já vêm do maior peso para o menor) e quantos ficaram de fora. */
export function splitTrustReasons(
  reasons: readonly AdminUserTrustReason[],
  max: number = TRUST_TIP_MAX_REASONS,
): { shown: AdminUserTrustReason[]; hidden: number } {
  return { shown: reasons.slice(0, max), hidden: Math.max(0, reasons.length - max) };
}

/** A conta é "suspeita" (nível 1 ou 2)? Sem `trust` não é. */
export function isSuspectTrust(trust: AdminUserTrust | null | undefined): boolean {
  const usable = usableTrust(trust);
  return usable !== null && usable.level <= TRUST_SUSPECT_MAX_LEVEL;
}

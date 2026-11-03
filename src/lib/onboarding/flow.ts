/**
 * Fluxo da "Configuração da conta" (`/onboarding`): quais etapas existem, em qual a pessoa está e quando uma conta
 * deve ser levada para lá.
 */
import type { User } from "@/shared/types";
import { isPlatformStaff } from "@/lib/utils/platform-admin";

/**
 * Confirmação do telefone por código no WhatsApp (as etapas "Telefone" e "Confirmação").
 *
 * DESLIGADA por padrão: a Hype está sem número para enviar os códigos (a API responde 503 "envio indisponível") e,
 * como a API só grava o telefone depois do código, nenhuma conta nova passava do primeiro passo. Para religar
 * quando houver número, defina `VITE_PHONE_VERIFICATION=on` no build (ver `.env.example` e `docs/DEPLOY.md`).
 */
export function isPhoneVerificationOn(): boolean {
  return import.meta.env.VITE_PHONE_VERIFICATION === "on";
}

export type OnboardingStepId = "phone" | "code" | "brand" | "company";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  hint: string;
}

const STEP_TEXT: Record<OnboardingStepId, Omit<OnboardingStep, "id">> = {
  phone: { title: "Telefone", hint: "Um número para falarmos com você" },
  code: { title: "Confirmação", hint: "O código que enviamos por WhatsApp" },
  brand: { title: "Sua marca", hint: "Nome, nicho e logo" },
  company: { title: "Dados da empresa", hint: "Razão social, CNPJ e endereço" },
};

/** Etapas na ordem em que aparecem. Sem a confirmação do telefone, só restam as duas da marca. */
export function onboardingSteps(phoneVerification: boolean = isPhoneVerificationOn()): OnboardingStep[] {
  const ids: OnboardingStepId[] = phoneVerification ? ["phone", "code", "brand", "company"] : ["brand", "company"];
  return ids.map((id) => ({ id, ...STEP_TEXT[id] }));
}

/** `?etapa=empresa` na tela da marca: a segunda metade da criação (dados da empresa) tem URL própria. */
export const COMPANY_STEP_SEARCH = { etapa: "empresa" } as const;

/** Etapa que a URL mostra; `"done"` na tela de boas-vindas e `null` fora do fluxo. */
export function currentOnboardingStep(
  pathname: string,
  search: { etapa?: unknown } = {},
): OnboardingStepId | "done" | null {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/onboarding") return "phone";
  if (path === "/onboarding/verify-phone") return "code";
  if (path === "/onboarding/create-workspace") return search.etapa === COMPANY_STEP_SEARCH.etapa ? "company" : "brand";
  if (path === "/onboarding/welcome") return "done";
  return null;
}

export type StepStatus = "done" | "current" | "upcoming";

/** Situação de cada etapa da lista. Fora do fluxo (ou numa etapa que a lista não tem), nenhuma está concluída. */
export function stepStatuses(steps: readonly OnboardingStep[], current: OnboardingStepId | "done" | null): StepStatus[] {
  if (current === "done") return steps.map(() => "done");
  const at = steps.findIndex((step) => step.id === current);
  return steps.map((_, i) => (at < 0 ? "upcoming" : i < at ? "done" : i === at ? "current" : "upcoming"));
}

type OnboardingTarget = "/onboarding" | "/onboarding/create-workspace";

/**
 * Sem a confirmação do telefone, "conta nova" é quem não tem telefone, não é da equipe da plataforma e ainda não tem
 * marca: só nesse caso a lista de marcas precisa ser consultada antes de decidir (ver `onboardingRedirectFor`).
 */
export function needsWorkspaceCheck(
  user: User | null | undefined,
  phoneVerification: boolean = isPhoneVerificationOn(),
): boolean {
  return !phoneVerification && !!user && !user.phone && !isPlatformStaff(user);
}

/**
 * Para onde levar a conta que acabou de abrir uma tela do app (ou `null` para deixar onde está).
 * - Confirmação ligada: quem não tem telefone confirmado vai para o primeiro passo (como sempre foi).
 * - Desligada: é o papel do passo do telefone que muda. Conta nova, sem marca, vai direto criar a marca; quem já
 *   tem marca (ou é da equipe da plataforma) entra no app normalmente. `workspaceCount` é `undefined` enquanto a
 *   lista de marcas não chegou: nada acontece até lá, para uma falha da API não mandar ninguém para a criação.
 */
export function onboardingRedirectFor(input: {
  user: User | null | undefined;
  workspaceCount: number | undefined;
  pathname: string;
  phoneVerification?: boolean;
}): OnboardingTarget | null {
  const { user, workspaceCount, pathname, phoneVerification = isPhoneVerificationOn() } = input;
  if (!user || user.phone || pathname.startsWith("/onboarding")) return null;
  if (phoneVerification) return "/onboarding";
  if (!needsWorkspaceCheck(user, false)) return null;
  return workspaceCount === 0 ? "/onboarding/create-workspace" : null;
}

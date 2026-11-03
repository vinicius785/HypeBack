/**
 * Fluxo da "Configuração da conta" (`/onboarding`): quais etapas existem, em qual a pessoa está e quando uma conta
 * deve ser levada para lá. São dois grupos: o perfil da pessoa (todo mundo que cria conta) e a criação de uma marca
 * (só quem quer criar uma; quem vai entrar numa marca que outra pessoa criou não precisa).
 */
import type { User } from "@/shared/types";
import { isPlatformStaff } from "@/lib/utils/platform-admin";

/**
 * Confirmação do telefone por código no WhatsApp (a etapa "Confirmação", depois do perfil).
 *
 * DESLIGADA por padrão: a Hype está sem número para enviar os códigos (a API responde 503 "envio indisponível") e,
 * como a API só grava o telefone confirmado depois do código, nenhuma conta nova passava do primeiro passo.
 * Desligada, o telefone do perfil é opcional e fica sem confirmar. Para religar quando houver número, defina `VITE_PHONE_VERIFICATION=on` no build (ver `.env.example` e `docs/DEPLOY.md`).
 */
export function isPhoneVerificationOn(): boolean {
  return import.meta.env.VITE_PHONE_VERIFICATION === "on";
}

export type OnboardingStepId = "profile" | "code" | "brand" | "company";
export type OnboardingGroup = "profile" | "brand";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  hint: string;
}

const STEP_TEXT: Record<OnboardingStepId, Omit<OnboardingStep, "id">> = {
  profile: { title: "Seu perfil", hint: "Nome, nascimento e contato" },
  code: { title: "Confirmação", hint: "O código que enviamos por WhatsApp" },
  brand: { title: "Sua marca", hint: "Nome, nicho e logo" },
  company: { title: "Dados da empresa", hint: "Razão social, CNPJ e endereço" },
};

/** `/onboarding` e a confirmação são do perfil; criar marca (e as boas-vindas) são do grupo da marca. */
export function onboardingGroup(pathname: string): OnboardingGroup {
  const path = pathname.replace(/\/+$/, "");
  return path === "/onboarding" || path === "/onboarding/verify-phone" ? "profile" : "brand";
}

/** Etapas do grupo, na ordem. O perfil tem uma só (duas com a confirmação do telefone ligada). */
export function onboardingSteps(
  group: OnboardingGroup,
  phoneVerification: boolean = isPhoneVerificationOn(),
): OnboardingStep[] {
  const ids: OnboardingStepId[] =
    group === "brand" ? ["brand", "company"] : phoneVerification ? ["profile", "code"] : ["profile"];
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
  if (path === "/onboarding") return "profile";
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

/** Perfil preenchido: tem telefone, ou a data de nascimento (que o formulário do perfil sempre pede). */
export function hasProfile(user: User | null | undefined): boolean {
  return !!user && (!!user.phone || !!user.birth_date);
}

/**
 * Sem a confirmação do telefone, "conta nova" é quem ainda não preencheu o perfil, não é da equipe da plataforma e
 * ainda não tem marca: só nesse caso a lista de marcas precisa ser consultada antes de decidir.
 */
export function needsWorkspaceCheck(
  user: User | null | undefined,
  phoneVerification: boolean = isPhoneVerificationOn(),
): boolean {
  return !phoneVerification && !!user && !hasProfile(user) && !isPlatformStaff(user);
}

/**
 * Para onde levar a conta que acabou de abrir uma tela do app (`"/onboarding"`, o perfil) ou `null` para deixar onde
 * está.
 * - Confirmação ligada: quem não tem telefone confirmado vai para o perfil (como sempre foi).
 * - Desligada: só conta nova, sem marca. Quem já tem marca (ou é da equipe da plataforma) entra no app normalmente.
 *   `workspaceCount` é `undefined` enquanto a lista de marcas não chegou: nada acontece até lá, para uma falha da
 *   API não mandar ninguém para o perfil.
 * Depois do perfil a pessoa escolhe, já dentro do app, entre criar uma marca e entrar numa que outra pessoa criou.
 */
export function onboardingRedirectFor(input: {
  user: User | null | undefined;
  workspaceCount: number | undefined;
  pathname: string;
  phoneVerification?: boolean;
}): "/onboarding" | null {
  const { user, workspaceCount, pathname, phoneVerification = isPhoneVerificationOn() } = input;
  if (!user || pathname.startsWith("/onboarding")) return null;
  if (phoneVerification) return user.phone ? null : "/onboarding";
  if (!needsWorkspaceCheck(user, false)) return null;
  return workspaceCount === 0 ? "/onboarding" : null;
}

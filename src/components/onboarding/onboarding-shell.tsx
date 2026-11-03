import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import { stepStatuses, type OnboardingStep, type OnboardingStepId } from "@/lib/onboarding/flow";
import { supportMailto, SUPPORT_EMAIL } from "@/lib/workspace-state/support-contact";
import type { User } from "@/shared/types";

import { Icon } from "@/components/ui/icon";
import { UserAvatar } from "@/components/ui/user-avatar";

import hypeappLogo from "@/assets/images/hypeapp-logo-branca.svg";

import "@/styles/onboarding.css";

const COUNT_WORDS: Record<number, string> = { 1: "um", 2: "dois", 3: "três", 4: "quatro" };

export interface OnboardingShellProps {
  steps: readonly OnboardingStep[];
  current: OnboardingStepId | "done" | null;
  user: Pick<User, "name" | "email" | "avatar"> | null;
  /** Já tem marca: mostra o caminho de volta ao painel (quem abre "Nova marca" não fica preso na configuração). */
  canLeave: boolean;
  onLogout: () => void;
  isLoggingOut: boolean;
  children: ReactNode;
}

/**
 * Moldura da Configuração da conta: etapas numa faixa escura (no celular, um topo compacto com barrinhas) e o
 * formulário da etapa num cartão branco. As telas só cuidam do próprio conteúdo.
 */
export function OnboardingShell({ steps, current, user, canLeave, onLogout, isLoggingOut, children }: OnboardingShellProps) {
  const statuses = stepStatuses(steps, current);
  const done = current === "done";
  const count = COUNT_WORDS[steps.length] ?? String(steps.length);

  // Na tela de boas-vindas o botão "Começar agora" já leva ao painel: o atalho ali só duplicaria.
  const leaveLink = canLeave && !done && (
    <Link
      to="/"
      className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <Icon name="ArrowLeft" size={16} color="currentColor" />
      Voltar ao painel
    </Link>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={onLogout}
      disabled={isLoggingOut}
      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white/10 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icon name="LogOut" size={16} color="currentColor" />
      {isLoggingOut ? "Saindo..." : "Sair"}
    </button>
  );

  const help = (linkClass: string) => (
    <>
      Precisa de ajuda?{" "}
      <a
        href={supportMailto("Ajuda com a configuração da conta")}
        className={`font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 ${linkClass}`}
      >
        {SUPPORT_EMAIL}
      </a>
    </>
  );

  return (
    <div className="ob grid min-h-dvh grid-cols-1 gap-3 bg-canvas p-3 lg:h-dvh lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-4 lg:overflow-hidden lg:p-4">
      {/* Celular e tablet: topo compacto, com as barrinhas de progresso logo abaixo. */}
      <div className="flex flex-col gap-3 lg:hidden">
        <header className="flex items-center justify-between gap-3 rounded-[24px] bg-neutral-950 p-3 pl-5">
          <img src={hypeappLogo} alt="HypeApp" className="h-7 w-auto" />
          <div className="flex items-center gap-1">
            {leaveLink}
            {logoutButton}
          </div>
        </header>
        <div aria-hidden className="flex gap-2 px-1">
          {statuses.map((status, i) => (
            <span key={steps[i].id} className="ob-seg" data-status={status} />
          ))}
        </div>
      </div>

      <aside
        aria-label="Etapas da configuração"
        className="hidden min-h-0 flex-col gap-9 overflow-y-auto rounded-[32px] bg-neutral-950 p-7 text-white shadow-[0_18px_30px_-14px_rgba(5,5,5,0.5)] lg:flex"
      >
        <img src={hypeappLogo} alt="HypeApp" className="h-9 w-auto self-start" />

        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/60">Configuração da conta</p>
          <p className="mt-3 text-[28px] font-semibold leading-[1.08] tracking-[-0.04em]">
            {done ? "Tudo pronto por aqui" : `Sua marca no Hype em ${count} passos`}
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-white/60">
            {done
              ? "Sua conta está configurada. Agora é só começar."
              : "Depois disso, é só criar a primeira campanha e encontrar os criadores certos."}
          </p>
        </div>

        <ol className="ob-steps" aria-label="Etapas">
          {steps.map((step, i) => {
            const status = statuses[i];
            return (
              <li key={step.id} className="ob-step" data-status={status} aria-current={status === "current" ? "step" : undefined}>
                <span className="ob-step-dot" aria-hidden>
                  {status === "done" ? <Icon name="Check" size={18} color="currentColor" /> : i + 1}
                </span>
                <span>
                  <span className="ob-step-title">{step.title}</span>
                  <span className="ob-step-hint">{step.hint}</span>
                  {status === "done" && <span className="sr-only"> (concluída)</span>}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-auto flex flex-col gap-2">
          {user && (
            <div className="mb-1 flex items-center gap-3 rounded-full bg-white/8 p-2 pr-5">
              <UserAvatar name={user.name} src={user.avatar} className="size-10 rounded-full" />
              <div className="min-w-0 leading-tight">
                <b className="block truncate text-[14px] font-semibold">{user.name}</b>
                <small className="block truncate text-[12px] text-white/60">{user.email}</small>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1">
            {logoutButton}
            {leaveLink}
          </div>
          <p className="mt-2 px-2 text-[12.5px] leading-relaxed text-white/55">
            {help("text-white/80 focus-visible:outline-white")}
          </p>
        </div>
      </aside>

      <main className="flex min-h-0 flex-col items-center overflow-y-auto px-0 py-2 lg:px-6 lg:py-8">
        <div className="ob-card m-auto">{children}</div>

        {/* No desktop a ajuda fica na faixa de etapas. */}
        <p className="mt-6 shrink-0 pb-2 text-center text-[12.5px] text-neutral-500 lg:hidden">
          {help("text-neutral-700 focus-visible:outline-neutral-950")}
        </p>
      </main>
    </div>
  );
}

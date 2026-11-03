import type { ReactNode } from "react";

import { useLocation } from "@tanstack/react-router";

import { currentOnboardingStep, onboardingGroup, onboardingSteps } from "@/lib/onboarding/flow";

/** Em que posição da lista de etapas a URL está (`index` -1 fora do fluxo ou na tela de boas-vindas). */
export function useOnboardingProgress() {
  const { pathname, search } = useLocation();
  const steps = onboardingSteps(onboardingGroup(pathname));
  const current = currentOnboardingStep(pathname, search as { etapa?: unknown });
  return { index: steps.findIndex((step) => step.id === current), total: steps.length };
}

/** Topo de cada tela da configuração: "Etapa 2 de 2", título e uma linha de explicação. */
export function OnboardingHeader({ title, description }: { title: string; description?: ReactNode }) {
  const { index, total } = useOnboardingProgress();

  return (
    <header className="flex flex-col gap-2.5">
      {index >= 0 && total > 1 && (
        <p className="ob-eyebrow">
          Etapa {index + 1} de {total}
        </p>
      )}
      <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.04em] text-neutral-950">{title}</h1>
      {description && <p className="text-[15px] leading-relaxed text-neutral-500">{description}</p>}
    </header>
  );
}

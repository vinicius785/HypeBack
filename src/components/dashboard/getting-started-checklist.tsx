import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import { useWorkspaceBalance } from "@/hooks/use-balance";

/**
 * "Primeiros passos com o Hype App" — checklist de onboarding no topo do
 * Dashboard. Some permanentemente quando o usuário completa os 3 passos pela
 * primeira vez (flag `completedAt` persistida por workspace).
 *
 * Conclusão é MONOTÔNICA: uma vez observado concluído, o passo permanece
 * concluído mesmo que o estado regrida (ex.: saldo volta a 0 após gastar) —
 * é isso que garante o "sumir quando completar pela primeira vez".
 *
 *  1. Criar campanha   → detectado por existir ≥1 campanha (prop).
 *  2. Adicionar saldo  → detectado por saldo > 0 (qualquer bucket).
 *  3. Explorar criadores → ação local: marcado ao clicar no passo.
 */

const STORAGE_VERSION = "v1";

interface OnboardingState {
  campaign: boolean;
  balance: boolean;
  explored: boolean;
  /** ISO da conclusão dos 3 passos — quando presente, o widget some p/ sempre. */
  completedAt?: string;
}

const EMPTY_STATE: OnboardingState = {
  campaign: false,
  balance: false,
  explored: false,
};

function storageKey(workspaceId: string): string {
  return `hypeapp:onboarding:${STORAGE_VERSION}:${workspaceId}`;
}

function loadState(workspaceId: string): OnboardingState {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<OnboardingState> | null;
    if (parsed && typeof parsed === "object") {
      return {
        campaign: !!parsed.campaign,
        balance: !!parsed.balance,
        explored: !!parsed.explored,
        completedAt:
          typeof parsed.completedAt === "string" ? parsed.completedAt : undefined,
      };
    }
  } catch {
    // localStorage indisponível / JSON inválido — começa do zero.
  }
  return EMPTY_STATE;
}

function saveState(workspaceId: string, state: OnboardingState): void {
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(state));
  } catch {
    // sem efeito colateral se o storage falhar
  }
}

interface GettingStartedChecklistProps {
  workspaceId: string;
  /** Existe ≥1 campanha no workspace. */
  campaignCreated: boolean;
}

export function GettingStartedChecklist({
  workspaceId,
  campaignCreated,
}: GettingStartedChecklistProps) {
  const navigate = useNavigate();
  const balanceQ = useWorkspaceBalance();
  const b = balanceQ.data;
  const balanceAdded =
    !!b &&
    ((b.balance_cents ?? 0) > 0 ||
      (b.available_cents ?? 0) > 0 ||
      (b.committed_cents ?? 0) > 0);

  const [state, setState] = useState<OnboardingState>(() =>
    workspaceId ? loadState(workspaceId) : EMPTY_STATE,
  );

  // Recarrega o estado ao trocar de workspace (cada um tem seu onboarding).
  useEffect(() => {
    setState(workspaceId ? loadState(workspaceId) : EMPTY_STATE);
  }, [workspaceId]);

  // Funde sinais ao vivo (campanha/saldo) no estado persistido, de forma
  // monotônica, e carimba `completedAt` quando os 3 ficam prontos.
  useEffect(() => {
    if (!workspaceId) return;
    setState((prev) => {
      if (prev.completedAt) return prev;
      const campaign = prev.campaign || campaignCreated;
      const balance = prev.balance || balanceAdded;
      const explored = prev.explored;
      const allDone = campaign && balance && explored;
      if (
        campaign === prev.campaign &&
        balance === prev.balance &&
        !allDone
      ) {
        return prev; // nada mudou
      }
      const next: OnboardingState = {
        campaign,
        balance,
        explored,
        completedAt: allDone ? new Date().toISOString() : prev.completedAt,
      };
      saveState(workspaceId, next);
      return next;
    });
  }, [workspaceId, campaignCreated, balanceAdded]);

  const handleExplore = () => {
    if (!workspaceId) return;
    setState((prev) => {
      if (prev.explored) return prev;
      const campaign = prev.campaign || campaignCreated;
      const balance = prev.balance || balanceAdded;
      const allDone = campaign && balance; // explored vira true agora
      const next: OnboardingState = {
        campaign,
        balance,
        explored: true,
        completedAt: allDone ? new Date().toISOString() : prev.completedAt,
      };
      saveState(workspaceId, next);
      return next;
    });
  };

  // Sinais exibidos (monotônicos com o estado persistido).
  const done = {
    campaign: state.campaign || campaignCreated,
    balance: state.balance || balanceAdded,
    explored: state.explored,
  };
  const completedCount = Number(done.campaign) + Number(done.balance) + Number(done.explored);
  const allDone = completedCount === 3;

  // Some quando já concluído alguma vez (persistido) ou quando os 3 estão prontos.
  if (!workspaceId || state.completedAt || allDone) {
    return null;
  }

  const steps: Array<[string, string, boolean, () => void]> = [
    ["Criar campanha", "Defina briefing, prazos e orçamento", done.campaign, () => navigate({ to: "/campaigns/new" })],
    ["Adicionar saldo", "Via PIX, para pagar os criadores", done.balance, () => navigate({ to: "/financial" })],
    [
      "Explorar criadores",
      "Encontre perfis para convidar",
      done.explored,
      () => {
        handleExplore();
        navigate({ to: "/creators" });
      },
    ],
  ];
  const currentIdx = steps.findIndex((st) => !st[2]);

  return (
    <section className="ckx fade" aria-label="Primeiros passos com o Hype App">
      <div className="ckx-h">
        <span className="ckx-i">
          <I n="sparkles" />
        </span>
        <div>
          <h3>Primeiros passos</h3>
          <p>Complete {3 - completedCount === 1 ? "o último passo" : `os ${3 - completedCount} passos que faltam`} para lançar a sua primeira campanha.</p>
        </div>
        <div className="ckx-p" aria-label={`${completedCount} de 3 passos concluídos`}>
          <b>
            {completedCount}
            <small>/3</small>
          </b>
          <div className="ckx-bar">
            {steps.map(([label, , ok]) => (
              <i key={label} className={ok ? "on" : ""} />
            ))}
          </div>
        </div>
      </div>
      <div className="ckx-s">
        {steps.map(([label, hint, ok, run], k) => (
          <button
            key={label}
            type="button"
            className={`ckx-st ${ok ? "done" : k === currentIdx ? "cur" : ""}`}
            onClick={run}
          >
            <span className="ckx-n">{ok ? <I n="check" cls="sm" /> : k + 1}</span>
            <span className="ckx-t">
              <b>{label}</b>
              <small>{hint}</small>
            </span>
            <I n="chev" cls="sm" />
          </button>
        ))}
      </div>
    </section>
  );
}

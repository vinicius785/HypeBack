import type { ReactNode } from "react";

import type { Tone } from "./project-ui";

import "@/styles/agency-projects.css";

/** Selo pequeno em um dos tons de `project-ui.ts` (status do projeto e da tarefa, saúde, prioridade). */
export function ToneBadge({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`apj-badge apj-tone-${tone}`} title={title}>
      {children}
    </span>
  );
}

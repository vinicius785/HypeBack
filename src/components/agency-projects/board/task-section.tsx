import { useId, type ReactNode } from "react";

/** Bloco do modal da tarefa (Subtarefas, Anexos, Comentários, Atividade): título, contador e conteúdo. */
export function TaskSection({ title, count, children }: { title: string; count?: number | string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="apj-tm-sec" aria-labelledby={id}>
      <h3>
        <span id={id}>{title}</span>
        {count !== undefined ? <em>{count}</em> : null}
      </h3>
      {children}
    </section>
  );
}

/** Esqueleto de um bloco que ainda espera o detalhe da tarefa. */
export function SectionSkeleton({ label }: { label: string }) {
  return <span className="apj-sk apj-tm-sk" aria-busy="true" aria-label={label} />;
}

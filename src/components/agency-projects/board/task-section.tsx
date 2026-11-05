import { useId, useState, type ReactNode } from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

/** Bloco do modal da tarefa (Subtarefas, Anexos, Comentários, Atividade): seta que recolhe, título, contador e, à direita, a ação. */
export function TaskSection({
  title,
  count,
  action,
  collapsible = false,
  children,
}: {
  title: string;
  count?: number | string;
  action?: ReactNode;
  collapsible?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(true);
  return (
    <section className="apj-tm-sec" aria-labelledby={id}>
      <div className="apj-tm-sech">
        {collapsible ? (
          <button type="button" className="apj-tm-fold" aria-expanded={open} aria-label={`${open ? "Recolher" : "Expandir"} ${title}`} onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown className="ico sm" aria-hidden /> : <ChevronRight className="ico sm" aria-hidden />}
          </button>
        ) : null}
        <h3>
          <span id={id}>{title}</span>
          {count !== undefined ? <em>{count}</em> : null}
        </h3>
        {action ? <div className="apj-tm-seca">{action}</div> : null}
      </div>
      {open ? children : null}
    </section>
  );
}

/** Esqueleto de um bloco que ainda espera o detalhe da tarefa. */
export function SectionSkeleton({ label }: { label: string }) {
  return <span className="apj-sk apj-tm-sk" aria-busy="true" aria-label={label} />;
}

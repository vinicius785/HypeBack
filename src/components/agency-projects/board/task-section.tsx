import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/** Aberta por padrão só quando há o que mostrar; o clique da pessoa vale mais que o padrão. */
export function useSectionOpen(auto: boolean): [boolean, (open: boolean) => void] {
  const [manual, setManual] = useState<boolean | null>(null);
  return [manual ?? auto, setManual];
}

/** Bloco do modal da tarefa (Subtarefas, Anexos, Comentários, Atividade): seta que recolhe, ícone, título, contador e, à direita, a ação. */
export function TaskSection({
  title,
  count,
  icon,
  action,
  open: controlled,
  onOpenChange,
  children,
}: {
  title: string;
  count?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  /** Sem isto o bloco não recolhe (comentários e atividade). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const id = useId();
  const [local, setLocal] = useState(true);
  const collapsible = onOpenChange !== undefined;
  const open = collapsible ? (controlled ?? local) : true;
  return (
    <section className="apj-tm-sec" aria-labelledby={id}>
      <div className="apj-tm-sech">
        {collapsible ? (
          <button
            type="button"
            className="apj-tm-fold"
            aria-expanded={open}
            aria-label={`${open ? "Recolher" : "Expandir"} ${title}`}
            onClick={() => {
              setLocal(!open);
              onOpenChange(!open);
            }}
          >
            {open ? <ChevronDown className="ico sm" aria-hidden /> : <ChevronRight className="ico sm" aria-hidden />}
          </button>
        ) : null}
        {icon ? <span className="apj-tm-sico">{icon}</span> : null}
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

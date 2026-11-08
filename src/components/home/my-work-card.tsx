import { useRef, useState, type Ref } from "react";

import { getUploadUrl } from "@/lib/utils/api";

import { I } from "@/components/prototype/ui";
import { taskDueLabel } from "@/components/agency-projects/task-ui";
import type { MyTask } from "@/hooks/use-agency-projects";

import { CountUp } from "./count-up";

import "@/styles/home-my-work.css";

export interface ApprovalItem {
  campaignId: string;
  kind: string;
  tab: string;
  label: string;
  campaignTitle: string;
  count: number;
}

interface MyWorkCardProps {
  sectionRef?: Ref<HTMLElement>;
  title: string;
  loading: boolean;
  error: boolean;
  approvals: ApprovalItem[];
  /** Foto (banner) de cada campanha, pelo id. */
  banners?: Map<string, string>;
  onOpenApproval: (item: ApprovalItem) => void;
  /** Só em workspace de agência: as tarefas pessoais (abertas, em que a pessoa é responsável). */
  personal?: { tasks: MyTask[]; loading: boolean };
  onOpenTask?: (task: MyTask) => void;
  /** Rodapé do cartão: leva à lista completa da aba aberta. */
  onViewAll?: (tab: Tab) => void;
}

const KIND_ICON: Record<string, string> = { script: "file", content: "image", participant: "users" };

export type Tab = "approvals" | "tasks";

/** "Meu trabalho" da Início: lista agrupada, preta com luz roxa; na agência, abas para aprovações e tarefas pessoais. */
export function MyWorkCard({ sectionRef, title, loading, error, approvals, banners, onOpenApproval, personal, onOpenTask, onViewAll }: MyWorkCardProps) {
  // Escolha da pessoa; sem escolha, abre em "Minhas tarefas" (agência) ou nas aprovações. `personal` pode chegar depois do
  // primeiro render (o workspace carrega), então o padrão é derivado, não guardado no estado inicial.
  const [picked, setPicked] = useState<Tab | null>(null);
  const tab: Tab = picked ?? (personal ? "tasks" : "approvals");
  const listRef = useRef<HTMLUListElement>(null);
  const approvalsTotal = approvals.reduce((n, a) => n + a.count, 0);
  const myTasks = personal?.tasks ?? [];
  const showTasks = !!personal && tab === "tasks";
  const total = showTasks ? myTasks.length : approvalsTotal;
  const isLoading = showTasks ? personal.loading : loading;

  const pick = (next: Tab) => {
    setPicked(next);
    listRef.current?.scrollTo({ top: 0 });
  };

  return (
    <section className="tkcard mw" aria-labelledby="tasks-heading" ref={sectionRef}>
      <div className="mw-h">
        <div>
          <h2 id="tasks-heading">{title}</h2>
          <p className="sub">{showTasks ? "Suas tarefas em aberto" : "Aprovações e decisões do workspace"}</p>
        </div>
        {personal && (
          <div className="mw-tabs" role="tablist" aria-label="Meu trabalho" data-tab={tab}>
            <button type="button" role="tab" aria-selected={tab === "tasks"} className={tab === "tasks" ? "on" : ""} onClick={() => pick("tasks")}>
              Minhas tarefas
              {!personal.loading && <em>{myTasks.length}</em>}
            </button>
            <button type="button" role="tab" aria-selected={tab === "approvals"} className={tab === "approvals" ? "on" : ""} onClick={() => pick("approvals")}>
              Workspace
              {!loading && <em>{approvalsTotal}</em>}
            </button>
          </div>
        )}
      </div>

      <div className="mw-n">
        <b>{isLoading ? "—" : <CountUp value={total} duration={700} />}</b>
        <span>
          {showTasks
            ? total === 1
              ? "tarefa para você"
              : "tarefas para você"
            : total === 1
              ? "item aguardando você"
              : "itens aguardando você"}
        </span>
      </div>

      {isLoading ? (
        <ul className="mw-l" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <div className="mw-sk" />
            </li>
          ))}
        </ul>
      ) : !showTasks && error ? (
        <div className="mw-empty">
          <span>
            <I n="alert" />
          </span>
          <b>Pendências indisponíveis</b>
          <p>Abra a campanha nas abas de aprovação para conferir.</p>
        </div>
      ) : showTasks ? (
        myTasks.length === 0 ? (
          <div className="mw-empty">
            <span>
              <I n="check" />
            </span>
            <b>Nenhuma tarefa sua em aberto</b>
            <p>Quando alguém te atribuir uma tarefa em um projeto, ela aparece aqui.</p>
          </div>
        ) : (
          <ul className="mw-l" ref={listRef} key="tasks">
            {myTasks.map((task, i) => {
              const due = taskDueLabel(task);
              return (
                <li key={task.id} style={{ ["--i" as string]: Math.min(i, 8) }}>
                  <button type="button" className="mw-r" onClick={() => onOpenTask?.(task)}>
                    <span className={`mw-ic mw-st ${task.status}`} aria-hidden="true" />
                    <span className="mw-tx">
                      <b>{task.title}</b>
                      <small>{task.project_name}</small>
                    </span>
                    {task.priority === "urgente" || task.priority === "alta" ? (
                      <span className={`mw-pr ${task.priority}`}>{task.priority === "urgente" ? "Urgente" : "Alta"}</span>
                    ) : null}
                    {due.text ? <span className={`mw-due${due.overdue ? " late" : ""}`}>{due.text}</span> : null}
                    <I n="chev" cls="sm mw-ch" />
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : approvals.length === 0 ? (
        <div className="mw-empty">
          <span>
            <I n="check" />
          </span>
          <b>Tudo em dia</b>
          <p>Sem conteúdos, roteiros ou participantes aguardando sua ação.</p>
        </div>
      ) : (
        <ul className="mw-l" ref={listRef} key="approvals">
          {approvals.map((a, i) => (
            <li key={`${a.campaignId}-${a.kind}-${i}`} style={{ ["--i" as string]: Math.min(i, 8) }}>
              <button type="button" className="mw-r" onClick={() => onOpenApproval(a)}>
                <CampaignThumb banner={banners?.get(a.campaignId)} kind={a.kind} />
                <span className="mw-tx">
                  <b>{a.label}</b>
                  <small>{a.campaignTitle}</small>
                </span>
                <span className="mw-c" aria-label={`${a.count} ${a.count === 1 ? "item" : "itens"}`}>
                  {a.count}
                </span>
                <I n="chev" cls="sm mw-ch" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {onViewAll && (
        <div className="mw-f">
          <button type="button" onClick={() => onViewAll(tab)}>
            {showTasks ? "Ver meus projetos" : "Ver todas as campanhas"}
            <I n="chev" cls="sm" />
          </button>
        </div>
      )}
    </section>
  );
}

/** Foto da campanha com o tipo da pendência num selo; sem foto (ou se ela não carregar), só o ícone do tipo. */
function CampaignThumb({ banner, kind }: { banner?: string; kind: string }) {
  const [broken, setBroken] = useState(false);
  const src = banner ? getUploadUrl(banner) : undefined;
  const icon = <I n={KIND_ICON[kind] ?? "users"} />;
  if (!src || broken) return <span className={`mw-ic ${kind}`}>{icon}</span>;
  return (
    <span className="mw-ph">
      <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} />
      <span className={`mw-bd ${kind}`}>{icon}</span>
    </span>
  );
}

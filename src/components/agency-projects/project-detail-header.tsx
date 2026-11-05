import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Pencil } from "lucide-react";

import { AdminActionMenu } from "@/components/admin/platform/admin-action-menu";
import { I } from "@/components/prototype/ui";
import { useProjectTasks } from "@/hooks/use-agency-projects";
import type { Project } from "@/shared/services/agency-projects";

import { ProjectCover } from "./project-card";
import { ProjectForm } from "./project-form";
import {
  PROJECT_HEALTH_LABEL,
  PROJECT_HEALTH_TONE,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  formatDate,
  nextDeliveryTask,
  pendingSummary,
  progressPercent,
  updatedLabel,
} from "./project-ui";
import { ToneBadge } from "./tone-badge";
import { buildProjectMenu, useProjectActions } from "./use-project-actions";
import type { ProjectPermissions } from "./use-project-permissions";

const LONG_DESCRIPTION = 220;

/**
 * Cabeçalho do detalhe do projeto: voltar para Projetos, capa, nome, selo de status, descrição, "responsável ·
 * Atualizado há X", Editar e "⋯" (Duplicar, Pausar/Reativar, Arquivar, Excluir, conforme as permissões) e os
 * indicadores Progresso, Próxima entrega e Pendências (com o selo de saúde quando não é saudável).
 */
export function ProjectDetailHeader({ project, can }: { project: Project; can: ProjectPermissions }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const actions = useProjectActions({
    onDuplicated: (copy) => void navigate({ to: "/projects/$projectId", params: { projectId: copy.id } }),
    onDeleted: () => void navigate({ to: "/projects" }),
  });
  // Mesma consulta do quadro de tarefas (o cache é um só): só dá o título da próxima entrega.
  const { data: tasks } = useProjectTasks(project.id);

  const { stats } = project;
  const percent = progressPercent(stats);
  const next = nextDeliveryTask(tasks, stats.next_due);
  const pending = pendingSummary(stats);
  const menu = buildProjectMenu({ project, can, actions });
  const description = project.description?.trim() ?? "";
  const longDescription = description.length > LONG_DESCRIPTION || description.split("\n").length > 3;
  const responsible = project.responsible?.name;

  return (
    <>
      <nav aria-label="Navegação">
        <Link to="/projects" className="back">
          <span>
            <I n="back" cls="sm" />
          </span>
          Projetos
        </Link>
      </nav>

      <header className="apj-dh">
        <div className="apj-dh-id">
          <ProjectCover project={project} size={72} />
          <div className="apj-dh-tx">
            <div className="apj-dh-t">
              <h1>{project.name}</h1>
              <ToneBadge tone={PROJECT_STATUS_TONE[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</ToneBadge>
            </div>
            {description ? (
              <>
                <p className={`apj-dh-d${expanded ? " open" : ""}`}>{description}</p>
                {longDescription ? (
                  <button type="button" className="apj-link" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                    {expanded ? "Ver menos" : "Ver tudo"}
                  </button>
                ) : null}
              </>
            ) : null}
            <p className="apj-dh-m">
              {responsible ? `${responsible} · ` : ""}
              {updatedLabel(stats.last_activity_at)}
            </p>
          </div>
        </div>

        <div className="apj-dh-act">
          {can.canWrite ? (
            <button type="button" className="btn out" onClick={() => setEditing(true)}>
              <Pencil className="ico sm" aria-hidden />
              Editar
            </button>
          ) : null}
          <AdminActionMenu items={menu} iconOnly variant="secondary" ariaLabel="Mais opções do projeto" />
        </div>
      </header>

      <section className="card apj-kpis" aria-label="Resumo do projeto">
        <div className="apj-kpi">
          <small>Progresso</small>
          <b>{percent === null ? "Sem tarefas" : `${percent}%`}</b>
          <span className="d">{stats.tasks_total > 0 ? `${stats.tasks_done} de ${stats.tasks_total} tarefas` : "Crie a primeira tarefa abaixo"}</span>
          {percent !== null ? (
            <div className="apj-bar" role="progressbar" aria-label="Progresso do projeto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <i style={{ width: `${percent}%` }} />
            </div>
          ) : null}
        </div>
        <div className="apj-kpi">
          <small>Próxima entrega</small>
          <b className="txt" title={next?.title}>
            {next ? next.title : stats.next_due ? "Entrega definida" : "Sem próxima entrega"}
          </b>
          <span className="d">{stats.next_due ? formatDate(stats.next_due) : "Nenhuma tarefa aberta com prazo"}</span>
        </div>
        <div className="apj-kpi">
          <small>
            Pendências
            {project.health && project.health !== "saudavel" ? (
              <ToneBadge tone={PROJECT_HEALTH_TONE[project.health]}>{PROJECT_HEALTH_LABEL[project.health]}</ToneBadge>
            ) : null}
          </small>
          <b className={`txt${pending.alert ? " apj-is-late" : ""}`}>{pending.value}</b>
          {pending.complement ? <span className="d">{pending.complement}</span> : null}
        </div>
      </section>

      {editing ? <ProjectForm project={project} onClose={() => setEditing(false)} /> : null}
      {actions.dialog}
    </>
  );
}

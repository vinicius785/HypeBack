import { Link } from "@tanstack/react-router";

import { AdminActionMenu } from "@/components/admin/platform/admin-action-menu";
import { Av, I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import type { Project } from "@/shared/services/agency-projects";

import {
  PROJECT_HEALTH_LABEL,
  PROJECT_HEALTH_TONE,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  deliveryLabel,
  progressPercent,
  projectInitials,
  responsibleLine,
  taskSummary,
  taskSummaryText,
} from "./project-ui";
import { ToneBadge } from "./tone-badge";
import { buildProjectMenu, type ProjectActions } from "./use-project-actions";
import type { ProjectPermissions } from "./use-project-permissions";

/** Capa quadrada do cartão e do cabeçalho: a imagem, ou as iniciais do nome. */
export function ProjectCover({ project, size = 48 }: { project: Pick<Project, "name" | "cover_url">; size?: number }) {
  const url = getUploadUrl(project.cover_url);
  return (
    <span className="apj-cover" style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.32)) }} aria-hidden="true">
      {url ? <img src={url} alt="" /> : projectInitials(project.name) || "?"}
    </span>
  );
}

interface ProjectCardProps {
  project: Project;
  can: Pick<ProjectPermissions, "canCreate" | "canWrite" | "canDelete">;
  actions: ProjectActions;
  /** Encerrados (concluídos e arquivados) ficam com aparência mais neutra. */
  closed?: boolean;
  onOpen: () => void;
  onEdit: () => void;
}

/**
 * Cartão de projeto: capa ou iniciais, nome, responsável com "+N", selos de status e de saúde (só quando não é
 * saudável), barra de progresso, entrega e resumo das tarefas. O cartão inteiro abre o projeto por um link
 * sobreposto (sem botão dentro de botão); o menu "⋯" fica por cima dele.
 */
export function ProjectCard({ project, can, actions, closed = false, onOpen, onEdit }: ProjectCardProps) {
  const { stats } = project;
  const who = responsibleLine(project);
  const percent = progressPercent(stats);
  const summary = taskSummary(stats);
  const menu = buildProjectMenu({ project, can, actions, onOpen, onEdit });

  return (
    <article className="apj-card" data-closed={closed} role="listitem">
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        className="apj-open"
        aria-label={`Abrir projeto ${project.name} (${PROJECT_STATUS_LABEL[project.status]}${who ? `, responsável ${who.name}` : ""})`}
      />
      <div className="apj-top">
        <ProjectCover project={project} />
        <div className="apj-id">
          <div className="apj-nm">
            <b title={project.name}>{project.name}</b>
            <ToneBadge tone={PROJECT_STATUS_TONE[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</ToneBadge>
          </div>
          <div className="apj-who">
            {project.responsible ? (
              <>
                <Av name={project.responsible.name} src={project.responsible.avatar ?? undefined} size={18} />
                <span className="apj-who-n">{who?.name}</span>
                {who && who.extra > 0 ? (
                  <span className="apj-who-x" title={who.extraNames} aria-label={`mais ${who.extra} ${who.extra === 1 ? "participante" : "participantes"}: ${who.extraNames}`}>
                    +{who.extra}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="apj-who-n">Sem responsável</span>
            )}
          </div>
        </div>
        <div className="apj-menu">
          <AdminActionMenu items={menu} iconOnly variant="ghost" ariaLabel={`Mais ações para ${project.name}`} />
        </div>
      </div>

      <div className="apj-meta">
        {project.health && project.health !== "saudavel" ? (
          <span>
            <ToneBadge tone={PROJECT_HEALTH_TONE[project.health]}>{PROJECT_HEALTH_LABEL[project.health]}</ToneBadge>
          </span>
        ) : null}
        <span>
          <I n="cal" cls="sm" />
          {deliveryLabel(stats)}
        </span>
        <span>
          {percent === null ? (
            <I n="check" cls="sm" />
          ) : (
            <span
              className="apj-bar apj-bar-mini"
              role="progressbar"
              aria-label={`Progresso: ${taskSummaryText(stats)}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <i style={{ width: `${percent}%` }} />
            </span>
          )}
          {summary.progress}
          {summary.overdue ? (
            <>
              {" · "}
              <em className="apj-late">{summary.overdue}</em>
            </>
          ) : null}
        </span>
      </div>
    </article>
  );
}

/**
 * Linha da visão em lista: mesma informação do cartão (capa, nome, responsável, status e saúde, progresso das tarefas,
 * entrega) em colunas alinhadas, para comparar muitos projetos de relance. A linha inteira abre o projeto.
 */
export function ProjectRow({ project, can, actions, closed = false, onOpen, onEdit }: ProjectCardProps) {
  const { stats } = project;
  const who = responsibleLine(project);
  const percent = progressPercent(stats);
  const summary = taskSummary(stats);
  const menu = buildProjectMenu({ project, can, actions, onOpen, onEdit });

  return (
    <div className="apj-row" data-closed={closed} role="listitem">
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        className="apj-open"
        aria-label={`Abrir projeto ${project.name} (${PROJECT_STATUS_LABEL[project.status]}${who ? `, responsável ${who.name}` : ""})`}
      />
      <div className="apj-rc apj-rn">
        <ProjectCover project={project} size={40} />
        <div className="apj-id">
          <b title={project.name}>{project.name}</b>
          <small>{project.description?.trim() || taskSummaryText(stats)}</small>
        </div>
      </div>
      <div className="apj-rc apj-rw">
        {project.responsible ? (
          <>
            <Av name={project.responsible.name} src={project.responsible.avatar ?? undefined} size={24} />
            <span className="apj-who-n">{who?.name}</span>
            {who && who.extra > 0 ? (
              <span className="apj-who-x" title={who.extraNames} aria-label={`mais ${who.extra} ${who.extra === 1 ? "participante" : "participantes"}: ${who.extraNames}`}>
                +{who.extra}
              </span>
            ) : null}
          </>
        ) : (
          <span className="apj-who-n">Sem responsável</span>
        )}
      </div>
      <div className="apj-rc apj-rb">
        <ToneBadge tone={PROJECT_STATUS_TONE[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</ToneBadge>
        {project.health && project.health !== "saudavel" ? (
          <ToneBadge tone={PROJECT_HEALTH_TONE[project.health]}>{PROJECT_HEALTH_LABEL[project.health]}</ToneBadge>
        ) : null}
      </div>
      <div className="apj-rc apj-rp">
        <div
          className="apj-bar"
          role={percent === null ? undefined : "progressbar"}
          aria-hidden={percent === null ? true : undefined}
          aria-label={percent === null ? undefined : `Progresso: ${taskSummaryText(stats)}`}
          aria-valuemin={percent === null ? undefined : 0}
          aria-valuemax={percent === null ? undefined : 100}
          aria-valuenow={percent ?? undefined}
        >
          <i style={{ width: `${percent ?? 0}%` }} />
        </div>
        <span className="apj-rt">
          {summary.progress}
          {summary.overdue ? (
            <>
              {" · "}
              <em className="apj-late">{summary.overdue}</em>
            </>
          ) : null}
        </span>
        <span className="apj-rt apj-rdm">{deliveryLabel(stats)}</span>
      </div>
      <div className="apj-rc apj-rd">{deliveryLabel(stats)}</div>
      <div className="apj-menu apj-rm">
        <AdminActionMenu items={menu} iconOnly variant="ghost" ariaLabel={`Mais ações para ${project.name}`} />
      </div>
    </div>
  );
}

/** Cabeçalho das colunas da visão em lista (decorativo: cada linha já se descreve sozinha). */
export function ProjectListHead() {
  return (
    <div className="apj-lh" aria-hidden="true">
      <span>Projeto</span>
      <span>Responsável</span>
      <span>Status</span>
      <span>Tarefas</span>
      <span>Entrega</span>
      <span />
    </div>
  );
}

/** Esqueleto com a mesma estrutura do cartão. */
export function ProjectCardSkeleton() {
  return (
    <div className="apj-card" aria-hidden="true">
      <div className="apj-top">
        <span className="apj-sk" style={{ width: 48, height: 48, borderRadius: "50%" }} />
        <div className="apj-id">
          <span className="apj-sk" style={{ width: "62%", height: 16, display: "block" }} />
          <span className="apj-sk" style={{ width: "40%", height: 12, display: "block", marginTop: 8 }} />
        </div>
      </div>
      <div className="apj-meta">
        <span className="apj-sk" style={{ width: 96, height: 12, display: "block" }} />
        <span className="apj-sk" style={{ width: 120, height: 12, display: "block" }} />
      </div>
    </div>
  );
}

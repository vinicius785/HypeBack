import { createFileRoute, Link } from "@tanstack/react-router";

import { PageContainer } from "@/components/page/page-kit";
import { I } from "@/components/prototype/ui";
import { ProjectTasksBoard } from "@/components/agency-projects/board";
import { ProjectDetailHeader } from "@/components/agency-projects/project-detail-header";
import { useProjectPermissions } from "@/components/agency-projects/use-project-permissions";
import { useAgencyProject } from "@/hooks/use-agency-projects";
import { useIsAgencyWorkspace } from "@/hooks/use-agency-brands";
import { isAgencyProjectNotFound, isAgencyProjectsUnavailable } from "@/shared/services/agency-projects";

import "@/styles/agency-projects.css";

export const Route = createFileRoute("/(private)/(app)/projects/$projectId")({
  component: ProjectDetailPage,
});

function BackToProjects() {
  return (
    <Link to="/projects" className="btn out">
      Voltar para Projetos
    </Link>
  );
}

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const isAgency = useIsAgencyWorkspace();
  const can = useProjectPermissions();
  const { data: project, isLoading, error, refetch, isFetching } = useAgencyProject(projectId);

  const wrap = (children: React.ReactNode) => (
    <div className="pv">
      <PageContainer>{children}</PageContainer>
    </div>
  );

  if (!isAgency) {
    return wrap(
      <div className="ov-empty big">
        <span>
          <I n="lock" />
        </span>
        <b>Projetos são exclusivos de agências</b>
        <small>Este workspace não é de agência. Fale com a equipe Hype para ativar o acesso de agência.</small>
      </div>,
    );
  }

  if (!can.canRead) {
    return wrap(
      <div className="ov-empty big">
        <span>
          <I n="lock" />
        </span>
        <b>Você não tem acesso a Projetos</b>
        <small>Peça a quem administra o workspace a permissão para ver campanhas.</small>
      </div>,
    );
  }

  if (isLoading || (!project && !error)) {
    return wrap(
      <div className="apj-detail-sk" aria-busy="true" aria-label="Carregando projeto">
        <span className="apj-sk" style={{ width: 120, height: 46, borderRadius: 99, display: "block" }} />
        <span className="apj-sk" style={{ width: "55%", height: 72, display: "block" }} />
        <span className="apj-sk" style={{ width: "100%", height: 112, borderRadius: 28, display: "block" }} />
      </div>,
    );
  }

  if (isAgencyProjectsUnavailable(error)) {
    return wrap(
      <div className="ov-empty big">
        <span>
          <I n="clock" />
        </span>
        <b>Projetos ainda não está disponível</b>
        <small>Esta função chega ao seu workspace em breve.</small>
        <BackToProjects />
      </div>,
    );
  }

  if (isAgencyProjectNotFound(error) || (!project && error)) {
    const notFound = isAgencyProjectNotFound(error);
    return wrap(
      <div className="ov-empty big" role="alert">
        <span>
          <I n={notFound ? "search" : "x"} />
        </span>
        <b>{notFound ? "Projeto não encontrado" : "Erro ao carregar o projeto"}</b>
        <small>{notFound ? "Ele pode ter sido excluído ou não pertence a este workspace." : error instanceof Error ? error.message : "Tente novamente."}</small>
        <div className="btns">
          {notFound ? null : (
            <button type="button" className="btn out" disabled={isFetching} onClick={() => void refetch()}>
              Tentar de novo
            </button>
          )}
          <BackToProjects />
        </div>
      </div>,
    );
  }

  if (!project) return null;

  return wrap(
    <>
      <ProjectDetailHeader project={project} can={can} />

      <section id="secao-tarefas" className="apj-sec" aria-labelledby="apj-tarefas-h">
        <h2 id="apj-tarefas-h" className="apj-sec-h">
          Tarefas
        </h2>
        <ProjectTasksBoard project={project} can={can} />
      </section>
    </>,
  );
}
